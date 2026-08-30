import { computeAllPlayers } from "./nfl-data";
import type { LeagueTeam, NFLPlayer, PlayerSummary } from "@/types";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const ESPN_FFL_BASE = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl";

export interface EspnCredentials {
  s2?: string;
  swid?: string;
}

export interface EspnRawPlayer {
  id?: number;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  proTeam?: string;
  proTeamId?: number;
  injuryStatus?: string;
}

export interface EspnRawTeam {
  id?: number;
  location?: string;
  nickname?: string;
  abbrev?: string;
  record?: {
    overall?: {
      wins?: number;
      losses?: number;
      ties?: number;
      pointsFor?: number;
    };
  };
  roster?: {
    entries?: { playerPoolEntry?: { player?: EspnRawPlayer } }[];
  };
}

const ESPN_PRO_TEAM_IDS: Record<number, string> = {
  1: "ATL",
  2: "BUF",
  3: "CHI",
  4: "CIN",
  5: "CLE",
  6: "DAL",
  7: "DEN",
  8: "DET",
  9: "GB",
  10: "TEN",
  11: "IND",
  12: "KC",
  13: "LV",
  14: "LAR",
  15: "MIA",
  16: "MIN",
  17: "NE",
  18: "NO",
  19: "NYG",
  20: "NYJ",
  21: "PHI",
  22: "PIT",
  23: "SF",
  24: "SEA",
  25: "TB",
  26: "WSH",
  27: "CAR",
  28: "JAX",
  33: "BAL",
  34: "HOU",
  35: "ARI",
};

const ESPN_TO_SLEEPER_TEAM: Record<string, string> = {
  WSH: "WAS",
};

export function espnTeamToSleeper(abbr?: string): string | null {
  if (!abbr) return null;
  return ESPN_TO_SLEEPER_TEAM[abbr.toUpperCase()] ?? abbr.toUpperCase();
}

export function espnProTeamToAbbr(player: EspnRawPlayer): string | null {
  if (typeof player.proTeam === "string" && player.proTeam.length > 0) {
    return espnTeamToSleeper(player.proTeam);
  }
  if (typeof player.proTeamId === "number") {
    const mapped = ESPN_PRO_TEAM_IDS[player.proTeamId];
    return mapped ? espnTeamToSleeper(mapped) : null;
  }
  return null;
}

export function normalizeEspnPosition(position?: string): string {
  const raw = (position ?? "").toUpperCase().trim();
  if (raw === "D/ST" || raw === "DST" || raw === "DEF") return "DEF";
  return raw;
}

export function espnSeasonYear(): number {
  const now = new Date();
  return now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
}

const NAME_SUFFIX_TOKENS = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

export function normalizeNameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z]/g, " ")
    .split(" ")
    .filter((token) => token.length > 0 && !NAME_SUFFIX_TOKENS.has(token))
    .join("");
}

export async function fetchEspnLeague(
  leagueId: string,
  creds: EspnCredentials = {}
): Promise<{ name: string; teams: EspnRawTeam[]; scoringLabel: string; totalRosters: number }> {
  const season = espnSeasonYear();
  const headers: Record<string, string> = {
    "user-agent": BROWSER_UA,
    accept: "application/json",
  };
  const cookie: string[] = [];
  if (creds.s2 && creds.s2.trim().length > 0) cookie.push(`espn_s2=${creds.s2.trim()}`);
  if (creds.swid && creds.swid.trim().length > 0) cookie.push(`SWID=${creds.swid.trim()}`);
  if (cookie.length > 0) headers.cookie = cookie.join("; ");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(
      `${ESPN_FFL_BASE}/seasons/${season}/segments/0/leagues/${leagueId}?view=mTeam&view=mRoster&view=mSettings`,
      { headers, cache: "no-store", signal: controller.signal }
    );    if (res.status === 401 || res.status === 403) {
      throw new Error(
        "This ESPN league is private. Add your espn_s2 and SWID cookies to load it."
      );
    }
    if (!res.ok) {
      throw new Error(`ESPN league not found (status ${res.status}). Double-check the league ID.`);
    }
    const json = (await res.json()) as {
      settings?: { name?: string; scoringSettings?: { items?: { statId?: number; value?: number }[] } };
      teams?: EspnRawTeam[];
    };
    const teams = json.teams ?? [];
    if (teams.length === 0) {
      throw new Error("ESPN returned no teams for this league.");
    }
    const recItem = json.settings?.scoringSettings?.items?.find(
      (item) => item.statId === 24 && typeof item.value === "number"
    );
    const recValue = recItem?.value ?? null;
    const scoringLabel =
      recValue === null ? "Custom scoring" : recValue >= 1 ? "Full PPR" : recValue > 0 ? "Half PPR" : "Standard";
    return {
      name: json.settings?.name ?? `League ${leagueId}`,
      teams,
      scoringLabel,
      totalRosters: teams.length,
    };
  } finally {
    clearTimeout(timer);
  }
}

function toSummary(entry: { player: NFLPlayer; value: PlayerSummary["value"]; posRank?: number; trendCount?: number; byeWeek?: number }): PlayerSummary {
  return {
    id: entry.player.id,
    name: entry.player.name,
    position: entry.player.position,
    team: entry.player.team,
    status: entry.player.status,
    injuryStatus: entry.player.injuryStatus,
    age: entry.player.age,
    rookie: entry.player.rookie,
    value: entry.value,
    posRank: entry.posRank,
    trendCount: entry.trendCount,
    byeWeek: entry.byeWeek,
  };
}

export async function mapEspnLeagueToSleeper(
  leagueId: string,
  creds: EspnCredentials = {}
): Promise<{
  league: { id: string; name: string; season: string; totalRosters: number; scoringLabel: string };
  teams: LeagueTeam[];
  unmatched: string[];
}> {
  const [espnLeague, computed] = await Promise.all([
    fetchEspnLeague(leagueId, creds),
    computeAllPlayers(),
  ]);

  const byNamePos = new Map<string, NFLPlayer[]>();
  const defByTeam = new Map<string, NFLPlayer>();
  for (const entry of computed.values()) {
    const player = entry.player;
    if (player.position === "DEF" && player.team) {
      defByTeam.set(player.team, player);
    }
    const key = `${normalizeNameKey(player.name)}|${player.position}`;
    byNamePos.set(key, [...(byNamePos.get(key) ?? []), player]);
  }

  const toPlayerSummary = (player: NFLPlayer): PlayerSummary => {
    const entry = computed.get(player.id);
    if (!entry) {
      return {
        id: player.id,
        name: player.name,
        position: player.position,
        team: player.team,
        status: player.status,
        injuryStatus: player.injuryStatus,
        age: player.age,
        rookie: player.rookie,
        value: { score: null, tier: "Unknown", ppg: null, games: 0 },
      };
    }
    return toSummary({
      player,
      value: entry.value,
      posRank: entry.aggs.find((a) => a.games > 0)?.posRank,
      trendCount: entry.trendCount || undefined,
    });
  };

  const unmatched: string[] = [];
  const teams: LeagueTeam[] = espnLeague.teams.map((team) => {
    const players: PlayerSummary[] = [];
    for (const rosterEntry of team.roster?.entries ?? []) {
      const espnPlayer = rosterEntry?.playerPoolEntry?.player;
      if (!espnPlayer) continue;
      const name =
        espnPlayer.fullName ??
        `${espnPlayer.firstName ?? ""} ${espnPlayer.lastName ?? ""}`.trim();
      if (!name) continue;
      const position = normalizeEspnPosition(espnPlayer.position);
      const espnTeamAbbr = espnProTeamToAbbr(espnPlayer);

      let matched: NFLPlayer | undefined;
      if (position === "DEF") {
        matched = espnTeamAbbr ? defByTeam.get(espnTeamAbbr) : undefined;
      } else {
        const candidates = byNamePos.get(`${normalizeNameKey(name)}|${position}`) ?? [];
        if (candidates.length === 1) {
          matched = candidates[0];
        } else if (candidates.length > 1) {
          matched =
            candidates.find((candidate) => candidate.team === espnTeamAbbr) ??
            candidates.find((candidate) => candidate.team === null);
        }
      }

      if (matched) {
        players.push(toPlayerSummary(matched));
      } else {
        unmatched.push(`${name} (${position})`);
      }
    }

    players.sort((a, b) => (b.value.score ?? -1) - (a.value.score ?? -1));

    return {
      rosterId: team.id ?? 0,
      teamName: `${team.location ?? ""} ${team.nickname ?? ""}`.trim() || team.abbrev || `Team ${team.id}`,
      displayName: team.abbrev ?? "",
      wins: team.record?.overall?.wins ?? 0,
      losses: team.record?.overall?.losses ?? 0,
      ties: team.record?.overall?.ties ?? 0,
      fpts: team.record?.overall?.pointsFor ?? 0,
      players,
      starters: [],
      totalValue: Math.round(players.reduce((sum, p) => sum + (p.value.score ?? 0), 0)),
    };
  });

  teams.sort((a, b) => b.wins - a.wins || b.fpts - a.fpts);

  return {
    league: {
      id: leagueId,
      name: espnLeague.name,
      season: String(espnSeasonYear()),
      totalRosters: espnLeague.totalRosters,
      scoringLabel: espnLeague.scoringLabel,
    },
    teams,
    unmatched,
  };
}
