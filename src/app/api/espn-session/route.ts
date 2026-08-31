import { NextRequest, NextResponse } from "next/server";
import {
  clearEspnSession,
  getEspnSessionState,
  recordEspnSessionResult,
} from "@/lib/espn-session";
import { fetchEspnLeague } from "@/lib/espn";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, session: getEspnSessionState() });
}

export async function DELETE() {
  clearEspnSession();
  return NextResponse.json({ ok: true, session: getEspnSessionState() });
}

export async function POST(req: NextRequest) {
  const state = getEspnSessionState();
  const { searchParams } = new URL(req.url);
  const leagueId = searchParams.get("leagueId") ?? state.leagueId;
  if (!leagueId || !/^\d{4,12}$/.test(leagueId)) {
    return NextResponse.json(
      { ok: false, error: "No league ID remembered. Load a league first." },
      { status: 400 }
    );
  }
  if (state.updatedAt === null) {
    return NextResponse.json(
      {
        ok: false,
        error: "No stored ESPN session. Paste your cookie on the league page first.",
        sessionMissing: true,
        session: state,
      },
      { status: 400 }
    );
  }
  try {
    await fetchEspnLeague(leagueId, {});
    return NextResponse.json({
      ok: true,
      session: getEspnSessionState(),
      result: "ok",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    const expired = message.includes("private");
    if (expired) {
      recordEspnSessionResult(false);
    }
    return NextResponse.json(
      {
        ok: false,
        error: expired
          ? "ESPN session expired. Paste a fresh cookie below."
          : message || "ESPN session test failed.",
        sessionExpired: expired,
        session: getEspnSessionState(),
      },
      { status: expired ? 502 : 500 }
    );
  }
}
