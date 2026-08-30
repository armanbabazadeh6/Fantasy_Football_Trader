import { NextRequest, NextResponse } from "next/server";
import {
  buildSleeperIndexes,
  espnPlayerName,
  fetchEspnLeague,
  fetchEspnTransactions,
  matchEspnPlayer,
  normalizeEspnPosition,
  type EspnCredentials,
  type EspnTransaction,
  type EspnTransactionItem,
  type SleeperIndexes,
} from "@/lib/espn";
import { computeAllPlayers } from "@/lib/nfl-data";
import type { LeagueTrade, LeagueTradeTeam, TradeSidePlayer } from "@/types";

export const dynamic = "force-dynamic";

type EspnPlayerRef = NonNullable<EspnTransactionItem["player"]>;

function parseTrade(
  transaction: EspnTransaction,
  teamNames: Map<number, string>,
  valueOf: (player: EspnPlayerRef) => number | null
): LeagueTrade | null {
  const teamsMap = new Map<number, LeagueTradeTeam>();

  const ensureTeam = (teamId: number): LeagueTradeTeam => {
    let team = teamsMap.get(teamId);
    if (!team) {
      team = {
        teamId,
        teamName: teamNames.get(teamId) ?? `Team ${teamId}`,
        incoming: [],
        outgoing: [],
        netValue: 0,
      };
      teamsMap.set(teamId, team);
    }
    return team;
  };

  for (const item of transaction.items ?? []) {
    const player = item.player ?? item.playerPoolEntry?.player;
    const fromTeamId = item.fromTeamId;
    const toTeamId = item.toTeamId;
    if (!player) continue;
    if (typeof fromTeamId !== "number" || typeof toTeamId !== "number") continue;
    if (fromTeamId === toTeamId) continue;

    const sidePlayer: TradeSidePlayer = {
      name: espnPlayerName(player) || "Unknown player",
      position: normalizeEspnPosition(player.position),
      team: player.proTeam ?? null,
      valueScore: valueOf(player),
    };
    ensureTeam(fromTeamId).outgoing.push(sidePlayer);
    ensureTeam(toTeamId).incoming.push(sidePlayer);
  }

  if (teamsMap.size < 2) return null;

  const teams = [...teamsMap.values()].map((team) => ({
    ...team,
    netValue: Math.round(
      team.incoming.reduce((sum, player) => sum + (player.valueScore ?? 0), 0) -
        team.outgoing.reduce((sum, player) => sum + (player.valueScore ?? 0), 0)
    ),
  }));
  teams.sort((a, b) => b.netValue - a.netValue);

  let winnerTeamId: number | null = null;
  let maxNet = 0;
  for (const team of teams) {
    if (team.netValue > maxNet) {
      maxNet = team.netValue;
      winnerTeamId = team.teamId;
    }
  }

  return {
    id: transaction.id ?? Date.now(),
    date:
      typeof transaction.date === "number"
        ? new Date(transaction.date).toISOString()
        : new Date().toISOString(),
    status: transaction.status ?? "complete",
    teams,
    winnerTeamId,
    maxNet,
  };
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

    const creds: EspnCredentials = {
      s2: req.headers.get("x-espn-s2") ?? undefined,
      swid: req.headers.get("x-espn-swid") ?? undefined,
    };

    const [espnLeague, transactions, computed] = await Promise.all([
      fetchEspnLeague(leagueId, creds),
      fetchEspnTransactions(leagueId, creds),
      computeAllPlayers(),
    ]);

    const indexes: SleeperIndexes = buildSleeperIndexes(computed);
    const valueBySleeperId = new Map<string, number | null>();
    for (const [id, entry] of computed.entries()) {
      valueBySleeperId.set(id, entry.value.score);
    }

    const valueOf = (player: EspnPlayerRef): number | null => {
      const matched = matchEspnPlayer(player, indexes);
      if (!matched) return null;
      return valueBySleeperId.get(matched.id) ?? null;
    };

    const teamNames = new Map<number, string>();
    for (const team of espnLeague.teams) {
      if (typeof team.id === "number") {
        teamNames.set(
          team.id,
          `${team.location ?? ""} ${team.nickname ?? ""}`.trim() ||
            team.abbrev ||
            `Team ${team.id}`
        );
      }
    }

    const trades: LeagueTrade[] = [];
    for (const transaction of transactions) {
      if ((transaction.type ?? "").toLowerCase() !== "trade") continue;
      const parsed = parseTrade(transaction, teamNames, valueOf);
      if (parsed) trades.push(parsed);
    }
    trades.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

    return NextResponse.json({
      ok: true,
      trades: trades.slice(0, 40),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not load league trades.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
