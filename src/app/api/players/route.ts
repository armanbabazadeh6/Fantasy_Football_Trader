import { NextRequest, NextResponse } from "next/server";
import { getPlayerSummaries, searchPlayerSummaries } from "@/lib/nfl-data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ids = searchParams.get("ids");
    if (ids) {
      const idSet = new Set(ids.split(",").map((s) => s.trim()).filter(Boolean));
      const summaries = await getPlayerSummaries();
      const players = summaries.filter((p) => idSet.has(p.id));
      return NextResponse.json({ ok: true, players, total: players.length });
    }
    const q = searchParams.get("q") ?? "";
    const pos = searchParams.get("pos") ?? "";
    const limitParam = Number(searchParams.get("limit"));
    const limit = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 20, 1), 100);
    const result = await searchPlayerSummaries(q, pos, limit);
    return NextResponse.json({
      ok: true,
      players: result.players,
      total: result.total,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Failed to load players" },
      { status: 500 }
    );
  }
}
