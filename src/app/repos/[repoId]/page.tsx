import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getDb, repos, tasks } from "@/db";
import { KanbanBoard } from "@/components/task/KanbanBoard";
import { NewTaskButton } from "@/components/task/NewTaskModal";
import { RepoTabs } from "@/components/repo/RepoTabs";

export const dynamic = "force-dynamic";

export default async function RepoPage({
  params,
}: {
  params: Promise<{ repoId: string }>;
}) {
  const { repoId } = await params;
  const db = getDb();
  const repo = db.select().from(repos).where(eq(repos.id, Number(repoId))).get();
  if (!repo) notFound();

  const repoTasks = db
    .select()
    .from(tasks)
    .where(eq(tasks.repoId, repo.id))
    .orderBy(desc(tasks.updatedAt))
    .all();

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-faint">
            <Link href="/" className="hover:text-muted">
              Repos
            </Link>
            <span>/</span>
          </div>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">{repo.name}</h1>
          <p className="mt-1 font-mono text-xs text-faint">
            {repo.path} · ⎇ {repo.defaultBranch}
            {repo.testCommand && ` · tests: ${repo.testCommand}`}
          </p>
        </div>
        <NewTaskButton repoId={repo.id} />
      </div>

      <KanbanBoard tasks={repoTasks} />

      <RepoTabs repoId={repo.id} />
    </div>
  );
}
