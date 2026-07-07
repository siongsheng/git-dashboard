import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb, repos } from "@/db";
import { validateRepo } from "@/lib/git";
import { errMessage, jsonError } from "@/lib/api";

export async function GET() {
  const db = getDb();
  const all = db.select().from(repos).orderBy(desc(repos.createdAt)).all();
  return NextResponse.json(all);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const repoPath: string | undefined = body?.path?.trim();
  const testCommand: string | null = body?.testCommand?.trim() || null;
  if (!repoPath) return jsonError("path is required");
  if (!repoPath.startsWith("/")) return jsonError("path must be absolute");

  try {
    const info = await validateRepo(repoPath);
    const db = getDb();
    const existing = db.select().from(repos).where(eq(repos.path, repoPath)).get();
    if (existing) return jsonError("Repository already registered", 409);
    const inserted = db
      .insert(repos)
      .values({
        name: info.name,
        path: repoPath,
        defaultBranch: info.defaultBranch,
        testCommand,
      })
      .returning()
      .get();
    return NextResponse.json(inserted, { status: 201 });
  } catch (err) {
    return jsonError(errMessage(err));
  }
}
