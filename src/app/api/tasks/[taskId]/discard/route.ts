import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, repos, tasks } from "@/db";
import { discardTaskBranch } from "@/lib/git";
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
  if (getRunManager().isTaskActive(task.id)) {
    return jsonError("Stop the active agent run before discarding", 409);
  }
  const repo = db.select().from(repos).where(eq(repos.id, task.repoId)).get();
  if (!repo) return jsonError("Repo not found", 404);

  if (task.branchName && task.worktreePath) {
    try {
      await discardTaskBranch({
        repoPath: repo.path,
        branch: task.branchName,
        worktreeDir: task.worktreePath,
      });
    } catch (err) {
      return jsonError(errMessage(err), 500);
    }
  }

  db.update(tasks)
    .set({
      status: "failed",
      branchName: null,
      baseRef: null,
      worktreePath: null,
      updatedAt: Date.now(),
    })
    .where(eq(tasks.id, task.id))
    .run();
  return NextResponse.json({ ok: true });
}
