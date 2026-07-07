import { NextResponse } from "next/server";
import { getRunManager } from "@/server/run-manager";
import { errMessage, jsonError } from "@/lib/api";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await params;
  const body = await request.json().catch(() => ({}));
  const mode = body?.mode === "resume" ? "resume" : "fresh";
  try {
    const { runId } = await getRunManager().startRun(Number(taskId), { mode });
    return NextResponse.json({ runId }, { status: 202 });
  } catch (err) {
    return jsonError(errMessage(err), 409);
  }
}
