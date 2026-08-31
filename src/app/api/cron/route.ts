import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { startRefreshCycle } from "@/lib/nfl-data";
import { timingSafeEqual } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "Cron secret is not configured." },
      { status: 501 }
    );
  }
  const provided = req.headers.get("x-cron-secret") ?? "";
  if (!timingSafeEqual(provided, secret)) {
    return NextResponse.json(
      { ok: false, error: "Invalid cron secret." },
      { status: 401 }
    );
  }
  const logId = startRefreshCycle();
  const row = getDb()
    .prepare(
      "SELECT id, started_at, finished_at, players, news, ok, error FROM refresh_log WHERE id = ?"
    )
    .get(logId) as Record<string, unknown>;
  return NextResponse.json({ ok: true, refresh: row });
}
