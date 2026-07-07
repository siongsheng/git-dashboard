import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb, agentRuns, repos, tasks } from "@/db";
import { discardTaskBranch } from "@/lib/git";
import { getRunManager } from "@/server/run-manager";
import { jsonError } from "@/lib/api";

type Ctx = { params: Promise<{ taskId: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const { taskId } = await params;
  const db = getDb();
  const task = db.select().from(tasks).where(eq(tasks.id, Number(taskId))).get();
  if (!task) return jsonError("Task not found", 404);
  const runs = db
    .select()
    .from(agentRuns)
    .where(eq(agentRuns.taskId, task.id))
    .orderBy(desc(agentRuns.id))
    .all();
  const repo = db.select().from(repos).where(eq(repos.id, task.repoId)).get();
  return NextResponse.json({ task, runs, repo });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { taskId } = await params;
  const db = getDb();
  const task = db.select().from(tasks).where(eq(tasks.id, Number(taskId))).get();
  if (!task) return jsonError("Task not found", 404);
  if (getRunManager().isTaskActive(task.id)) {
    return jsonError("Stop the active agent run before deleting this task", 409);
  }
  // Clean up worktree/branch if the agent ever started.
  if (task.worktreePath && task.branchName) {
    const repo = db.select().from(repos).where(eq(repos.id, task.repoId)).get();
    if (repo) {
      await discardTaskBranch({
        repoPath: repo.path,
        branch: task.branchName,
        worktreeDir: task.worktreePath,
      }).catch(() => {});
    }
  }
  db.delete(tasks).where(eq(tasks.id, task.id)).run();
  return NextResponse.json({ ok: true });
}
