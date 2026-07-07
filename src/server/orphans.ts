import { eq, inArray } from "drizzle-orm";
import { getDb, agentRuns, tasks } from "@/db";

// A run that is 'starting' or 'running' at boot belonged to a previous server
// process whose claude subprocesses died with it. Mark it failed; the task's
// worktree and branch survive, so the user can retry or resume.
export function cleanupOrphanedRuns() {
  const db = getDb();
  const orphans = db
    .select({ id: agentRuns.id, taskId: agentRuns.taskId })
    .from(agentRuns)
    .where(inArray(agentRuns.status, ["starting", "running"]))
    .all();
  if (orphans.length === 0) return;

  db.update(agentRuns)
    .set({
      status: "failed",
      errorMessage: "Orphaned by server restart",
      finishedAt: Date.now(),
    })
    .where(
      inArray(
        agentRuns.id,
        orphans.map((o) => o.id),
      ),
    )
    .run();

  for (const o of orphans) {
    db.update(tasks)
      .set({ status: "failed", updatedAt: Date.now() })
      .where(eq(tasks.id, o.taskId))
      .run();
  }
  console.log(`[git-dashboard] Marked ${orphans.length} orphaned run(s) as failed`);
}
