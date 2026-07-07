"use client";

import { useEffect, useState } from "react";
import { formatCost, formatTokens } from "@/lib/format";

// Chart color roles (validated against the dark surface #131519 with the
// dataviz palette validator: contrast >= 3:1, CVD-safe as a set).
const SERIES_COST = "#3987e5";

interface Stats {
  totals: { runs: number; costUsd: number; inputTokens: number; outputTokens: number };
  byRepo: { repoId: number; repoName: string; runs: number; costUsd: number; tasksDone: number }[];
  byModel: {
    model: string;
    runs: number;
    costUsd: number;
    inputTokens: number;
    outputTokens: number;
  }[];
  byDay: { day: string; runs: number; costUsd: number }[];
}

export function StatsView() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  if (!stats) return <p className="py-12 text-center text-sm text-faint">Loading…</p>;

  if (stats.totals.runs === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted">
        No agent runs yet — stats will appear after the first run.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Total spend" value={formatCost(stats.totals.costUsd)} />
        <StatTile label="Agent runs" value={String(stats.totals.runs)} />
        <StatTile label="Input tokens" value={formatTokens(stats.totals.inputTokens)} />
        <StatTile label="Output tokens" value={formatTokens(stats.totals.outputTokens)} />
      </div>

      {/* Spend per day */}
      <section className="rounded-lg border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">Spend per day</h2>
        <p className="mb-4 mt-0.5 text-xs text-muted">USD per calendar day</p>
        <DayBars data={stats.byDay} />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Per repo */}
        <section className="rounded-lg border border-border bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold">Spend by repository</h2>
          <BarTable
            rows={stats.byRepo.map((r) => ({
              label: r.repoName,
              value: r.costUsd,
              detail: `${r.runs} runs · ${r.tasksDone} done`,
            }))}
          />
        </section>

        {/* Per model */}
        <section className="rounded-lg border border-border bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold">Spend by model</h2>
          <BarTable
            rows={stats.byModel.map((m) => ({
              label: m.model,
              value: m.costUsd,
              detail: `${m.runs} runs · ${formatTokens(m.inputTokens)} in / ${formatTokens(m.outputTokens)} out`,
            }))}
          />
        </section>
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
    </div>
  );
}

// Vertical bar chart of spend per day (single measure → single hue).
function DayBars({ data }: { data: { day: string; runs: number; costUsd: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (data.length === 0) return <p className="text-sm text-faint">No data</p>;

  const max = Math.max(...data.map((d) => d.costUsd), 0.01);
  const H = 140;
  const barW = Math.max(10, Math.min(48, Math.floor(720 / data.length) - 4));

  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-1" style={{ height: H + 28 }}>
        {data.map((d, i) => {
          const h = Math.max(3, Math.round((d.costUsd / max) * H));
          return (
            <div
              key={d.day}
              className="relative flex flex-col items-center"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {hover === i && (
                <div className="absolute bottom-full z-10 mb-1 whitespace-nowrap rounded border border-border bg-surface-2 px-2 py-1 text-[11px] shadow-lg">
                  <span className="text-muted">{d.day}</span>{" "}
                  <span className="font-medium">{formatCost(d.costUsd)}</span>{" "}
                  <span className="text-faint">· {d.runs} runs</span>
                </div>
              )}
              <div style={{ height: H - h }} />
              <div
                style={{
                  width: barW,
                  height: h,
                  background: SERIES_COST,
                  borderRadius: "4px 4px 0 0",
                  opacity: hover === null || hover === i ? 1 : 0.45,
                }}
              />
              <span className="mt-1.5 text-[10px] tabular-nums text-faint">
                {d.day.slice(5)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Horizontal bar-in-table: satisfies both the chart and the table view.
function BarTable({
  rows,
}: {
  rows: { label: string; value: number; detail: string }[];
}) {
  if (rows.length === 0) return <p className="text-sm text-faint">No data</p>;
  const max = Math.max(...rows.map((r) => r.value), 0.01);
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium">{r.label}</span>
            <span className="tabular-nums text-muted">{formatCost(r.value)}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-surface-2">
            <div
              className="h-2 rounded-full"
              style={{
                width: `${Math.max(2, (r.value / max) * 100)}%`,
                background: SERIES_COST,
              }}
            />
          </div>
          <p className="mt-0.5 text-[11px] text-faint">{r.detail}</p>
        </div>
      ))}
    </div>
  );
}
