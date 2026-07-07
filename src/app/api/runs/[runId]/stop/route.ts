import { NextResponse } from "next/server";
import { getRunManager } from "@/server/run-manager";
import { errMessage, jsonError } from "@/lib/api";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  try {
    await getRunManager().stopRun(Number(runId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(errMessage(err), 409);
  }
}
