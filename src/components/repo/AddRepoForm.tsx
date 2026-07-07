"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AddRepoForm() {
  const router = useRouter();
  const [path, setPath] = useState("");
  const [testCommand, setTestCommand] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/repos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, testCommand }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to add repository");
      return;
    }
    setPath("");
    setTestCommand("");
    router.refresh();
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-start"
    >
      <div className="flex-1">
        <input
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="/absolute/path/to/repo"
          className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm placeholder:text-faint focus:border-accent focus:outline-none"
          required
        />
        {error && <p className="mt-2 text-xs text-status-failed">{error}</p>}
      </div>
      <input
        value={testCommand}
        onChange={(e) => setTestCommand(e.target.value)}
        placeholder="Test command (optional, e.g. npm test)"
        className="rounded-md border border-border bg-background px-3 py-2 font-mono text-sm placeholder:text-faint focus:border-accent focus:outline-none sm:w-64"
      />
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-accent-strong px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent disabled:opacity-50"
      >
        {busy ? "Validating…" : "Add repo"}
      </button>
    </form>
  );
}
