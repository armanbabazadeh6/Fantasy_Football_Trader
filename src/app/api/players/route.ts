import { NextRequest, NextResponse } from "next/server";
import {
  getPlayerSummaries,
  listPlayerSummaries,
  searchPlayerSummaries,
} from "@/lib/nfl-data";

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
    const pageParam = searchParams.get("page");
    const pageSizeParam = searchParams.get("pageSize");
    if (pageParam !== null || pageSizeParam !== null) {
      const page = Number(pageParam);
      const pageSize = Number(pageSizeParam);
      const result = await listPlayerSummaries({
        q: searchParams.get("q") ?? undefined,
        pos: searchParams.get("pos") ?? undefined,
        sort: searchParams.get("sort") ?? undefined,
        dir: searchParams.get("dir") ?? undefined,
        page: Number.isFinite(page) && pageParam !== null ? page : undefined,
        pageSize:
          Number.isFinite(pageSize) && pageSizeParam !== null ? pageSize : undefined,
      });
      return NextResponse.json({
        ok: true,
        players: result.players,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      });
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
