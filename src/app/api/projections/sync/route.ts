import { NextRequest, NextResponse } from "next/server";
import { projectionsNeedSync, saveLeagueProjections } from "@/lib/projections";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as { leagueId?: string } | null;
    const leagueId = body?.leagueId;
    if (!leagueId || !/^\d{4,12}$/.test(leagueId)) {
      return NextResponse.json(
        { ok: false, error: "leagueId required." },
        { status: 400 }
      );
    }
    if (!projectionsNeedSync()) {
      return NextResponse.json({ ok: true, count: 0, skipped: true });
    }
    const count = await saveLeagueProjections(leagueId, {
      s2: req.headers.get("x-espn-s2") ?? undefined,
      swid: req.headers.get("x-espn-swid") ?? undefined,
      rawCookie: req.headers.get("x-espn-cookie") ?? undefined,
    });
    return NextResponse.json({ ok: true, count });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Projection sync failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
