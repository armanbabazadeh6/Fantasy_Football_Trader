import { NextRequest, NextResponse } from "next/server";
import { mapEspnLeagueToSleeper } from "@/lib/espn";
import {
  getEspnSessionState,
  recordEspnSessionResult,
  rememberEspnLeagueId,
  saveEspnSessionCookie,
} from "@/lib/espn-session";
import type { LeagueResponse } from "@/types";

export const dynamic = "force-dynamic";

const PRIVATE_LEAGUE_MESSAGE =
  "This ESPN league is private. Add your espn_s2 and SWID cookies to load it.";

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

    const rawCookie = req.headers.get("x-espn-cookie") ?? "";
    const s2 = req.headers.get("x-espn-s2") ?? "";
    const swid = req.headers.get("x-espn-swid") ?? "";
    const clientHasCookie = rawCookie.trim().length > 0 || s2.trim().length > 0 || swid.trim().length > 0;

    const creds = {
      s2: s2 || undefined,
      swid: swid || undefined,
      rawCookie: rawCookie || undefined,
    };

    let mapped;
    try {
      mapped = await mapEspnLeagueToSleeper(leagueId, creds);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("private")) {
        return NextResponse.json(
          {
            ok: false,
            error: message || PRIVATE_LEAGUE_MESSAGE,
            sessionExpired: true,
            session: getEspnSessionState(),
          },
          { status: 502 }
        );
      }
      throw err;
    }

    if (clientHasCookie) {
      const cookie =
        rawCookie.trim().length > 0
          ? rawCookie
          : [
              s2.trim() ? `espn_s2=${s2.trim()}` : "",
              swid.trim() ? `SWID=${swid.trim()}` : "",
            ]
              .filter(Boolean)
              .join("; ");
      saveEspnSessionCookie(cookie);
    }
    rememberEspnLeagueId(leagueId);
    recordEspnSessionResult(true);

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
