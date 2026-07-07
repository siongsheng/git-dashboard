"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Task } from "@/db/schema";
import { StatusBadge, TypeBadge } from "@/components/StatusBadge";
import { timeAgo } from "@/lib/format";

const COLUMNS: { key: string; title: string; statuses: string[] }[] = [
  { key: "backlog", title: "Backlog", statuses: ["queued"] },
  { key: "progress", title: "In Progress", statuses: ["running"] },
  { key: "review", title: "In Review", statuses: ["awaiting_review"] },
  { key: "done", title: "Done / Failed", statuses: ["done", "failed"] },
];

export function KanbanBoard({ tasks }: { tasks: Task[] }) {
  const router = useRouter();
  const hasRunning = tasks.some((t) => t.status === "running");

  // Light polling keeps the board fresh while agents are working.
  useEffect(() => {
    if (!hasRunning) return;
    const id = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(id);
  }, [hasRunning, router]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => col.statuses.includes(t.status));
        return (
          <div key={col.key} className="rounded-lg border border-border bg-surface/50">
            <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                {col.title}
              </h3>
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-faint">
                {colTasks.length}
              </span>
            </div>
            <div className="flex min-h-24 flex-col gap-2 p-2">
              {colTasks.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-faint">Empty</p>
              ) : (
                colTasks.map((task) => <TaskCard key={task.id} task={task} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TaskCard({ task }: { task: Task }) {
  const [starting, setStarting] = useState(false);
  const router = useRouter();

  async function startAgent(e: React.MouseEvent) {
    e.preventDefault();
    setStarting(true);
    const res = await fetch(`/api/tasks/${task.id}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setStarting(false);
    if (res.ok) router.push(`/tasks/${task.id}`);
    else router.refresh();
  }

  return (
    <Link
      href={`/tasks/${task.id}`}
      className="group block rounded-md border border-border bg-surface p-3 transition-colors hover:border-border-strong"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium leading-snug group-hover:text-accent">
          {task.title}
        </span>
        <TypeBadge type={task.type} />
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <StatusBadge status={task.status} />
        <span className="text-[11px] text-faint">{timeAgo(task.updatedAt)}</span>
      </div>
      {task.status === "queued" && (
        <button
          onClick={startAgent}
          disabled={starting}
          className="mt-2.5 w-full rounded border border-accent/40 bg-accent/10 px-2 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
        >
          {starting ? "Starting…" : "▶ Start agent"}
        </button>
      )}
    </Link>
  );
}
