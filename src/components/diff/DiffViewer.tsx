"use client";

import { useEffect, useState } from "react";

interface TaskDiff {
  stat: string;
  patch: string;
  hasCommits: boolean;
  hasUncommitted: boolean;
}

export function DiffViewer({ taskId, refreshKey }: { taskId: number; refreshKey: number }) {
  const [diff, setDiff] = useState<TaskDiff | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/tasks/${taskId}/diff`)
      .then(async (r) => {
        const body = await r.json();
        if (cancelled) return;
        if (!r.ok) setError(body.error ?? "Failed to load diff");
        else setDiff(body);
      })
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [taskId, refreshKey]);

  if (error) return <p className="text-sm text-status-failed">{error}</p>;
  if (!diff) return <p className="py-8 text-center text-sm text-faint">Loading diff…</p>;
  if (!diff.patch.trim())
    return (
      <p className="py-8 text-center text-sm text-faint">
        No changes yet — the agent hasn&apos;t produced work on this branch.
      </p>
    );

  return (
    <div className="space-y-4">
      {diff.stat && (
        <pre className="overflow-x-auto rounded-md border border-border bg-surface p-3 font-mono text-xs text-muted">
          {diff.stat.trim()}
        </pre>
      )}
      {diff.hasUncommitted && (
        <p className="text-xs text-status-review">
          ⚠ Includes uncommitted changes still sitting in the agent&apos;s worktree.
        </p>
      )}
      <UnifiedDiff patch={diff.patch} />
    </div>
  );
}

function UnifiedDiff({ patch }: { patch: string }) {
  const files = splitPatch(patch);
  return (
    <div className="space-y-4">
      {files.map((file, i) => (
        <div key={i} className="overflow-hidden rounded-md border border-border">
          <div className="border-b border-border bg-surface-2 px-3 py-2 font-mono text-xs font-semibold">
            {file.name}
          </div>
          <pre className="max-h-[32rem] overflow-auto bg-surface font-mono text-[11.5px] leading-5">
            {file.lines.map((line, j) => (
              <div
                key={j}
                className={`px-3 ${
                  line.startsWith("+") && !line.startsWith("+++")
                    ? "diff-line-add text-status-done"
                    : line.startsWith("-") && !line.startsWith("---")
                      ? "diff-line-del text-status-failed"
                      : line.startsWith("@@")
                        ? "text-accent"
                        : "text-muted"
                }`}
              >
                {line || " "}
              </div>
            ))}
          </pre>
        </div>
      ))}
    </div>
  );
}

function splitPatch(patch: string): { name: string; lines: string[] }[] {
  const files: { name: string; lines: string[] }[] = [];
  let current: { name: string; lines: string[] } | null = null;
  for (const line of patch.split("\n")) {
    if (line.startsWith("diff --git")) {
      const m = line.match(/ b\/(.+)$/);
      current = { name: m?.[1] ?? line, lines: [] };
      files.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (files.length === 0 && patch.trim()) {
    files.push({ name: "changes", lines: patch.split("\n") });
  }
  return files;
}
