"use client";

import { useEffect, useRef, useState } from "react";

export interface StreamedEvent {
  seq: number;
  eventType: string;
  payload: unknown;
}

export interface DoneInfo {
  runStatus?: string;
  taskStatus?: string;
  costUsd?: number | null;
  testStatus?: string | null;
}

// Subscribes to a run's SSE stream. The server replays persisted events from
// SQLite first, then tails live ones; on browser reconnect EventSource sends
// Last-Event-ID (our seq) so nothing is lost or duplicated (we also dedupe by
// seq against accumulated state).
export function useRunStream(runId: number | null, onDone?: (info: DoneInfo) => void) {
  const [events, setEvents] = useState<StreamedEvent[]>([]);
  const [done, setDone] = useState<DoneInfo | null>(null);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  // Reset accumulated state when switching runs (render-time reset pattern).
  const [prevRunId, setPrevRunId] = useState(runId);
  if (prevRunId !== runId) {
    setPrevRunId(runId);
    setEvents([]);
    setDone(null);
  }

  useEffect(() => {
    if (runId == null) return;

    const source = new EventSource(`/api/runs/${runId}/events`);

    source.addEventListener("run_event", (e) => {
      const data = JSON.parse((e as MessageEvent).data) as StreamedEvent;
      setEvents((prev) =>
        prev.some((ev) => ev.seq === data.seq) ? prev : [...prev, data],
      );
    });

    source.addEventListener("done", (e) => {
      const info = JSON.parse((e as MessageEvent).data) as DoneInfo;
      setDone(info);
      source.close();
      onDoneRef.current?.(info);
    });

    source.onerror = () => {
      // EventSource auto-reconnects; if the run finished between reconnects the
      // server will replay + send done immediately.
    };

    return () => source.close();
  }, [runId]);

  return { events, done };
}
