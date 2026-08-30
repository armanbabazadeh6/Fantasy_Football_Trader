import { NextResponse } from "next/server";
import { getTrendingSummaries } from "@/lib/nfl-data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const players = await getTrendingSummaries(20);
    return NextResponse.json({ ok: true, players });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Failed to load trending players" },
      { status: 500 }
    );
  }
}
