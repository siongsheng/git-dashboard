const TASK_STATUS_STYLES: Record<string, { label: string; cls: string; pulse?: boolean }> = {
  queued: { label: "Backlog", cls: "text-status-queued border-status-queued/30 bg-status-queued/10" },
  running: {
    label: "In Progress",
    cls: "text-status-running border-status-running/30 bg-status-running/10",
    pulse: true,
  },
  awaiting_review: {
    label: "In Review",
    cls: "text-status-review border-status-review/30 bg-status-review/10",
  },
  done: { label: "Done", cls: "text-status-done border-status-done/30 bg-status-done/10" },
  failed: { label: "Failed", cls: "text-status-failed border-status-failed/30 bg-status-failed/10" },
  // run statuses
  starting: {
    label: "Starting",
    cls: "text-status-running border-status-running/30 bg-status-running/10",
    pulse: true,
  },
  completed: { label: "Completed", cls: "text-status-done border-status-done/30 bg-status-done/10" },
  cancelled: {
    label: "Cancelled",
    cls: "text-status-queued border-status-queued/30 bg-status-queued/10",
  },
};

export function StatusBadge({ status }: { status: string }) {
  const s = TASK_STATUS_STYLES[status] ?? {
    label: status,
    cls: "text-muted border-border bg-surface-2",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${s.cls}`}
    >
      {s.pulse && <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-current" />}
      {s.label}
    </span>
  );
}

const TYPE_STYLES: Record<string, string> = {
  feature: "text-accent border-accent/30 bg-accent/10",
  bug: "text-status-failed border-status-failed/30 bg-status-failed/10",
  chore: "text-muted border-border-strong bg-surface-2",
};

export function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${TYPE_STYLES[type] ?? TYPE_STYLES.chore}`}
    >
      {type}
    </span>
  );
}
