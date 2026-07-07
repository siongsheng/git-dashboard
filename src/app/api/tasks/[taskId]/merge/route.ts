import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, repos, tasks } from "@/db";
import { squashMergeTaskBranch } from "@/lib/git";
import { getRunManager } from "@/server/run-manager";
import { errMessage, jsonError } from "@/lib/api";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await params;
  const db = getDb();
  const task = db.select().from(tasks).where(eq(tasks.id, Number(taskId))).get();
  if (!task) return jsonError("Task not found", 404);
  if (task.status !== "awaiting_review") {
    return jsonError("Task is not awaiting review", 409);
  }
  if (getRunManager().isTaskActive(task.id)) {
    return jsonError("An agent run is still active on this task", 409);
  }
  if (!task.branchName || !task.worktreePath) {
    return jsonError("Task has no agent branch to merge", 409);
  }
  const repo = db.select().from(repos).where(eq(repos.id, task.repoId)).get();
  if (!repo) return jsonError("Repo not found", 404);

  try {
    await squashMergeTaskBranch({
      repoPath: repo.path,
      defaultBranch: repo.defaultBranch,
      branch: task.branchName,
      worktreeDir: task.worktreePath,
      commitMessage: `${task.type}: ${task.title} (task #${task.id})`,
    });
  } catch (err) {
    return jsonError(errMessage(err), 500);
  }

  db.update(tasks)
    .set({ status: "done", updatedAt: Date.now() })
    .where(eq(tasks.id, task.id))
    .run();
  return NextResponse.json({ ok: true });
}
