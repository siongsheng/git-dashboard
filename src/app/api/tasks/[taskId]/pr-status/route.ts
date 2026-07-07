import { execFile } from "node:child_process";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, repos, tasks } from "@/db";
import { deleteBranch, removeWorktree } from "@/lib/git";
import { errMessage, jsonError } from "@/lib/api";

// Reads PR state from GitHub. state ∈ "OPEN" | "CLOSED" | "MERGED".
function ghPrState(repoPath: string, prUrl: string): Promise<{ state: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      "gh",
      ["pr", "view", prUrl, "--json", "state"],
      { cwd: repoPath, timeout: 30000 },
      (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr.trim() || err.message));
        try {
          resolve(JSON.parse(stdout) as { state: string });
        } catch {
          reject(new Error("Could not parse gh output"));
        }
      },
    );
  });
}

// Reconciles a task's local state with its PR on GitHub. The dashboard has no
// webhook, so this is polled from the task page (and via a manual button).
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await params;
  const db = getDb();
  const task = db.select().from(tasks).where(eq(tasks.id, Number(taskId))).get();
  if (!task) return jsonError("Task not found", 404);
  if (!task.prUrl) return jsonError("Task has no pull request to sync", 400);
  const repo = db.select().from(repos).where(eq(repos.id, task.repoId)).get();
  if (!repo) return jsonError("Repo not found", 404);

  let state: string;
  try {
    ({ state } = await ghPrState(repo.path, task.prUrl));
  } catch (err) {
    return jsonError(errMessage(err), 502);
  }

  // Merged on GitHub: adopt "done" and clean up the now-redundant local branch
  // and worktree (only once — guard on the current status).
  if (state === "MERGED" && task.status === "awaiting_review") {
    if (task.worktreePath) {
      await removeWorktree(repo.path, task.worktreePath).catch(() => {});
    }
    if (task.branchName) {
      await deleteBranch(repo.path, task.branchName).catch(() => {});
    }
    db.update(tasks)
      .set({
        status: "done",
        branchName: null,
        baseRef: null,
        worktreePath: null,
        updatedAt: Date.now(),
      })
      .where(eq(tasks.id, task.id))
      .run();
    return NextResponse.json({ state, taskStatus: "done", changed: true });
  }

  return NextResponse.json({ state, taskStatus: task.status, changed: false });
}
