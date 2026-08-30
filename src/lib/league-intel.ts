import type {
  LeagueTeam,
  LineupSlot,
  OptimalLineup,
  PlayerSummary,
  PowerRank,
  TradePartner,
  TradePartnerTarget,
} from "@/types";

function normalize(values: number[]): (value: number) => number {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  if (range <= 0) {
    return () => 0.5;
  }
  return (value) => (value - min) / range;
}

export function powerRankings(teams: LeagueTeam[]): PowerRank[] {
  if (teams.length === 0) return [];

  const valueNorm = normalize(teams.map((team) => team.totalValue));
  const fptsNorm = normalize(teams.map((team) => team.fpts));

  const scored = teams.map((team, standingIndex) => {
    const gamesPlayed = team.wins + team.losses + team.ties;
    const winPct =
      gamesPlayed > 0 ? (team.wins + team.ties * 0.5) / gamesPlayed : 0.5;
    const powerScore =
      (0.55 * valueNorm(team.totalValue) +
        0.25 * winPct +
        0.2 * fptsNorm(team.fpts)) *
      100;
    return {
      rosterId: team.rosterId,
      teamName: team.teamName,
      record: `${team.wins}-${team.losses}${team.ties > 0 ? `-${team.ties}` : ""}`,
      totalValue: team.totalValue,
      topPlayers: team.players.slice(0, 3).map((player) => player.name),
      powerScore,
      rank: 0,
      standingRank: standingIndex + 1,
      movement: 0,
    };
  });

  scored.sort((a, b) => b.powerScore - a.powerScore);
  scored.forEach((entry, index) => {
    entry.rank = index + 1;
    entry.movement = entry.standingRank - entry.rank;
  });
  return scored;
}

function groupByPosition(players: PlayerSummary[]): Map<string, PlayerSummary[]> {
  const groups = new Map<string, PlayerSummary[]>();
  for (const player of players) {
    groups.set(player.position, [...(groups.get(player.position) ?? []), player]);
  }
  for (const [position, group] of groups) {
    group.sort((a, b) => (b.value.score ?? -1) - (a.value.score ?? -1));
    groups.set(position, group);
  }
  return groups;
}

const CORE_POSITIONS = ["QB", "RB", "WR", "TE"];

export function findTradePartners(
  teams: LeagueTeam[],
  myRosterId: number
): TradePartner[] {
  const me = teams.find((team) => team.rosterId === myRosterId);
  if (!me) return [];

  const myGroups = groupByPosition(me.players);
  const myNeeds = CORE_POSITIONS.filter((position) => {
    const group = myGroups.get(position) ?? [];
    return (group[0]?.value.score ?? 0) < 55;
  });
  const mySurplus = CORE_POSITIONS.filter((position) => {
    const group = myGroups.get(position) ?? [];
    return group.filter((player) => (player.value.score ?? 0) >= 50).length >= 2;
  });

  if (myNeeds.length === 0) return [];

  const partners: TradePartner[] = [];
  for (const team of teams) {
    if (team.rosterId === myRosterId) continue;
    const theirGroups = groupByPosition(team.players);

    const targets: TradePartnerTarget[] = [];
    for (const position of myNeeds) {
      const group = theirGroups.get(position) ?? [];
      const surplusPlayers = group.filter((player) => (player.value.score ?? 0) >= 50);
      if (surplusPlayers.length < 2) continue;
      const myBest = myGroups.get(position)?.[0]?.value.score ?? 0;
      const target = surplusPlayers[1];
      if ((target.value.score ?? 0) > myBest) {
        targets.push({
          position,
          targetName: target.name,
          targetScore: target.value.score ?? 0,
          blockedBy: surplusPlayers[0].name,
        });
      }
    }
    if (targets.length === 0) continue;

    const theirNeeds = CORE_POSITIONS.filter((position) => {
      const group = theirGroups.get(position) ?? [];
      return (group[0]?.value.score ?? 0) < 55 && mySurplus.includes(position);
    });

    partners.push({
      rosterId: team.rosterId,
      teamName: team.teamName,
      theirNeeds,
      targets: targets.sort((a, b) => b.targetScore - a.targetScore),
    });
  }

  return partners.sort(
    (a, b) =>
      (b.targets[0]?.targetScore ?? 0) - (a.targets[0]?.targetScore ?? 0)
  );
}

export function optimalLineup(
  players: PlayerSummary[],
  slots: Record<string, number>
): OptimalLineup {
  const pool = [...players].sort(
    (a, b) => (b.value.ppg ?? -1) - (a.value.ppg ?? -1)
  );
  const used = new Set<string>();
  const starters: LineupSlot[] = [];

  const slotOrder = ["QB", "RB", "WR", "TE", "FLEX", "K", "DEF"];
  for (const position of slotOrder) {
    const count = slots[position] ?? 0;
    for (let i = 0; i < count; i++) {
      if (position === "FLEX") {
        const flexPlayer = pool.find(
          (player) =>
            !used.has(player.id) &&
            ["RB", "WR", "TE"].includes(player.position) &&
            player.value.ppg !== null
        );
        starters.push({ slot: "FLEX", player: flexPlayer ?? null, ppg: flexPlayer?.value.ppg ?? null });
        if (flexPlayer) used.add(flexPlayer.id);
      } else {
        const match = pool.find(
          (player) => !used.has(player.id) && player.position === position
        );
        starters.push({ slot: position, player: match ?? null, ppg: match?.value.ppg ?? null });
        if (match) used.add(match.id);
      }
    }
  }

  const bench = pool.filter((player) => !used.has(player.id));
  const projectedTotal = starters.reduce(
    (sum, slot) => sum + (slot.ppg ?? 0),
    0
  );

  return {
    starters,
    bench,
    projectedTotal: Math.round(projectedTotal * 10) / 10,
  };
}
