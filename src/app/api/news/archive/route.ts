import { NextRequest, NextResponse } from "next/server";
import { getArchivedNews } from "@/lib/news-archive";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") ?? undefined;
    const category = searchParams.get("category") ?? undefined;
    const since = searchParams.get("since") ?? undefined;
    const limitParam = Number(searchParams.get("limit"));
    const limit = Number.isFinite(limitParam) ? limitParam : undefined;
    const items = await getArchivedNews({ q, category, since, limit });
    return NextResponse.json({ ok: true, items, total: items.length });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Failed to load news archive." },
      { status: 500 }
    );
  }
}
