import { getCached } from "./cache";
import type { NFLPlayer, StatRow, TrendingEntry } from "@/types";

const BASE = "https://api.sleeper.app/v1";
const PLAYER_TTL = 12 * 60 * 60 * 1000;
const LIVE_STATS_TTL = 6 * 60 * 60 * 1000;
const HISTORICAL_STATS_TTL = 30 * 24 * 60 * 60 * 1000;
const TRENDING_TTL = 60 * 60 * 1000;
const LEAGUE_TTL = 5 * 60 * 1000;
export const NFL_WEEKS = 18;

const FANTASY_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "DEF"]);

const KEEP_STATS = new Set([
  "pts_ppr",
  "pts_std",
  "pts_half_ppr",
  "pass_yd",
  "pass_td",
  "pass_int",
  "rush_att",
  "rush_yd",
  "rush_td",
  "targets",
  "rec",
  "rec_yd",
  "rec_td",
  "fum_lost",
  "off_snp",
]);

export interface SleeperLeagueRaw {
  league_id: string;
  name: string;
  season: string;
  total_rosters: number;
  scoring_settings?: Record<string, number>;
}

export interface SleeperRosterRaw {
  roster_id: number;
  owner_id?: string;
  players: string[];
  starters: string[];
  settings?: {
    wins?: number;
    losses?: number;
    ties?: number;
    fpts?: number;
    fpts_decimal?: number;
  };
}

export interface SleeperUserRaw {
  user_id: string;
  display_name: string;
  metadata?: { team_name?: string };
}

interface SleeperPlayerRaw {
  player_id: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  team?: string | null;
  position?: string;
  status?: string;
  fantasy_positions?: string[];
  injury_status?: string;
  injury_body_part?: string;
  years_exp?: number;
  age?: number;
  rookie?: boolean;
}

async function sleeperFetch<T>(urlPath: string): Promise<T> {
  const res = await fetch(`${BASE}${urlPath}`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Sleeper request failed (${res.status}) for ${urlPath}`);
  }
  return (await res.json()) as T;
}

export function currentStatSeason(): number {
  const now = new Date();
  return now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
}

export function statSeasons(): number[] {
  const latest = currentStatSeason();
  return [latest, latest - 1];
}

function normalizePlayer(raw: SleeperPlayerRaw): NFLPlayer | null {
  if (raw.status === "Inactive") return null;
  const name = `${raw.first_name ?? ""} ${raw.last_name ?? ""}`.trim() || raw.name || "";
  if (!raw.player_id || !name) return null;
  const position = raw.position ?? raw.fantasy_positions?.[0] ?? "";
  if (!FANTASY_POSITIONS.has(position)) return null;
  return {
    id: raw.player_id,
    name,
    position,
    team: raw.team ?? null,
    status: raw.status ?? "",
    injuryStatus: raw.injury_status,
    injuryBodyPart: raw.injury_body_part,
    age: typeof raw.age === "number" ? raw.age : undefined,
    yearsExp: typeof raw.years_exp === "number" ? raw.years_exp : undefined,
    rookie: Boolean(raw.rookie),
    fantasyPositions: raw.fantasy_positions,
  };
}

export async function fetchAllPlayers(): Promise<Map<string, NFLPlayer>> {
  const list = await getCached<NFLPlayer[]>("sleeper_players_nfl_v2", PLAYER_TTL, async () => {
    const raw = await sleeperFetch<Record<string, SleeperPlayerRaw>>("/players/nfl");
    return Object.values(raw)
      .map(normalizePlayer)
      .filter((p): p is NFLPlayer => p !== null);
  });
  return new Map(list.map((p) => [p.id, p]));
}

function projectRow(row: Record<string, unknown>): StatRow {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === "number" && KEEP_STATS.has(key)) {
      out[key] = value;
    }
  }
  return out as StatRow;
}

function normalizeStatPayload(raw: unknown): Record<string, StatRow> {
  const out: Record<string, StatRow> = {};
  if (Array.isArray(raw)) {
    for (const row of raw) {
      if (row && typeof row === "object") {
        const record = row as Record<string, unknown>;
        const playerId = record.player_id;
        if (typeof playerId === "string" && playerId !== "0") {
          const stats = { ...record };
          delete stats.player_id;
          out[playerId] = projectRow(stats);
        }
      }
    }
    return out;
  }
  if (raw && typeof raw === "object") {
    for (const [playerId, stats] of Object.entries(raw as Record<string, unknown>)) {
      if (!stats || typeof stats !== "object") continue;
      const record = stats as Record<string, unknown>;
      const rowPlayerId = record.player_id;
      if (typeof rowPlayerId === "string") {
        if (rowPlayerId !== "0") {
          const projected = { ...record };
          delete projected.player_id;
          out[rowPlayerId] = projectRow(projected);
        }
      } else {
        out[playerId] = projectRow(record);
      }
    }
  }
  return out;
}

export async function fetchWeeklyStats(
  season: number,
  week: number
): Promise<Record<string, StatRow>> {
  const isCurrent = season >= new Date().getFullYear();
  const ttl = isCurrent ? LIVE_STATS_TTL : HISTORICAL_STATS_TTL;
  return getCached<Record<string, StatRow>>(
    `sleeper_stats_${season}_w${week}`,
    ttl,
    async () => {
      const raw = await sleeperFetch<unknown>(`/stats/nfl/regular/${season}/${week}`);
      return normalizeStatPayload(raw);
    }
  );
}

export async function fetchSeasonWeekly(
  season: number
): Promise<Record<number, Record<string, StatRow>>> {
  const weeks = await Promise.all(
    Array.from({ length: NFL_WEEKS }, (_, i) => i + 1).map(async (week) => {
      try {
        const rows = await fetchWeeklyStats(season, week);
        return [week, rows] as const;
      } catch {
        return [week, {} as Record<string, StatRow>] as const;
      }
    })
  );
  return Object.fromEntries(weeks);
}

export async function fetchTrending(
  type: "add" | "drop" = "add",
  lookbackHours = 24
): Promise<TrendingEntry[]> {
  return getCached<TrendingEntry[]>(
    `sleeper_trending_${type}_${lookbackHours}h`,
    TRENDING_TTL,
    async () => {
      const raw = await sleeperFetch<{ player_id: string; count: number }[]>(
        `/players/nfl/trending/${type}?lookback_hours=${lookbackHours}&limit=50`
      );
      return raw.map((r) => ({ playerId: r.player_id, count: r.count }));
    }
  );
}

export async function fetchLeague(leagueId: string): Promise<SleeperLeagueRaw> {
  return getCached<SleeperLeagueRaw>(
    `sleeper_league_${leagueId}`,
    LEAGUE_TTL,
    async () => sleeperFetch<SleeperLeagueRaw>(`/league/${leagueId}`)
  );
}

export async function fetchLeagueRosters(leagueId: string): Promise<SleeperRosterRaw[]> {
  return getCached<SleeperRosterRaw[]>(
    `sleeper_league_${leagueId}_rosters`,
    LEAGUE_TTL,
    async () => sleeperFetch<SleeperRosterRaw[]>(`/league/${leagueId}/rosters`)
  );
}

export async function fetchLeagueUsers(leagueId: string): Promise<SleeperUserRaw[]> {
  return getCached<SleeperUserRaw[]>(
    `sleeper_league_${leagueId}_users`,
    LEAGUE_TTL,
    async () => sleeperFetch<SleeperUserRaw[]>(`/league/${leagueId}/users`)
  );
}
