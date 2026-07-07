# Git Dashboard

A local, single-developer web dashboard for handing coding tasks to AI agents. You register a git repository on your machine, describe a feature or bug fix, and a headless [Claude Code](https://docs.claude.com/en/docs/claude-code) agent implements it — while you watch its progress live. When it's done, you review the diff, optionally send follow-up feedback, and either squash-merge the result locally or open a GitHub pull request.

Think of it as a kanban board where each card can be worked on by an agent instead of you.

<!-- Add a screenshot here: docs/board.png -->

## Why you might want this

- **Your working copy is never touched.** Each task runs in its own isolated [git worktree](https://git-scm.com/docs/git-worktree) on a dedicated `agent/*` branch. You can keep coding while agents work, and run several agents in parallel — even on the same repo.
- **You see everything the agent does**, streamed live: its messages, the files it reads and edits, the commands it runs, and the final cost/token usage.
- **Nothing merges without your approval.** The agent commits to its own branch; you review the diff and decide whether to squash-merge locally, open a GitHub pull request, or discard.
- **Local-first, GitHub-optional.** It works on a plain local repo with no remote. If a repo *does* have a GitHub remote, you can open PRs from the dashboard — but nothing is pushed unless you ask. Your code and the task database stay on your machine.

## Requirements

- **Node.js 20+**
- **Git**
- **[Claude Code CLI](https://docs.claude.com/en/docs/claude-code/setup) installed and logged in.** The dashboard runs agents by spawning your local `claude` CLI, so it uses whatever login you already have. (Setting `ANTHROPIC_API_KEY` in your environment also works.)
- **[GitHub CLI](https://cli.github.com/) (`gh`), authenticated** — *optional*, only needed to open pull requests. Repos without a GitHub remote just use the local squash-merge instead.

Verify what you need:

```bash
claude --version   # required — should print a version
gh auth status     # optional — only for the pull-request feature
```

## Quick start

```bash
git clone https://github.com/siongsheng/git-dashboard.git
cd git-dashboard
npm install
npm run dev
```

Open **http://localhost:3000**. The database and agent worktrees are created automatically under `data/` on first run — no setup step needed.

## How to use it

### 1. Register a repository

On the home page, paste the **absolute path** to a local git repo (e.g. `/Users/you/projects/my-app`) into the form and click **Add repo**. The repo must already be a git repository; it doesn't need a remote.

Optionally add a **test command** (e.g. `npm test`, `pytest`). If set, the dashboard runs it in the agent's worktree after each run and shows pass/fail next to the diff.

### 2. Create a task

Click into the repo to open its board (with a search box to filter tasks by title or description), then **+ New task**. Give it:

- a **title** (short summary),
- a **description** — this becomes the agent's brief, so be specific about what to build and any acceptance criteria,
- a **type** (feature / bug / chore),
- a **model** (Sonnet by default; Opus or Haiku available) and an optional **budget cap** in USD.

Check "Start the agent immediately" to kick it off right away.

### 3. Watch it work

The task moves to **In Progress** and its detail page streams the agent's activity: text, thinking, tool calls (file reads/edits, shell commands), and a final summary with cost and token counts. You can reload the page mid-run without losing anything, or **Stop** the agent at any point.

### 4. Review and merge

When the agent finishes, the task moves to **In Review**:

- Open the **Diff** tab to see exactly what changed.
- Not quite right? Type **follow-up feedback** — the agent resumes the same session with full context and iterates.
- Happy with it? Land the work one of two ways:
  - **Approve & squash-merge** — the changes land as a single clean commit on your default branch, and the agent's branch and worktree are cleaned up. (Local; no remote needed.)
  - **Open pull request** *(shown only when the repo has a GitHub remote)* — pushes the agent's branch and creates a PR via `gh`. The PR description is generated for you from the task brief, the agent's summary, the diff stat, test results, and a written **Why** and **stakeholder impact**.
- Or **Discard** to throw the work away.

**After opening a PR**, the task stays In Review with a link to the PR. The dashboard has no webhook, so it polls the PR's status (and you can hit **Check PR status** to force a check): once you merge the PR on GitHub, the task automatically moves to **Done** and its local branch and worktree are cleaned up.

> To squash-merge, your repo should be on its default branch with a clean working tree — the dashboard commits onto it directly.

### 5. Track spend

The **Stats** page aggregates cost, run count, and token usage across all repos, models, and days.

## The task lifecycle

```
Backlog → In Progress → In Review → Done
                            │          ↑ (squash-merge, or PR merged on GitHub)
                            ↘ (discard / error) → Failed
```

## How it works (short version)

| Step | What happens |
|------|--------------|
| **Isolate** | A worktree is created at `data/worktrees/…` on branch `agent/<slug>`, off your default branch. |
| **Run** | A headless Claude Code session runs with its working directory set to that worktree. Edits and safe commands auto-approve; `git push`, publishing, and `sudo` are blocked. |
| **Stream** | Every agent message is saved to SQLite and pushed to the browser over Server-Sent Events, so progress is live and reloads replay losslessly. |
| **Review** | Your test command runs in the worktree; you review the diff, then squash-merge locally, open a GitHub PR, or discard. |
| **Sync** | If you opened a PR, the task polls `gh pr view` and flips to Done (cleaning up the branch/worktree) once the PR is merged on GitHub. |

If the server restarts while an agent is running, that run is marked failed on the next boot — the worktree survives, so you can retry.

## Tech stack

Next.js (App Router, TypeScript) · SQLite via [Drizzle ORM](https://orm.drizzle.team/) · [simple-git](https://github.com/steveukx/git-js) · [`@anthropic-ai/claude-agent-sdk`](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) · Tailwind CSS.

## Commands

```bash
npm run dev              # start the dev server (http://localhost:3000)
npm run build && npm start   # production build + serve
npx tsc --noEmit         # typecheck
npm run lint             # lint
npx drizzle-kit generate # regenerate SQL migrations after editing src/db/schema.ts
```

Migrations in `drizzle/` are applied automatically on server boot.

## Notes & limitations

- **Single-user, local tool** — no authentication, not meant to be exposed to the internet.
- **GitHub integration is pull-request-only, via the `gh` CLI** — the dashboard can open PRs and read their status, but it doesn't sync issues, comments, or reviews, and it never pushes without you clicking. Repos without a remote work fully with the local squash-merge path.
- Deleting the `data/` directory resets the dashboard (repos, tasks, run history) but leaves your actual repositories untouched.

## License

MIT
