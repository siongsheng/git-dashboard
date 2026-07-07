"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RepoActions({ repoId }: { repoId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Unregister this repository? Files on disk are untouched, but its tasks and run history are deleted.")) return;
    setBusy(true);
    await fetch(`/api/repos/${repoId}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      onClick={remove}
      disabled={busy}
      className="relative z-10 rounded-md px-2 py-1 text-xs text-faint transition-colors hover:bg-surface-2 hover:text-status-failed"
      title="Unregister repository"
    >
      Remove
    </button>
  );
}
