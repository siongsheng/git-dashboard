import { NextResponse } from "next/server";
import { getRunManager } from "@/server/run-manager";
import { errMessage, jsonError } from "@/lib/api";

// Follow-up feedback: resumes the task's last agent session with the
// reviewer's message as the new prompt.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await params;
  const body = await request.json().catch(() => null);
  const text: string | undefined = body?.text?.trim();
  if (!text) return jsonError("text is required");
  try {
    const { runId } = await getRunManager().startRun(Number(taskId), {
      mode: "resume",
      followUpPrompt: text,
    });
    return NextResponse.json({ runId }, { status: 202 });
  } catch (err) {
    return jsonError(errMessage(err), 409);
  }
}
