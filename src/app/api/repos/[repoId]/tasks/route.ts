import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb, repos, tasks } from "@/db";
import { DEFAULT_MODEL, MODELS, TASK_TYPES } from "@/lib/types";
import { jsonError } from "@/lib/api";

type Ctx = { params: Promise<{ repoId: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const { repoId } = await params;
  const all = getDb()
    .select()
    .from(tasks)
    .where(eq(tasks.repoId, Number(repoId)))
    .orderBy(desc(tasks.createdAt))
    .all();
  return NextResponse.json(all);
}

export async function POST(request: Request, { params }: Ctx) {
  const { repoId } = await params;
  const db = getDb();
  const repo = db.select().from(repos).where(eq(repos.id, Number(repoId))).get();
  if (!repo) return jsonError("Repo not found", 404);

  const body = await request.json().catch(() => null);
  const title: string | undefined = body?.title?.trim();
  const description: string | undefined = body?.description?.trim();
  const type: string = body?.type ?? "feature";
  const model: string = body?.model ?? DEFAULT_MODEL;
  const maxBudgetUsd: number | null = body?.maxBudgetUsd ? Number(body.maxBudgetUsd) : null;

  if (!title) return jsonError("title is required");
  if (!description) return jsonError("description is required");
  if (!(TASK_TYPES as readonly string[]).includes(type)) return jsonError("invalid type");
  if (!MODELS.some((m) => m.id === model)) return jsonError("invalid model");

  const inserted = db
    .insert(tasks)
    .values({ repoId: repo.id, title, description, type, model, maxBudgetUsd })
    .returning()
    .get();
  return NextResponse.json(inserted, { status: 201 });
}
