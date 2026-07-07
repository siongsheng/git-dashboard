"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import type { AgentRun, Repo, Task } from "@/db/schema";
import { StatusBadge, TypeBadge } from "@/components/StatusBadge";
import { AgentTimeline } from "@/components/run/AgentTimeline";
import { useRunStream } from "@/components/run/useRunStream";
import { DiffViewer } from "@/components/diff/DiffViewer";
import { formatCost, formatDuration, formatTokens, timeAgo } from "@/lib/format";

interface TaskData {
  task: Task;
  runs: AgentRun[];
  repo: Repo;
}

const ACTIVE_RUN_STATUSES = new Set(["starting", "running"]);

export function TaskDetail({ initial }: { initial: TaskData }) {
  const [data, setData] = useState<TaskData>(initial);
  const [tab, setTab] = useState<"activity" | "diff">("activity");
  const [selectedRunId, setSelectedRunId] = useState<number | null>(
    initial.runs[0]?.id ?? null,
  );
  const [diffKey, setDiffKey] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const notifiedRuns = useRef<Set<number>>(new Set());

  const { task, runs, repo } = data;
  const latestRun = runs[0] ?? null;
  const isLive = latestRun != null && ACTIVE_RUN_STATUSES.has(latestRun.status);
  const viewedRunId = selectedRunId ?? latestRun?.id ?? null;

  const refetch = useCallback(async () => {
    const res = await fetch(`/api/tasks/${task.id}`);
    if (res.ok) {
      const fresh: TaskData = await res.json();
      setData(fresh);
      setDiffKey((k) => k + 1);
      return fresh;
    }
    return null;
  }, [task.id]);

  // Fires from the SSE 'done' event: refresh task/run state and notify.
  const handleDone = useCallback(
    (info: { runStatus?: string; testStatus?: string | null }) => {
      refetch();
      const runId = viewedRunId;
      if (
        runId != null &&
        info.runStatus &&
        info.runStatus !== "running" &&
        !notifiedRuns.current.has(runId) &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        notifiedRuns.current.add(runId);
        const ok = info.runStatus === "completed";
        new Notification(ok ? "Agent finished" : `Agent run ${info.runStatus}`, {
          body: `${task.title} — ${ok ? "ready for review" : info.runStatus}${
            info.testStatus && info.testStatus !== "skipped" ? ` · tests ${info.testStatus}` : ""
          }`,
        });
      }
    },
    [refetch, viewedRunId, task.title],
  );

  const { events } = useRunStream(viewedRunId, handleDone);

  async function act(label: string, url: string, body?: unknown) {
    setBusy(label);
    setActionError(null);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    setBusy(null);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setActionError(b.error ?? `${label} failed`);
      return null;
    }
    return res.json();
  }

  async function startAgent() {
    requestNotifyPermission();
    const result = await act("start", `/api/tasks/${task.id}/start`);
    if (result) {
      const fresh = await refetch();
      setSelectedRunId(result.runId ?? fresh?.runs[0]?.id ?? null);
      setTab("activity");
    }
  }

  async function stopAgent() {
    if (latestRun) await act("stop", `/api/runs/${latestRun.id}/stop`);
    await refetch();
  }

  async function merge() {
    if (!confirm(`Squash-merge ${task.branchName} into ${repo.defaultBranch}?`)) return;
    const result = await act("merge", `/api/tasks/${task.id}/merge`);
    if (result) refetch();
  }

  async function discard() {
    if (!confirm("Discard the agent's branch and worktree? This deletes its work.")) return;
    const result = await act("discard", `/api/tasks/${task.id}/discard`);
    if (result) refetch();
  }

  async function sendFeedback(text: string) {
    requestNotifyPermission();
    const result = await act("feedback", `/api/tasks/${task.id}/message`, { text });
    if (result) {
      const fresh = await refetch();
      setSelectedRunId(result.runId ?? fresh?.runs[0]?.id ?? null);
      setTab("activity");
    }
  }

  const totalCost = useMemo(
    () => runs.reduce((sum, r) => sum + (r.costUsd ?? 0), 0),
    [runs],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-faint">
          <Link href="/" className="hover:text-muted">
            Repos
          </Link>
          <span>/</span>
          <Link href={`/repos/${repo.id}`} className="hover:text-muted">
            {repo.name}
          </Link>
          <span>/</span>
          <span>task #{task.id}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">{task.title}</h1>
          <TypeBadge type={task.type} />
          <StatusBadge status={task.status} />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-faint">
          {task.branchName && <span>⎇ {task.branchName}</span>}
          <span>{task.model}</span>
          {task.maxBudgetUsd != null && <span>cap {formatCost(task.maxBudgetUsd)}</span>}
          {totalCost > 0 && <span>spent {formatCost(totalCost)}</span>}
        </div>
        <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm text-muted">{task.description}</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {(task.status === "queued" || task.status === "failed") && (
          <Button onClick={startAgent} busy={busy === "start"} primary>
            ▶ {task.status === "failed" ? "Retry agent" : "Start agent"}
          </Button>
        )}
        {isLive && (
          <Button onClick={stopAgent} busy={busy === "stop"} danger>
            ⏹ Stop agent
          </Button>
        )}
        {task.status === "awaiting_review" && (
          <>
            <Button onClick={merge} busy={busy === "merge"} primary>
              ✓ Approve & squash-merge
            </Button>
            <Button onClick={startAgent} busy={busy === "start"}>
              ↻ Fresh run
            </Button>
            <Button onClick={discard} busy={busy === "discard"} danger>
              ✕ Discard work
            </Button>
          </>
        )}
        {actionError && <span className="text-xs text-status-failed">{actionError}</span>}
      </div>

      {/* Tabs */}
      <div className="rounded-lg border border-border bg-surface/50">
        <div className="flex items-center gap-1 border-b border-border px-2 pt-2">
          {(["activity", "diff"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-t-md px-4 py-2 text-sm capitalize transition-colors ${
                tab === t
                  ? "border border-b-0 border-border bg-surface text-foreground"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {t === "activity" ? "Agent activity" : "Diff"}
            </button>
          ))}
          {runs.length > 1 && tab === "activity" && (
            <select
              value={viewedRunId ?? ""}
              onChange={(e) => setSelectedRunId(Number(e.target.value))}
              className="ml-auto mb-2 rounded-md border border-border bg-background px-2 py-1 text-xs text-muted focus:outline-none"
            >
              {runs.map((r, i) => (
                <option key={r.id} value={r.id}>
                  Run #{runs.length - i} · {r.status} · {formatCost(r.costUsd)}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="p-4">
          {tab === "activity" ? (
            runs.length === 0 ? (
              <p className="py-8 text-center text-sm text-faint">
                No agent runs yet. Start the agent to begin.
              </p>
            ) : (
              <AgentTimeline events={events} />
            )
          ) : (
            <DiffViewer taskId={task.id} refreshKey={diffKey} />
          )}
        </div>
      </div>

      {/* Follow-up chat */}
      {task.status === "awaiting_review" && (
        <FeedbackInput onSend={sendFeedback} busy={busy === "feedback"} />
      )}

      {/* Run history */}
      {runs.length > 0 && (
        <div className="rounded-lg border border-border bg-surface/50 p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
            Run history
          </h3>
          <ul className="divide-y divide-border text-sm">
            {runs.map((r, i) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
                <span className="w-14 font-mono text-xs text-faint">#{runs.length - i}</span>
                <StatusBadge status={r.status} />
                <span className="text-xs text-muted">{formatCost(r.costUsd)}</span>
                <span className="text-xs text-muted">
                  {formatTokens(r.inputTokens)} in / {formatTokens(r.outputTokens)} out
                </span>
                <span className="text-xs text-muted">
                  {formatDuration(r.startedAt, r.finishedAt)}
                </span>
                {r.testStatus && r.testStatus !== "skipped" && (
                  <span
                    className={`text-xs ${r.testStatus === "passed" ? "text-status-done" : "text-status-failed"}`}
                  >
                    tests {r.testStatus}
                  </span>
                )}
                {r.errorMessage && (
                  <span className="text-xs text-status-failed">{r.errorMessage}</span>
                )}
                <span className="ml-auto text-xs text-faint">{timeAgo(r.startedAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function FeedbackInput({
  onSend,
  busy,
}: {
  onSend: (text: string) => void;
  busy: boolean;
}) {
  const [text, setText] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        onSend(text.trim());
        setText("");
      }}
      className="flex gap-2 rounded-lg border border-border bg-surface p-3"
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Send follow-up feedback — the agent resumes its session with full context…"
        className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-faint focus:border-accent focus:outline-none"
      />
      <button
        type="submit"
        disabled={busy || !text.trim()}
        className="rounded-md bg-accent-strong px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent disabled:opacity-50"
      >
        {busy ? "Sending…" : "Send"}
      </button>
    </form>
  );
}

function Button({
  children,
  onClick,
  busy,
  primary,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy?: boolean;
  primary?: boolean;
  danger?: boolean;
}) {
  const cls = primary
    ? "bg-accent-strong text-white hover:bg-accent"
    : danger
      ? "border border-status-failed/40 text-status-failed hover:bg-status-failed/10"
      : "border border-border text-muted hover:bg-surface-2 hover:text-foreground";
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${cls}`}
    >
      {busy ? "Working…" : children}
    </button>
  );
}

function requestNotifyPermission() {
  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    Notification.requestPermission();
  }
}
