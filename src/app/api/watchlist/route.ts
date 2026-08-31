import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    const rows = db
      .prepare("SELECT player_id FROM watchlist ORDER BY added_at DESC")
      .all() as { player_id: string }[];
    return NextResponse.json({ ok: true, ids: rows.map((row) => row.player_id) });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to load watchlist." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as {
      playerId?: string;
      watched?: boolean;
    } | null;
    const playerId = body?.playerId;
    if (typeof playerId !== "string" || playerId.length === 0) {
      return NextResponse.json({ ok: false, error: "playerId required." }, { status: 400 });
    }
    const db = getDb();
    if (body?.watched) {
      db.prepare("INSERT OR IGNORE INTO watchlist (player_id, added_at) VALUES (?, ?)").run(
        playerId,
        new Date().toISOString()
      );
    } else {
      db.prepare("DELETE FROM watchlist WHERE player_id = ?").run(playerId);
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to save." }, { status: 500 });
  }
}
