import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, repos } from "@/db";
import { getLog } from "@/lib/git";
import { errMessage, jsonError } from "@/lib/api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ repoId: string }> },
) {
  const { repoId } = await params;
  const repo = getDb().select().from(repos).where(eq(repos.id, Number(repoId))).get();
  if (!repo) return jsonError("Repo not found", 404);
  const url = new URL(request.url);
  const ref = url.searchParams.get("ref") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? 30);
  try {
    return NextResponse.json(await getLog(repo.path, ref, limit));
  } catch (err) {
    return jsonError(errMessage(err), 500);
  }
}
