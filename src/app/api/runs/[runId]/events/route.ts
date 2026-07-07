import { and, asc, eq, gt } from "drizzle-orm";
import { getDb, agentRuns, runEvents, tasks } from "@/db";
import { getRunManager } from "@/server/run-manager";
import type { RunStreamEvent } from "@/server/run-events";
import { jsonError } from "@/lib/api";

const TERMINAL_RUN_STATUSES = new Set(["completed", "failed", "cancelled"]);

// SSE stream of a run's events with lossless replay: persisted events after
// ?afterSeq are replayed from SQLite, then live events are tailed from the
// in-memory run emitter (deduped by seq).
export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId: runIdParam } = await params;
  const runId = Number(runIdParam);
  const db = getDb();
  const run = db.select().from(agentRuns).where(eq(agentRuns.id, runId)).get();
  if (!run) return jsonError("Run not found", 404);

  const url = new URL(request.url);
  const afterSeq = Number(
    url.searchParams.get("afterSeq") ?? request.headers.get("last-event-id") ?? 0,
  );

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let lastSent = afterSeq;
      let closed = false;

      const send = (seq: number, eventType: string, payload: unknown) => {
        if (closed || seq <= lastSent) return;
        lastSent = seq;
        controller.enqueue(
          encoder.encode(
            `id: ${seq}\nevent: run_event\ndata: ${JSON.stringify({ seq, eventType, payload })}\n\n`,
          ),
        );
      };

      const finish = () => {
        if (closed) return;
        closed = true;
        const currentRun = db.select().from(agentRuns).where(eq(agentRuns.id, runId)).get();
        const task = currentRun
          ? db.select().from(tasks).where(eq(tasks.id, currentRun.taskId)).get()
          : null;
        try {
          controller.enqueue(
            encoder.encode(
              `event: done\ndata: ${JSON.stringify({
                runStatus: currentRun?.status,
                taskStatus: task?.status,
                costUsd: currentRun?.costUsd,
                testStatus: currentRun?.testStatus,
              })}\n\n`,
            ),
          );
          controller.close();
        } catch {
          // controller already closed
        }
        cleanup();
      };

      // 1) Replay persisted events.
      const persisted = db
        .select()
        .from(runEvents)
        .where(and(eq(runEvents.runId, runId), gt(runEvents.seq, afterSeq)))
        .orderBy(asc(runEvents.seq))
        .all();
      for (const ev of persisted) {
        send(ev.seq, ev.eventType, JSON.parse(ev.payload));
      }

      // 2) Tail live events if the run is still active.
      const active = getRunManager().getActiveRun(runId);
      const onEvent = (ev: RunStreamEvent) => send(ev.seq, ev.eventType, ev.payload);
      const onTerminal = () => finish();
      const cleanup = () => {
        active?.emitter.off("event", onEvent);
        active?.emitter.off("terminal", onTerminal);
        clearInterval(heartbeat);
      };

      if (active) {
        active.emitter.on("event", onEvent);
        active.emitter.on("terminal", onTerminal);
        // Events emitted between the replay query and subscription are caught
        // by re-querying once; send() dedupes by seq.
        const gap = db
          .select()
          .from(runEvents)
          .where(and(eq(runEvents.runId, runId), gt(runEvents.seq, lastSent)))
          .orderBy(asc(runEvents.seq))
          .all();
        for (const ev of gap) send(ev.seq, ev.eventType, JSON.parse(ev.payload));
      }

      // Keep the connection alive through proxies/buffers.
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          cleanup();
        }
      }, 15000);

      if (!active || TERMINAL_RUN_STATUSES.has(run.status)) {
        finish();
        return;
      }

      request.signal.addEventListener("abort", () => {
        closed = true;
        cleanup();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
