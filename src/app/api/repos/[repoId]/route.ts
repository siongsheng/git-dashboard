import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, repos } from "@/db";
import { errMessage, jsonError } from "@/lib/api";

type Ctx = { params: Promise<{ repoId: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const { repoId } = await params;
  const repo = getDb().select().from(repos).where(eq(repos.id, Number(repoId))).get();
  if (!repo) return jsonError("Repo not found", 404);
  return NextResponse.json(repo);
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { repoId } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return jsonError("Invalid JSON body");
  try {
    const updated = getDb()
      .update(repos)
      .set({ testCommand: body.testCommand?.trim() || null })
      .where(eq(repos.id, Number(repoId)))
      .returning()
      .get();
    if (!updated) return jsonError("Repo not found", 404);
    return NextResponse.json(updated);
  } catch (err) {
    return jsonError(errMessage(err));
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { repoId } = await params;
  getDb().delete(repos).where(eq(repos.id, Number(repoId))).run();
  return NextResponse.json({ ok: true });
}
