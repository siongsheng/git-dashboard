import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";

// Aggregated cost/usage stats for the dashboard's stats page.
export async function GET() {
  const db = getDb();

  const totals = db.get<{
    runs: number;
    costUsd: number;
    inputTokens: number;
    outputTokens: number;
  }>(sql`
    SELECT COUNT(*) AS runs,
           COALESCE(SUM(cost_usd), 0) AS costUsd,
           COALESCE(SUM(input_tokens), 0) AS inputTokens,
           COALESCE(SUM(output_tokens), 0) AS outputTokens
    FROM agent_runs
  `);

  const byRepo = db.all<{
    repoId: number;
    repoName: string;
    runs: number;
    costUsd: number;
    tasksDone: number;
  }>(sql`
    SELECT r.id AS repoId, r.name AS repoName,
           COUNT(ar.id) AS runs,
           COALESCE(SUM(ar.cost_usd), 0) AS costUsd,
           (SELECT COUNT(*) FROM tasks t2 WHERE t2.repo_id = r.id AND t2.status = 'done') AS tasksDone
    FROM repos r
    LEFT JOIN tasks t ON t.repo_id = r.id
    LEFT JOIN agent_runs ar ON ar.task_id = t.id
    GROUP BY r.id
    ORDER BY costUsd DESC
  `);

  const byModel = db.all<{
    model: string;
    runs: number;
    costUsd: number;
    inputTokens: number;
    outputTokens: number;
  }>(sql`
    SELECT COALESCE(model, 'unknown') AS model,
           COUNT(*) AS runs,
           COALESCE(SUM(cost_usd), 0) AS costUsd,
           COALESCE(SUM(input_tokens), 0) AS inputTokens,
           COALESCE(SUM(output_tokens), 0) AS outputTokens
    FROM agent_runs
    GROUP BY model
    ORDER BY costUsd DESC
  `);

  const byDay = db.all<{ day: string; runs: number; costUsd: number }>(sql`
    SELECT DATE(started_at / 1000, 'unixepoch') AS day,
           COUNT(*) AS runs,
           COALESCE(SUM(cost_usd), 0) AS costUsd
    FROM agent_runs
    GROUP BY day
    ORDER BY day ASC
    LIMIT 60
  `);

  return NextResponse.json({ totals, byRepo, byModel, byDay });
}
