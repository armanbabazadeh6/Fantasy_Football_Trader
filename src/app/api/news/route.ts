import { NextRequest, NextResponse } from "next/server";
import { fetchNews } from "@/lib/news";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim().toLowerCase();
    const limitParam = Number(searchParams.get("limit"));
    const limit = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 50, 1), 200);
    const news = await fetchNews();
    const filtered = q
      ? news.filter((item) =>
          `${item.title} ${item.summary}`.toLowerCase().includes(q)
        )
      : news;
    return NextResponse.json({
      ok: true,
      items: filtered.slice(0, limit),
      total: filtered.length,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Failed to load news" },
      { status: 500 }
    );
  }
}
