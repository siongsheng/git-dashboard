import fs from "node:fs";
import { simpleGit, type SimpleGit } from "simple-git";

function git(repoPath: string): SimpleGit {
  return simpleGit(repoPath);
}

export interface RepoInfo {
  name: string;
  defaultBranch: string;
}

export async function validateRepo(repoPath: string): Promise<RepoInfo> {
  if (!fs.existsSync(repoPath) || !fs.statSync(repoPath).isDirectory()) {
    throw new Error(`Path does not exist or is not a directory: ${repoPath}`);
  }
  const g = git(repoPath);
  const isRepo = await g.checkIsRepo();
  if (!isRepo) {
    throw new Error(`Not a git repository: ${repoPath}`);
  }
  const name = repoPath.replace(/\/+$/, "").split("/").pop() ?? repoPath;
  return { name, defaultBranch: await detectDefaultBranch(g) };
}

async function detectDefaultBranch(g: SimpleGit): Promise<string> {
  try {
    const ref = await g.raw(["symbolic-ref", "refs/remotes/origin/HEAD"]);
    const m = ref.trim().match(/refs\/remotes\/origin\/(.+)$/);
    if (m) return m[1];
  } catch {
    // no remote HEAD — fall through to current branch
  }
  const branch = await g.raw(["rev-parse", "--abbrev-ref", "HEAD"]);
  return branch.trim();
}

export async function getBranches(repoPath: string) {
  const summary = await git(repoPath).branchLocal();
  return {
    current: summary.current,
    branches: summary.all.map((name) => ({
      name,
      current: name === summary.current,
      commit: summary.branches[name]?.commit ?? "",
      label: summary.branches[name]?.label ?? "",
    })),
  };
}

export async function getStatus(repoPath: string) {
  const s = await git(repoPath).status();
  return {
    current: s.current,
    ahead: s.ahead,
    behind: s.behind,
    staged: s.staged,
    modified: s.modified,
    created: s.created,
    deleted: s.deleted,
    untracked: s.not_added,
    conflicted: s.conflicted,
    isClean: s.isClean(),
  };
}

export async function getLog(repoPath: string, ref?: string, limit = 30) {
  const options: Record<string, string | number | null> = {
    "--max-count": limit,
  };
  const log = ref
    ? await git(repoPath).log([`--max-count=${limit}`, ref])
    : await git(repoPath).log(options);
  return log.all.map((c) => ({
    hash: c.hash,
    shortHash: c.hash.slice(0, 7),
    message: c.message,
    author: c.author_name,
    date: c.date,
  }));
}

export async function resolveRef(repoPath: string, ref: string): Promise<string> {
  return (await git(repoPath).raw(["rev-parse", ref])).trim();
}

// --- Worktrees ---

export async function addWorktree(
  repoPath: string,
  worktreeDir: string,
  branch: string,
  baseRef: string,
) {
  fs.mkdirSync(worktreeDir, { recursive: true });
  await git(repoPath).raw(["worktree", "add", worktreeDir, "-b", branch, baseRef]);
}

export async function removeWorktree(repoPath: string, worktreeDir: string) {
  try {
    await git(repoPath).raw(["worktree", "remove", "--force", worktreeDir]);
  } catch {
    // Worktree dir may already be gone; prune bookkeeping either way.
    await git(repoPath).raw(["worktree", "prune"]);
  }
}

export async function deleteBranch(repoPath: string, branch: string) {
  await git(repoPath).raw(["branch", "-D", branch]);
}

export function worktreeExists(worktreeDir: string): boolean {
  return fs.existsSync(worktreeDir);
}

// --- Diffs ---

export interface TaskDiff {
  stat: string;
  patch: string;
  hasCommits: boolean;
  hasUncommitted: boolean;
}

// Diff of everything the agent produced on its branch: committed work
// (baseRef..branch) plus any uncommitted changes left in the worktree.
export async function getTaskDiff(
  repoPath: string,
  baseRef: string,
  branch: string,
  worktreeDir?: string,
): Promise<TaskDiff> {
  const g = git(repoPath);
  const range = `${baseRef}..${branch}`;
  const patch = await g.diff([range]);
  const stat = await g.diff(["--stat", range]);

  let uncommitted = "";
  if (worktreeDir && fs.existsSync(worktreeDir)) {
    const wt = git(worktreeDir);
    // Include untracked files in the uncommitted diff.
    await wt.raw(["add", "-A", "--intent-to-add"]).catch(() => {});
    uncommitted = await wt.diff();
  }

  return {
    stat,
    patch: uncommitted ? `${patch}\n${uncommitted}` : patch,
    hasCommits: patch.length > 0,
    hasUncommitted: uncommitted.length > 0,
  };
}

// --- Merge (review approval) ---

// Squash-merges the agent branch into the repo's default branch on the main
// checkout, commits with the task title, then cleans up worktree + branch.
export async function squashMergeTaskBranch(opts: {
  repoPath: string;
  defaultBranch: string;
  branch: string;
  worktreeDir: string;
  commitMessage: string;
}) {
  const g = git(opts.repoPath);
  const status = await g.status();
  if (status.current !== opts.defaultBranch) {
    throw new Error(
      `Repo is on '${status.current}', not '${opts.defaultBranch}'. Check out the default branch before merging.`,
    );
  }
  if (!status.isClean()) {
    throw new Error(
      "Working tree has uncommitted changes. Commit or stash them before merging agent work.",
    );
  }
  try {
    await g.raw(["merge", "--squash", opts.branch]);
    await g.commit(opts.commitMessage);
  } catch (err) {
    await g.raw(["merge", "--abort"]).catch(() => {});
    await g.raw(["reset", "--merge"]).catch(() => {});
    throw new Error(
      `Squash merge failed (likely conflicts): ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  await removeWorktree(opts.repoPath, opts.worktreeDir);
  await deleteBranch(opts.repoPath, opts.branch);
}

// Discard an agent branch without merging.
export async function discardTaskBranch(opts: {
  repoPath: string;
  branch: string;
  worktreeDir: string;
}) {
  await removeWorktree(opts.repoPath, opts.worktreeDir);
  await deleteBranch(opts.repoPath, opts.branch).catch(() => {});
}
