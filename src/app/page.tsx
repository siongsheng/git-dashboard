import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb, repos, tasks } from "@/db";
import { AddRepoForm } from "@/components/repo/AddRepoForm";
import { RepoActions } from "@/components/repo/RepoActions";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const db = getDb();
  const allRepos = db.select().from(repos).orderBy(desc(repos.createdAt)).all();

  const repoCards = allRepos.map((repo) => {
    const repoTasks = db.select().from(tasks).where(eq(tasks.repoId, repo.id)).all();
    return {
      repo,
      running: repoTasks.filter((t) => t.status === "running").length,
      inReview: repoTasks.filter((t) => t.status === "awaiting_review").length,
      total: repoTasks.length,
    };
  });

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Repositories</h1>
          <p className="mt-1 text-sm text-muted">
            Register a local git repo, then hand tasks to agents.
          </p>
        </div>
      </div>

      <AddRepoForm />

      {repoCards.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted">
          No repositories yet. Add one above by its absolute path.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {repoCards.map(({ repo, running, inReview, total }) => (
            <div
              key={repo.id}
              className="group relative rounded-lg border border-border bg-surface p-5 transition-colors hover:border-border-strong"
            >
              <Link href={`/repos/${repo.id}`} className="absolute inset-0" aria-label={repo.name} />
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-medium group-hover:text-accent">{repo.name}</h2>
                  <p className="mt-0.5 font-mono text-xs text-faint">{repo.path}</p>
                </div>
                <RepoActions repoId={repo.id} />
              </div>
              <div className="mt-4 flex items-center gap-4 text-xs text-muted">
                <span className="font-mono">⎇ {repo.defaultBranch}</span>
                {running > 0 && (
                  <span className="flex items-center gap-1.5 text-status-running">
                    <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-current" />
                    {running} agent{running > 1 ? "s" : ""} running
                  </span>
                )}
                {inReview > 0 && (
                  <span className="text-status-review">{inReview} in review</span>
                )}
                <span className="ml-auto">{total} tasks</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
