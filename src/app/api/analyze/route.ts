import { NextRequest, NextResponse } from "next/server";
import { aiAnalyzeTrade, aiConfigured, aiModel } from "@/lib/ai";
import { getPlayerBundles } from "@/lib/nfl-data";
import { optimalLineup } from "@/lib/league-intel";
import { computeNeeds, ruleVerdict, sideValue } from "@/lib/value-engine";
import type { AnalyzeResponse, PlayerBundle } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function compactBundle(bundle: PlayerBundle) {
  return {
    name: bundle.name,
    position: bundle.position,
    team: bundle.team ?? "FA",
    age: bundle.age ?? null,
    injury: bundle.injuryStatus ?? null,
    value_score: bundle.value.score ?? "no NFL data (rookie or prospect)",
    tier: bundle.value.tier,
    seasons: bundle.seasons.map((s) => ({
      season: s.season,
      games: s.games,
      total_points: s.total,
      ppg: s.ppg,
      positional_rank: s.posRank ?? null,
      best_week: s.best,
      worst_week: s.worst,
      boom_rate: s.boomRate,
      bust_rate: s.bustRate,
    })),
    trending_adds_24h: bundle.trendCount ?? 0,
    bye_week: bundle.byeWeek ?? null,
    recent_news: bundle.news.map((n) => `[${n.source}] ${n.title}`),
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as {
      give?: unknown;
      get?: unknown;
      myRoster?: unknown;
      rosterSlots?: unknown;
    } | null;

    const giveIds = Array.isArray(body?.give)
      ? [...new Set(body!.give as string[])]
      : [];
    const getIds = Array.isArray(body?.get)
      ? [...new Set(body!.get as string[])]
      : [];
    const myRosterIds = Array.isArray(body?.myRoster)
      ? [...new Set(body!.myRoster as string[])]
      : [];
    const rosterSlots =
      body?.rosterSlots && typeof body.rosterSlots === "object"
        ? (body.rosterSlots as Record<string, number>)
        : null;

    if (giveIds.length === 0 || getIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Both sides of the trade need at least one player." },
        { status: 400 }
      );
    }

    const [give, get, roster] = await Promise.all([
      getPlayerBundles(giveIds),
      getPlayerBundles(getIds),
      myRosterIds.length > 0
        ? getPlayerBundles(myRosterIds)
        : Promise.resolve([] as PlayerBundle[]),
    ]);

    if (give.length === 0 || get.length === 0) {
      return NextResponse.json(
        { ok: false, error: "None of the selected players could be found." },
        { status: 400 }
      );
    }

    const giveValue = sideValue(give.map((b) => b.value.score));
    const getValue = sideValue(get.map((b) => b.value.score));
    const diff = getValue - giveValue;
    const verdict = ruleVerdict(giveValue, getValue);
    const needs = computeNeeds(roster);

    let lineupImpact: AnalyzeResponse["engine"]["lineupImpact"];
    if (rosterSlots && roster.length > 0) {
      const withProjections = (players: PlayerBundle[]): PlayerBundle[] =>
        players.map((p) => ({
          ...p,
          value: { ...p.value, ppg: p.projection?.ppg ?? p.value.ppg },
        }));
      const before = optimalLineup(withProjections(roster), rosterSlots);
      const afterRoster: PlayerBundle[] = [
        ...roster.filter((p) => !giveIds.includes(p.id)),
        ...get,
      ];
      const after = optimalLineup(withProjections(afterRoster), rosterSlots);
      lineupImpact = {
        before: before.projectedTotal,
        after: after.projectedTotal,
        delta: Math.round((after.projectedTotal - before.projectedTotal) * 10) / 10,
      };
    }

    const promptPayload = {
      league_format: "12-team PPR (1.0 point per reception)",
      perspective:
        "The user is SIDE_SEND. Evaluate whether SIDE_SEND should accept this trade.",
      side_send: give.map(compactBundle),
      side_receive: get.map(compactBundle),
      computed_values: {
        side_send_total: giveValue,
        side_receive_total: getValue,
        difference_receive_minus_send: diff,
        rule_based_verdict: verdict,
      },
      rest_of_season: {
        send_projected_points: give.reduce((s, b) => s + (b.projection?.rosPoints ?? 0), 0),
        receive_projected_points: get.reduce((s, b) => s + (b.projection?.rosPoints ?? 0), 0),
        lineup_impact_per_week: lineupImpact?.delta ?? null,
      },
      user_roster_needs: needs,
      user_roster: roster.map(
        (b) => `${b.name} (${b.position}, value ${b.value.score ?? "n/a"})`
      ),
    };

    const ai = aiConfigured()
      ? await aiAnalyzeTrade(JSON.stringify(promptPayload, null, 2))
      : null;

    const response: AnalyzeResponse = {
      ok: true,
      give,
      get,
      engine: { giveValue, getValue, diff, verdict, needs, lineupImpact },
      ai,
      aiConfigured: aiConfigured(),
      model: aiConfigured() ? aiModel() : undefined,
      generatedAt: new Date().toISOString(),
    };
    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Analysis failed. Please try again." },
      { status: 500 }
    );
  }
}
