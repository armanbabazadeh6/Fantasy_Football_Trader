import { computeAllPlayers, type ComputedPlayer } from "./nfl-data";
import type {
  EspnRawPlayer,
  EspnRawTeam,
  LeagueTeam,
  NFLPlayer,
  PlayerSummary,
} from "@/types";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const ESPN_FFL_BASE = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl";

export interface EspnCredentials {
  s2?: string;
  swid?: string;
  rawCookie?: string;
}

export type { EspnRawPlayer, EspnRawTeam };

export interface EspnTransactionItem {
  type?: string;
  fromTeamId?: number;
  toTeamId?: number;
  player?: EspnRawPlayer;
  playerPoolEntry?: { player?: EspnRawPlayer };
}

export interface EspnTransaction {
  id?: number;
  type?: string;
  status?: string;
  date?: number;
  items?: EspnTransactionItem[];
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

const ESPN_SLOT_MAP: Record<string, string> = {
  "0": "QB",
  "2": "RB",
  "3": "FLEX",
  "4": "WR",
  "5": "FLEX",
  "6": "TE",
  "7": "FLEX",
  "16": "K",
  "17": "DEF",
  "23": "FLEX",
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

const ESPN_POSITION_IDS: Record<number, string> = {
  1: "QB",
  2: "RB",
  3: "WR",
  4: "TE",
  5: "K",
  16: "DEF",
};

export function espnTeamName(team: EspnRawTeam): string {
  if (team.name && team.name.trim().length > 0) return team.name.trim();
  const legacy = `${team.location ?? ""} ${team.nickname ?? ""}`.trim();
  if (legacy.length > 0) return legacy;
  return team.abbrev || `Team ${team.id ?? "?"}`;
}

export function resolveEspnPosition(player: EspnRawPlayer): string {
  if (player.position && player.position.trim().length > 0) {
    return normalizeEspnPosition(player.position);
  }
  if (typeof player.defaultPositionId === "number") {
    return ESPN_POSITION_IDS[player.defaultPositionId] ?? "";
  }
  if (typeof player.positionId === "number") {
    return ESPN_POSITION_IDS[player.positionId] ?? "";
  }
  return "";
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

function espnHeaders(creds: EspnCredentials): Record<string, string> {
  const headers: Record<string, string> = {
    "user-agent": BROWSER_UA,
    accept: "application/json",
  };
  if (creds.rawCookie && creds.rawCookie.trim().length > 0) {
    const raw = creds.rawCookie
      .replace(/^cookie\s*:\s*/i, "")
      .replace(/[\r\n]+/g, " ")
      .replace(/;\s*;/g, "; ")
      .trim();
    if (raw.length > 0) {
      headers.cookie = raw;
      return headers;
    }
  }
  const cookie: string[] = [];
  if (creds.s2 && creds.s2.trim().length > 0) cookie.push(`espn_s2=${creds.s2.trim()}`);
  if (creds.swid && creds.swid.trim().length > 0) cookie.push(`SWID=${creds.swid.trim()}`);
  if (cookie.length > 0) headers.cookie = cookie.join("; ");
  return headers;
}

async function espnFetchJson(
  leagueId: string,
  creds: EspnCredentials,
  views: string[],
  timeoutMs = 20000
): Promise<Record<string, unknown>> {
  const season = espnSeasonYear();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(
      `${ESPN_FFL_BASE}/seasons/${season}/segments/0/leagues/${leagueId}?view=${views.join("&view=")}`,
      { headers: espnHeaders(creds), cache: "no-store", signal: controller.signal }
    );
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        "This ESPN league is private. Add your espn_s2 and SWID cookies to load it."
      );
    }
    if (!res.ok) {
      throw new Error(`ESPN league not found (status ${res.status}). Double-check the league ID.`);
    }
    return (await res.json()) as Record<string, unknown>;
  } finally {
    clearTimeout(timer);
  }
}

interface EspnScoringSettings {
  playerRankType?: string;
  scoringItems?: { statId?: number; points?: number }[];
  items?: { statId?: number; value?: number }[];
}

function parseRosterSlots(json: Record<string, unknown>): Record<string, number> | undefined {
  const settings = json.settings as { rosterSettings?: { lineupSlotCounts?: Record<string, number> } } | undefined;
  const counts = settings?.rosterSettings?.lineupSlotCounts;
  if (!counts) return undefined;
  const slots: Record<string, number> = {};
  for (const [slotId, count] of Object.entries(counts)) {
    const mapped = ESPN_SLOT_MAP[slotId];
    if (!mapped || typeof count !== "number" || count <= 0) continue;
    slots[mapped] = (slots[mapped] ?? 0) + count;
  }
  return Object.keys(slots).length > 0 ? slots : undefined;
}

export async function fetchEspnLeague(
  leagueId: string,
  creds: EspnCredentials = {}
): Promise<{
  name: string;
  teams: EspnRawTeam[];
  scoringLabel: string;
  totalRosters: number;
  rosterSlots?: Record<string, number>;
}> {
  const json = await espnFetchJson(leagueId, creds, ["mTeam", "mRoster", "mSettings"]);
  const teams = (json.teams as EspnRawTeam[] | undefined) ?? [];
  if (teams.length === 0) {
    throw new Error("ESPN returned no teams for this league.");
  }
  const scoring = (json.settings as
    | { scoringSettings?: EspnScoringSettings }
    | undefined)?.scoringSettings;
  const items = (scoring?.scoringItems ?? scoring?.items ?? []) as {
    statId?: number;
    points?: number;
    value?: number;
  }[];
  const receptions = items.find((item) => item.statId === 24);
  const recPoints = receptions?.points ?? receptions?.value ?? null;
  let scoringLabel: string;
  if (recPoints !== null) {
    scoringLabel = recPoints >= 1 ? "Full PPR" : recPoints > 0 ? "Half PPR" : "Standard";
  } else {
    const rankType = (scoring?.playerRankType ?? "").toUpperCase();
    scoringLabel =
      rankType === "PPR"
        ? "PPR"
        : rankType === "STD" || rankType === "STANDARD"
          ? "Standard"
          : "Custom scoring";
  }
  return {
    name: (json.settings as { name?: string } | undefined)?.name ?? `League ${leagueId}`,
    teams,
    scoringLabel,
    totalRosters: teams.length,
    rosterSlots: parseRosterSlots(json),
  };
}

export async function fetchEspnTransactions(
  leagueId: string,
  creds: EspnCredentials = {}
): Promise<EspnTransaction[]> {
  const json = await espnFetchJson(leagueId, creds, ["mTransactions2"]);
  const transactions = (json.transactions as EspnTransaction[] | undefined) ?? [];
  return transactions;
}

export interface SleeperIndexes {
  byNamePos: Map<string, NFLPlayer[]>;
  defByTeam: Map<string, NFLPlayer>;
}

export function buildSleeperIndexes(
  computed: Map<string, ComputedPlayer>
): SleeperIndexes {
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
  return { byNamePos, defByTeam };
}

export function espnPlayerName(player: EspnRawPlayer): string {
  return (
    player.fullName ??
    `${player.firstName ?? ""} ${player.lastName ?? ""}`.trim()
  );
}

export function matchEspnPlayer(
  player: EspnRawPlayer,
  indexes: SleeperIndexes
): NFLPlayer | null {
  const name = espnPlayerName(player);
  if (!name) return null;
  const position = resolveEspnPosition(player);
  const teamAbbr = espnProTeamToAbbr(player);
  if (position === "DEF") {
    return teamAbbr ? indexes.defByTeam.get(teamAbbr) ?? null : null;
  }
  if (!position) return null;
  const candidates = indexes.byNamePos.get(`${normalizeNameKey(name)}|${position}`) ?? [];
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) {
    return (
      candidates.find((candidate) => candidate.team === teamAbbr) ??
      candidates.find((candidate) => candidate.team === null) ??
      null
    );
  }
  return null;
}

function toPlayerSummary(
  player: NFLPlayer,
  computed: Map<string, ComputedPlayer>
): PlayerSummary {
  const entry = computed.get(player.id);
  return {
    id: player.id,
    name: player.name,
    position: player.position,
    team: player.team,
    status: player.status,
    injuryStatus: player.injuryStatus,
    age: player.age,
    rookie: player.rookie,
    value: entry?.value ?? { score: null, tier: "Unknown", ppg: null, games: 0 },
    posRank: entry?.aggs.find((a) => a.games > 0)?.posRank,
    trendCount: entry?.trendCount || undefined,
  };
}

export async function mapEspnLeagueToSleeper(
  leagueId: string,
  creds: EspnCredentials = {}
): Promise<{
  league: {
    id: string;
    name: string;
    season: string;
    totalRosters: number;
    scoringLabel: string;
    rosterSlots?: Record<string, number>;
  };
  teams: LeagueTeam[];
  unmatched: string[];
}> {
  const [espnLeague, computed] = await Promise.all([
    fetchEspnLeague(leagueId, creds),
    computeAllPlayers(),
  ]);
  const indexes = buildSleeperIndexes(computed);

  const unmatched: string[] = [];
  const teams: LeagueTeam[] = espnLeague.teams.map((team) => {
    const players: PlayerSummary[] = [];
    for (const rosterEntry of team.roster?.entries ?? []) {
      const espnPlayer = rosterEntry?.playerPoolEntry?.player;
      if (!espnPlayer) continue;
      const name = espnPlayerName(espnPlayer);
      if (!name) continue;
      const matched = matchEspnPlayer(espnPlayer, indexes);
      if (matched) {
        players.push(toPlayerSummary(matched, computed));
      } else {
        unmatched.push(`${name} (${resolveEspnPosition(espnPlayer)})`);
      }
    }

    players.sort((a, b) => (b.value.score ?? -1) - (a.value.score ?? -1));

    return {
      rosterId: team.id ?? 0,
      teamName: espnTeamName(team),
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
      rosterSlots: espnLeague.rosterSlots,
    },
    teams,
    unmatched,
  };
}
