import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, repos, tasks } from "@/db";
import { getTaskDiff } from "@/lib/git";
import { errMessage, jsonError } from "@/lib/api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await params;
  const db = getDb();
  const task = db.select().from(tasks).where(eq(tasks.id, Number(taskId))).get();
  if (!task) return jsonError("Task not found", 404);
  if (!task.branchName || !task.baseRef) {
    return NextResponse.json({ stat: "", patch: "", hasCommits: false, hasUncommitted: false });
  }
  const repo = db.select().from(repos).where(eq(repos.id, task.repoId)).get();
  if (!repo) return jsonError("Repo not found", 404);
  try {
    const diff = await getTaskDiff(
      repo.path,
      task.baseRef,
      task.branchName,
      task.worktreePath ?? undefined,
    );
    return NextResponse.json(diff);
  } catch (err) {
    return jsonError(errMessage(err), 500);
  }
}
