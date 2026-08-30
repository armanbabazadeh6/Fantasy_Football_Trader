import { NextRequest, NextResponse } from "next/server";
import { searchPlayerSummaries } from "@/lib/nfl-data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
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
