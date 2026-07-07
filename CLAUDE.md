# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

A local, single-developer Next.js dashboard that registers local git repositories, launches headless Claude Code agent sessions (via `@anthropic-ai/claude-agent-sdk`) to implement feature/bug/chore tasks, streams each agent's progress live, and offers diff review with squash-merge or discard.

## Commands

- `npm run dev` — start the dev server (Turbopack, http://localhost:3000)
- `npm run build` / `npm start` — production build/serve
- `npx tsc --noEmit` — typecheck
- `npm run lint` — ESLint
- `npx drizzle-kit generate` — regenerate SQL migrations after editing `src/db/schema.ts` (migrations in `drizzle/` are applied automatically on server boot)
- `sqlite3 data/app.db` — inspect the database directly

There is no test suite in this repo; verification is end-to-end via the dev server (see below).

## Architecture

**Data flow:** UI → API route handlers (`src/app/api/`) → `RunManager` / git layer → SQLite. Pages are server components reading Drizzle directly; mutations and streaming go through the API routes.

**Singletons on `globalThis`** (`src/db/index.ts`, `src/server/run-manager.ts`): Next.js dev hot-reload re-evaluates modules, so the SQLite connection and the run manager (which holds live agent subprocess state) are memoized on `globalThis`. Never instantiate them directly.

**Agent runs** (`src/server/run-manager.ts`): each task gets an isolated **git worktree** under `data/worktrees/<repoId>/<slug>` on branch `agent/<slug>-<taskId>`, created from the repo's default branch. The SDK's `query()` runs with `cwd` set to that worktree. This isolation is why `permissionMode: "acceptEdits"` with broad Bash access is acceptable — the blast radius is the worktree, and `disallowedTools` additionally blocks `git push`/publish/sudo. **Never point an agent's cwd at the user's main checkout.** Multiple agents run fully in parallel, including on the same repo.

**Event pipeline:** every SDK message is persisted verbatim (raw JSON) to `run_events` with a per-run monotonic `seq`, and simultaneously emitted on an in-memory `RunEmitter`. The SSE endpoint (`src/app/api/runs/[runId]/events/route.ts`) replays persisted events after `?afterSeq`/`Last-Event-ID`, then tails the emitter, deduping by seq — page reloads mid-run are lossless. If the SDK's message shapes drift, only `normalizeMessage()` in run-manager.ts and the renderers in `src/components/run/AgentTimeline.tsx` need updating; stored payloads stay valid.

**Run lifecycle:** task `queued` → `running` (agent working) → `awaiting_review` (diff ready; repo test command runs in the worktree first if configured) → `done` (squash-merged, worktree+branch deleted) or `failed`/discarded. Follow-up feedback resumes the same SDK session via `resume: sessionId`. On server boot, `src/instrumentation.ts` runs migrations and marks any `starting`/`running` runs as failed ("orphaned by server restart") — worktrees survive, so retry/resume still works.

**Auth:** the Agent SDK spawns the locally installed `claude` CLI. It uses the CLI's login if present; `ANTHROPIC_API_KEY` in the environment also works.

## Conventions & gotchas

- Next.js 16: `params`/`searchParams` are Promises — always `await` them in pages and route handlers.
- `next.config.ts` `serverExternalPackages` must keep `better-sqlite3`, `@anthropic-ai/claude-agent-sdk`, and `simple-git` unbundled.
- SDK types were pinned against `node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts` — check there before changing `Options` or message handling.
- Dark theme only; color tokens live in `src/app/globals.css` and are consumed as Tailwind classes (`bg-surface`, `text-muted`, `text-status-*`, etc.).
- `data/` (SQLite DB + worktrees) is gitignored and safe to delete for a clean slate — but doing so orphans agent branches in registered repos.

## End-to-end verification

1. Create a toy repo (e.g. `~/tmp/toy-calc` with a `calc.js` and an npm `test` script), register it on the home page with its test command.
2. Create a task ("Add a multiply function with a test"), start the agent, and watch the live timeline.
3. When it reaches In Review: check the Diff tab, optionally send follow-up feedback (resumes the session), then Approve & squash-merge and confirm the commit landed on the default branch.
