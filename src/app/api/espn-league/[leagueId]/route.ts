import { NextRequest, NextResponse } from "next/server";
import { mapEspnLeagueToSleeper } from "@/lib/espn";
import type { LeagueResponse } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ leagueId: string }> }
) {
  try {
    const { leagueId } = await ctx.params;
    if (!/^\d{4,12}$/.test(leagueId)) {
      return NextResponse.json(
        { ok: false, error: "Invalid league ID." },
        { status: 400 }
      );
    }

    const s2 = req.headers.get("x-espn-s2") ?? undefined;
    const swid = req.headers.get("x-espn-swid") ?? undefined;

    const mapped = await mapEspnLeagueToSleeper(leagueId, { s2, swid });

    const response: LeagueResponse = {
      ok: true,
      platform: "ESPN",
      league: mapped.league,
      teams: mapped.teams,
      unmatched: mapped.unmatched,
    };
    return NextResponse.json(response);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not load this ESPN league.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
