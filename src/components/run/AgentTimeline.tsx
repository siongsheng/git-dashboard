"use client";

import type { StreamedEvent } from "./useRunStream";
import { formatCost, formatTokens } from "@/lib/format";

// Renders the raw SDK messages stored per run into a readable activity feed.
// Payload shapes come from @anthropic-ai/claude-agent-sdk (stored verbatim).

/* eslint-disable @typescript-eslint/no-explicit-any */

export function AgentTimeline({ events }: { events: StreamedEvent[] }) {
  if (events.length === 0) {
    return <p className="py-8 text-center text-sm text-faint">Waiting for agent output…</p>;
  }
  return (
    <div className="space-y-2">
      {events.map((ev) => (
        <EventRow key={ev.seq} event={ev} />
      ))}
    </div>
  );
}

function EventRow({ event }: { event: StreamedEvent }) {
  const p = event.payload as any;

  if (p?.type === "system" && p.subtype === "init") {
    return (
      <div className="flex items-center gap-2 px-1 text-xs text-faint">
        <span>◇</span>
        <span>
          Session started · <span className="font-mono">{p.model}</span> ·{" "}
          <span className="font-mono text-[11px]">{p.session_id?.slice(0, 8)}</span>
        </span>
      </div>
    );
  }

  if (p?.type === "assistant") {
    const blocks: any[] = Array.isArray(p.message?.content) ? p.message.content : [];
    return (
      <>
        {blocks.map((block, i) => (
          <AssistantBlock key={i} block={block} />
        ))}
      </>
    );
  }

  if (p?.type === "user") {
    const blocks: any[] = Array.isArray(p.message?.content) ? p.message.content : [];
    const results = blocks.filter((b) => b?.type === "tool_result");
    if (results.length === 0) return null;
    return (
      <>
        {results.map((r, i) => (
          <ToolResult key={i} result={r} />
        ))}
      </>
    );
  }

  if (p?.type === "result") {
    const success = p.subtype === "success" && !p.is_error;
    return (
      <div
        className={`rounded-md border p-3 text-sm ${
          success
            ? "border-status-done/30 bg-status-done/10"
            : "border-status-failed/30 bg-status-failed/10"
        }`}
      >
        <div className="flex items-center gap-2 font-medium">
          {success ? "✓ Run completed" : `✕ Run ended: ${p.subtype}`}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span>{formatCost(p.total_cost_usd)}</span>
          <span>{p.num_turns} turns</span>
          <span>
            {formatTokens(p.usage?.input_tokens)} in / {formatTokens(p.usage?.output_tokens)} out
          </span>
          <span>{Math.round((p.duration_ms ?? 0) / 1000)}s</span>
        </div>
        {success && typeof p.result === "string" && p.result && (
          <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">{p.result}</p>
        )}
      </div>
    );
  }

  if (p?.type === "dashboard_test_result") {
    const passed = p.status === "passed";
    return (
      <div
        className={`rounded-md border p-3 text-sm ${
          passed
            ? "border-status-done/30 bg-status-done/10"
            : "border-status-failed/30 bg-status-failed/10"
        }`}
      >
        <div className="font-medium">
          {passed ? "✓ Tests passed" : "✕ Tests failed"}{" "}
          <span className="font-mono text-xs text-muted">({p.command})</span>
        </div>
        {p.output && (
          <details className="mt-1.5">
            <summary className="cursor-pointer text-xs text-muted">output</summary>
            <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-muted">
              {p.output}
            </pre>
          </details>
        )}
      </div>
    );
  }

  return null;
}

function AssistantBlock({ block }: { block: any }) {
  if (block?.type === "text" && block.text?.trim()) {
    return (
      <div className="rounded-md border border-border bg-surface p-3 text-sm leading-relaxed">
        <p className="whitespace-pre-wrap">{block.text}</p>
      </div>
    );
  }
  if (block?.type === "thinking" && block.thinking?.trim()) {
    return (
      <details className="rounded-md border border-border/60 bg-surface/40 px-3 py-2">
        <summary className="cursor-pointer text-xs italic text-faint">thinking…</summary>
        <p className="mt-1.5 whitespace-pre-wrap text-xs text-muted">{block.thinking}</p>
      </details>
    );
  }
  if (block?.type === "tool_use") {
    return <ToolUse name={block.name} input={block.input} />;
  }
  return null;
}

const TOOL_ICONS: Record<string, string> = {
  Read: "▤",
  Write: "✎",
  Edit: "✎",
  Bash: "❯",
  Glob: "◎",
  Grep: "⌕",
  WebFetch: "⇣",
  TodoWrite: "☑",
  Task: "⚙",
};

function summarizeInput(name: string, input: any): string {
  if (!input || typeof input !== "object") return "";
  if (input.file_path) return String(input.file_path);
  if (input.command) return String(input.command);
  if (input.pattern) return String(input.pattern);
  if (input.url) return String(input.url);
  if (input.description) return String(input.description);
  const keys = Object.keys(input);
  return keys.length ? `${keys[0]}: ${JSON.stringify(input[keys[0]]).slice(0, 80)}` : "";
}

function ToolUse({ name, input }: { name: string; input: any }) {
  const summary = summarizeInput(name, input);
  return (
    <div className="flex items-center gap-2.5 rounded-md border border-border bg-surface-2/60 px-3 py-2 font-mono text-xs">
      <span className="text-accent">{TOOL_ICONS[name] ?? "⚙"}</span>
      <span className="font-semibold text-foreground">{name}</span>
      <span className="truncate text-muted" title={summary}>
        {summary}
      </span>
    </div>
  );
}

function ToolResult({ result }: { result: any }) {
  let text = "";
  if (typeof result.content === "string") text = result.content;
  else if (Array.isArray(result.content)) {
    text = result.content
      .filter((c: any) => c?.type === "text")
      .map((c: any) => c.text)
      .join("\n");
  }
  if (!text.trim()) return null;
  const isError = result.is_error === true;
  return (
    <details className={`rounded-md border px-3 py-1.5 ${isError ? "border-status-failed/40" : "border-border/60"}`}>
      <summary className={`cursor-pointer font-mono text-[11px] ${isError ? "text-status-failed" : "text-faint"}`}>
        {isError ? "tool error" : "tool result"} ({text.length.toLocaleString()} chars)
      </summary>
      <pre className="mt-1.5 max-h-56 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-muted">
        {text.slice(0, 20000)}
      </pre>
    </details>
  );
}
