import { execFile } from "node:child_process";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, repos, tasks } from "@/db";
import { getRemoteInfo, getTaskDiff, pushBranch } from "@/lib/git";
import { getRunManager } from "@/server/run-manager";
import { buildPrBody, latestRunSummary } from "@/server/pr-body";
import { errMessage, jsonError } from "@/lib/api";

// Runs `gh` in the repo dir and returns stdout (the created PR URL).
function ghCreatePr(opts: {
  repoPath: string;
  head: string;
  base: string;
  title: string;
  body: string;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      "gh",
      [
        "pr",
        "create",
        "--head",
        opts.head,
        "--base",
        opts.base,
        "--title",
        opts.title,
        "--body-file",
        "-", // read body from stdin to avoid arg-length/escaping issues
      ],
      { cwd: opts.repoPath, timeout: 60000 },
      (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr.trim() || err.message));
        resolve(stdout.trim());
      },
    );
    child.stdin?.end(opts.body);
  });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await params;
  const db = getDb();
  const task = db.select().from(tasks).where(eq(tasks.id, Number(taskId))).get();
  if (!task) return jsonError("Task not found", 404);
  if (task.status !== "awaiting_review") return jsonError("Task is not awaiting review", 409);
  if (getRunManager().isTaskActive(task.id)) {
    return jsonError("An agent run is still active on this task", 409);
  }
  if (!task.branchName || !task.baseRef) {
    return jsonError("Task has no agent branch to open a PR from", 409);
  }
  const repo = db.select().from(repos).where(eq(repos.id, task.repoId)).get();
  if (!repo) return jsonError("Repo not found", 404);

  const remote = await getRemoteInfo(repo.path);
  if (!remote.hasRemote) return jsonError("This repo has no 'origin' remote to open a PR against", 409);
  if (!remote.isGitHub) return jsonError("The 'origin' remote is not a GitHub repository", 409);

  try {
    // Assemble body (best-effort narrative) before pushing.
    const diff = await getTaskDiff(
      repo.path,
      task.baseRef,
      task.branchName,
      task.worktreePath ?? undefined,
    );
    const { summary, run } = latestRunSummary(task.id);
    const body = await buildPrBody({
      task,
      summary,
      diffStat: diff.stat,
      testStatus: run?.testStatus ?? null,
      testOutput: run?.testOutput ?? null,
    });

    await pushBranch(repo.path, task.branchName);
    const prUrl = await ghCreatePr({
      repoPath: repo.path,
      head: task.branchName,
      base: repo.defaultBranch,
      title: `${task.type}: ${task.title}`,
      body,
    });

    db.update(tasks).set({ prUrl, updatedAt: Date.now() }).where(eq(tasks.id, task.id)).run();
    return NextResponse.json({ prUrl });
  } catch (err) {
    return jsonError(errMessage(err), 500);
  }
}
