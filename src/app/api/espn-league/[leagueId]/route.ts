import { NextRequest, NextResponse } from "next/server";
import { mapEspnLeagueToSleeper } from "@/lib/espn";
import {
  getEspnSessionState,
  recordEspnSessionResult,
  rememberEspnLeagueId,
  saveEspnSessionCookie,
} from "@/lib/espn-session";
import { authEnabled } from "@/lib/session";
import type { LeagueResponse } from "@/types";

export const dynamic = "force-dynamic";

const LEAGUE_CACHE_TTL_MS = 60 * 1000;
const LEAGUE_CACHE_MAX_ENTRIES = 50;

const globalForLeagueCache = globalThis as unknown as {
  __fftLeagueCache?: Map<string, { at: number; payload: LeagueResponse }>;
};

const PRIVATE_LEAGUE_MESSAGE =
  "This ESPN league is private. Add your espn_s2 and SWID cookies to load it.";

function cacheKeyFor(leagueId: string, rawCookie: string, s2: string, swid: string): string {
  if (rawCookie.length === 0 && s2.length === 0 && swid.length === 0) {
    return `${leagueId}:anon`;
  }
  // FNV-1a over the concatenated credential material: cheap, stable, no crypto import.
  const material = `${rawCookie}\n${s2}\n${swid}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < material.length; i++) {
    hash ^= material.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${leagueId}:${hash.toString(16)}`;
}

function setLeagueCacheEntry(
  cache: Map<string, { at: number; payload: LeagueResponse }>,
  key: string,
  payload: LeagueResponse
): void {
  cache.set(key, { at: Date.now(), payload });
  while (cache.size > LEAGUE_CACHE_MAX_ENTRIES) {
    let oldestKey: string | null = null;
    let oldestAt = Infinity;
    for (const [k, entry] of cache) {
      if (entry.at < oldestAt) {
        oldestAt = entry.at;
        oldestKey = k;
      }
    }
    if (oldestKey === null) break;
    cache.delete(oldestKey);
  }
}

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

    const cache =
      globalForLeagueCache.__fftLeagueCache ??
      (globalForLeagueCache.__fftLeagueCache = new Map<
        string,
        { at: number; payload: LeagueResponse }
      >());

    let rawCookie = req.headers.get("x-espn-cookie") ?? "";
    let s2 = req.headers.get("x-espn-s2") ?? "";
    let swid = req.headers.get("x-espn-swid") ?? "";
    // Bug 13: with auth disabled, anonymous visitors could poison the shared
    // session store via credential headers — ignore them entirely.
    if (!authEnabled()) {
      rawCookie = "";
      s2 = "";
      swid = "";
    }
    const clientHasCookie = rawCookie.trim().length > 0 || s2.trim().length > 0 || swid.trim().length > 0;

    const cacheKey = cacheKeyFor(leagueId, rawCookie, s2, swid);
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.at < LEAGUE_CACHE_TTL_MS) {
      return NextResponse.json(cached.payload);
    }

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
    // Only a success that used the persisted shared session (no caller
    // credentials) marks that session healthy (bug 8).
    if (!clientHasCookie) {
      recordEspnSessionResult(true);
    }

    const response: LeagueResponse = {
      ok: true,
      platform: "ESPN",
      league: mapped.league,
      teams: mapped.teams,
      unmatched: mapped.unmatched,
    };
    setLeagueCacheEntry(cache, cacheKey, response);
    return NextResponse.json(response);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not load this ESPN league.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
