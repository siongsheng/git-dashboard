import { NextResponse } from "next/server";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
