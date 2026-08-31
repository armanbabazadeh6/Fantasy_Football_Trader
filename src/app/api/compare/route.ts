import { NextRequest, NextResponse } from "next/server";
import { getPlayerBundles } from "@/lib/nfl-data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const a = searchParams.get("a") ?? "";
    const b = searchParams.get("b") ?? "";
    if (!a || !b || a === b) {
      return NextResponse.json(
        { ok: false, error: "Provide two different player ids (a, b)." },
        { status: 400 }
      );
    }
    const players = await getPlayerBundles([a, b]);
    if (players.length < 2) {
      return NextResponse.json(
        { ok: false, error: "One of the players could not be found." },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true, players });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Comparison failed." },
      { status: 500 }
    );
  }
}
