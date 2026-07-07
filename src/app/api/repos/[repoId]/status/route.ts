import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, repos } from "@/db";
import { getStatus } from "@/lib/git";
import { errMessage, jsonError } from "@/lib/api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ repoId: string }> },
) {
  const { repoId } = await params;
  const repo = getDb().select().from(repos).where(eq(repos.id, Number(repoId))).get();
  if (!repo) return jsonError("Repo not found", 404);
  try {
    return NextResponse.json(await getStatus(repo.path));
  } catch (err) {
    return jsonError(errMessage(err), 500);
  }
}
