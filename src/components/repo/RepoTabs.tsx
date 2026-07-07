"use client";

import { useEffect, useState } from "react";
import { timeAgo } from "@/lib/format";

type Tab = "branches" | "commits" | "status";

interface Branch {
  name: string;
  current: boolean;
  commit: string;
  label: string;
}
interface Commit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
}
interface RepoStatus {
  current: string | null;
  staged: string[];
  modified: string[];
  created: string[];
  deleted: string[];
  untracked: string[];
  conflicted: string[];
  isClean: boolean;
}

export function RepoTabs({ repoId }: { repoId: number }) {
  const [tab, setTab] = useState<Tab>("branches");

  return (
    <div className="rounded-lg border border-border bg-surface/50">
      <div className="flex gap-1 border-b border-border px-2 pt-2">
        {(["branches", "commits", "status"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-t-md px-4 py-2 text-sm capitalize transition-colors ${
              tab === t
                ? "border border-b-0 border-border bg-surface text-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="p-4">
        {tab === "branches" && <Branches repoId={repoId} />}
        {tab === "commits" && <Commits repoId={repoId} />}
        {tab === "status" && <WorkingTree repoId={repoId} />}
      </div>
    </div>
  );
}

function useFetch<T>(url: string): { data: T | null; error: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then(async (r) => {
        const body = await r.json();
        if (cancelled) return;
        if (!r.ok) setError(body.error ?? "Request failed");
        else setData(body);
      })
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [url]);
  return { data, error };
}

function Branches({ repoId }: { repoId: number }) {
  const { data, error } = useFetch<{ current: string; branches: Branch[] }>(
    `/api/repos/${repoId}/branches`,
  );
  if (error) return <p className="text-sm text-status-failed">{error}</p>;
  if (!data) return <Loading />;
  return (
    <ul className="divide-y divide-border font-mono text-sm">
      {data.branches.map((b) => (
        <li key={b.name} className="flex items-center gap-3 py-2">
          <span className={b.current ? "text-status-done" : "text-faint"}>
            {b.current ? "●" : "○"}
          </span>
          <span className={b.name.startsWith("agent/") ? "text-accent" : ""}>{b.name}</span>
          <span className="ml-auto text-xs text-faint">{b.commit.slice(0, 7)}</span>
        </li>
      ))}
    </ul>
  );
}

function Commits({ repoId }: { repoId: number }) {
  const { data, error } = useFetch<Commit[]>(`/api/repos/${repoId}/commits`);
  if (error) return <p className="text-sm text-status-failed">{error}</p>;
  if (!data) return <Loading />;
  return (
    <ul className="divide-y divide-border text-sm">
      {data.map((c) => (
        <li key={c.hash} className="flex items-baseline gap-3 py-2">
          <span className="font-mono text-xs text-accent">{c.shortHash}</span>
          <span className="flex-1 truncate">{c.message}</span>
          <span className="text-xs text-faint">{c.author}</span>
          <span className="w-20 text-right text-xs text-faint">
            {timeAgo(new Date(c.date).getTime())}
          </span>
        </li>
      ))}
    </ul>
  );
}

function WorkingTree({ repoId }: { repoId: number }) {
  const { data, error } = useFetch<RepoStatus>(`/api/repos/${repoId}/status`);
  if (error) return <p className="text-sm text-status-failed">{error}</p>;
  if (!data) return <Loading />;
  if (data.isClean)
    return <p className="text-sm text-status-done">Working tree clean on ⎇ {data.current}</p>;

  const groups: { label: string; items: string[]; cls: string }[] = [
    { label: "Staged", items: data.staged, cls: "text-status-done" },
    { label: "Modified", items: data.modified, cls: "text-status-review" },
    { label: "Created", items: data.created, cls: "text-status-done" },
    { label: "Deleted", items: data.deleted, cls: "text-status-failed" },
    { label: "Untracked", items: data.untracked, cls: "text-faint" },
    { label: "Conflicted", items: data.conflicted, cls: "text-status-failed" },
  ];
  return (
    <div className="space-y-4 text-sm">
      {groups
        .filter((group) => group.items.length > 0)
        .map((group) => (
          <div key={group.label}>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">
              {group.label}
            </h4>
            <ul className="font-mono text-xs">
              {group.items.map((f) => (
                <li key={f} className={`${group.cls} py-0.5`}>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
    </div>
  );
}

function Loading() {
  return <p className="py-4 text-center text-sm text-faint">Loading…</p>;
}
