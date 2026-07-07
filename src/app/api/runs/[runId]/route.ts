import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, agentRuns } from "@/db";
import { jsonError } from "@/lib/api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const run = getDb().select().from(agentRuns).where(eq(agentRuns.id, Number(runId))).get();
  if (!run) return jsonError("Run not found", 404);
  return NextResponse.json(run);
}
