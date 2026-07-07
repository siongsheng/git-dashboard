"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MODELS, TASK_TYPES, DEFAULT_MODEL } from "@/lib/types";

export function NewTaskButton({ repoId }: { repoId: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-accent-strong px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent"
      >
        + New task
      </button>
      {open && <NewTaskModal repoId={repoId} onClose={() => setOpen(false)} />}
    </>
  );
}

function NewTaskModal({ repoId, onClose }: { repoId: number; onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("feature");
  const [model, setModel] = useState<string>(DEFAULT_MODEL);
  const [budget, setBudget] = useState("");
  const [startNow, setStartNow] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/repos/${repoId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        type,
        model,
        maxBudgetUsd: budget ? Number(budget) : null,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to create task");
      setBusy(false);
      return;
    }
    const task = await res.json();
    if (startNow) {
      await fetch(`/api/tasks/${task.id}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      router.push(`/tasks/${task.id}`);
    } else {
      onClose();
      router.refresh();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg space-y-4 rounded-lg border border-border bg-surface p-6 shadow-2xl"
      >
        <h2 className="text-lg font-semibold">New task</h2>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add multiply function to calc.js"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-faint focus:border-accent focus:outline-none"
            required
            autoFocus
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">
            Description <span className="text-faint">(becomes the agent&apos;s brief)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            placeholder="Describe what to build or fix, acceptance criteria, files to look at…"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-faint focus:border-accent focus:outline-none"
            required
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm focus:border-accent focus:outline-none"
            >
              {TASK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm focus:border-accent focus:outline-none"
            >
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Budget cap ($)</label>
            <input
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              type="number"
              min="0"
              step="0.5"
              placeholder="none"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-faint focus:border-accent focus:outline-none"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={startNow}
            onChange={(e) => setStartNow(e.target.checked)}
            className="accent-[var(--accent-strong)]"
          />
          Start the agent immediately
        </label>

        {error && <p className="text-xs text-status-failed">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm text-muted transition-colors hover:bg-surface-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-accent-strong px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent disabled:opacity-50"
          >
            {busy ? "Creating…" : startNow ? "Create & start agent" : "Create task"}
          </button>
        </div>
      </form>
    </div>
  );
}
