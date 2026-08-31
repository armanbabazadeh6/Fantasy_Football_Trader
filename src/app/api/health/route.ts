import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const last = db
    .prepare(
      "SELECT started_at, finished_at, ok FROM refresh_log ORDER BY id DESC LIMIT 1"
    )
    .get() as { started_at: string; finished_at: string | null; ok: number | null } | undefined;
  return NextResponse.json({
    ok: true,
    uptime: Math.round(process.uptime()),
    lastRefresh: last
      ? {
          startedAt: last.started_at,
          finishedAt: last.finished_at,
          ok: last.ok,
        }
      : null,
  });
}
