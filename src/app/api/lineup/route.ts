import { NextRequest, NextResponse } from "next/server";
import { getPlayerBundles } from "@/lib/nfl-data";
import { optimalLineup, computeTightCalls, type LineupPlayerInfo } from "@/lib/league-intel";
import { getCurrentWeek, fetchWeekMatchups } from "@/lib/schedule";
import { getWeeklyProjection } from "@/lib/projections";
import type { PlayerBundle } from "@/types";

export const dynamic = "force-dynamic";

const DEFAULT_SLOTS: Record<string, number> = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  FLEX: 1,
  K: 1,
  DEF: 1,
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as {
      players?: unknown;
      rosterSlots?: unknown;
    } | null;

    const ids = Array.isArray(body?.players)
      ? [...new Set(body!.players as string[])].slice(0, 40)
      : [];
    if (ids.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No players provided." },
        { status: 400 }
      );
    }

    const rosterSlots =
      body?.rosterSlots && typeof body.rosterSlots === "object"
        ? (body.rosterSlots as Record<string, number>)
        : DEFAULT_SLOTS;

    const [bundles, currentWeek] = await Promise.all([
      getPlayerBundles(ids),
      getCurrentWeek(),
    ]);
    if (bundles.length === 0) {
      return NextResponse.json(
        { ok: false, error: "None of the players could be found." },
        { status: 400 }
      );
    }

    const nextWeek = Math.max(1, currentWeek + 1);
    const matchups = await fetchWeekMatchups(nextWeek);

    const infos = new Map<string, LineupPlayerInfo>();
    const effective: PlayerBundle[] = bundles.map((bundle) => {
      const weekly = getWeeklyProjection(bundle.id, nextWeek);
      const isBye = bundle.byeWeek === nextWeek;
      const blend = bundle.projection?.ppg ?? null;
      const season = bundle.value.ppg ?? null;
      const points = isBye
        ? 0
        : (weekly?.points ?? blend ?? season ?? 0);
      const source: LineupPlayerInfo["source"] = isBye
        ? "none"
        : weekly
          ? "weekly"
          : blend !== null
            ? "blend"
            : season !== null
              ? "season"
              : "none";
      const matchup = bundle.team ? matchups[bundle.team] : undefined;
      infos.set(bundle.id, {
        id: bundle.id,
        name: bundle.name,
        position: bundle.position,
        team: bundle.team,
        points: Math.round(points * 10) / 10,
        source,
        opponent: matchup ? matchup.opponent : null,
        homeAway: matchup ? matchup.homeAway : null,
        isBye,
        valueScore: bundle.value.score ?? null,
        injuryStatus: bundle.injuryStatus ?? undefined,
      });
      return {
        ...bundle,
        value: { ...bundle.value, ppg: points },
      };
    });

    const lineup = optimalLineup(
      effective.map((b) => ({
        ...b,
        value: { ...b.value },
      })),
      rosterSlots
    );

    const starters = lineup.starters.map((slot) => ({
      slot: slot.slot,
      player: slot.player ? infos.get(slot.player.id) ?? null : null,
    }));
    const bench = lineup.bench
      .map((player) => infos.get(player.id))
      .filter((info): info is LineupPlayerInfo => Boolean(info));
    const tightCalls = computeTightCalls(starters, bench);

    return NextResponse.json({
      ok: true,
      week: nextWeek,
      starters,
      bench,
      projectedTotal: lineup.projectedTotal,
      tightCalls: tightCalls.slice(0, 5),
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Lineup optimization failed. Please try again." },
      { status: 500 }
    );
  }
}
