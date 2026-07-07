import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getDb, agentRuns, repos, tasks } from "@/db";
import { getRemoteInfo } from "@/lib/git";
import { TaskDetail } from "@/components/task/TaskDetail";

export const dynamic = "force-dynamic";

export default async function TaskPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const db = getDb();
  const task = db.select().from(tasks).where(eq(tasks.id, Number(taskId))).get();
  if (!task) notFound();
  const repo = db.select().from(repos).where(eq(repos.id, task.repoId)).get();
  if (!repo) notFound();
  const runs = db
    .select()
    .from(agentRuns)
    .where(eq(agentRuns.taskId, task.id))
    .orderBy(desc(agentRuns.id))
    .all();

  const remote = await getRemoteInfo(repo.path);
  const canOpenPr = remote.hasRemote && remote.isGitHub;

  return <TaskDetail initial={{ task, runs, repo, canOpenPr }} />;
}
