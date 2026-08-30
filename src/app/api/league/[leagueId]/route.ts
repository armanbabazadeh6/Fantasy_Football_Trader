import { NextRequest, NextResponse } from "next/server";
import { computeAllPlayers } from "@/lib/nfl-data";
import {
  fetchLeague,
  fetchLeagueRosters,
  fetchLeagueUsers,
} from "@/lib/sleeper";
import type { LeagueResponse, LeagueTeam, PlayerSummary } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
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

    const [league, rosters, users, computed] = await Promise.all([
      fetchLeague(leagueId),
      fetchLeagueRosters(leagueId),
      fetchLeagueUsers(leagueId),
      computeAllPlayers(),
    ]);

    const usersById = new Map(users.map((u) => [u.user_id, u]));

    const teams: LeagueTeam[] = rosters.map((roster) => {
      const owner = roster.owner_id ? usersById.get(roster.owner_id) : undefined;
      const players: PlayerSummary[] = roster.players
        .map((pid) => computed.get(pid))
        .filter((entry) => entry !== undefined)
        .map((entry) => ({
          id: entry.player.id,
          name: entry.player.name,
          position: entry.player.position,
          team: entry.player.team,
          status: entry.player.status,
          injuryStatus: entry.player.injuryStatus,
          age: entry.player.age,
          rookie: entry.player.rookie,
          value: entry.value,
          posRank: entry.aggs.find((a) => a.games > 0)?.posRank,
          trendCount: entry.trendCount || undefined,
        }))
        .sort((a, b) => (b.value.score ?? -1) - (a.value.score ?? -1));

      return {
        rosterId: roster.roster_id,
        teamName:
          owner?.metadata?.team_name || owner?.display_name || `Team ${roster.roster_id}`,
        displayName: owner?.display_name ?? "",
        wins: roster.settings?.wins ?? 0,
        losses: roster.settings?.losses ?? 0,
        ties: roster.settings?.ties ?? 0,
        fpts:
          (roster.settings?.fpts ?? 0) + (roster.settings?.fpts_decimal ?? 0) / 100,
        players,
        starters: roster.starters,
        totalValue: Math.round(
          players.reduce((sum, p) => sum + (p.value.score ?? 0), 0)
        ),
      };
    });

    teams.sort((a, b) => b.wins - a.wins || b.fpts - a.fpts);

    const rec = league.scoring_settings?.rec ?? 0;
    const scoringLabel = rec >= 1 ? "Full PPR" : rec > 0 ? "Half PPR" : "Standard";

    const response: LeagueResponse = {
      ok: true,
      league: {
        id: league.league_id,
        name: league.name,
        season: league.season,
        totalRosters: league.total_rosters,
        scoringLabel,
      },
      teams,
    };
    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      { ok: false, error: "League not found. Double-check the ID." },
      { status: 404 }
    );
  }
}
