import { getDb } from "./db";
import {
  buildSleeperIndexes,
  espnSeasonYear,
  fetchEspnLeague,
  matchEspnPlayer,
  type EspnCredentials,
} from "./espn";
import { getCurrentWeek, restOfSeasonGames } from "./schedule";
import type { ProjectionSummary } from "@/types";

interface EspnStatEntry {
  statSourceId?: number;
  statSplitTypeId?: number;
  seasonId?: number;
  scoringPeriodId?: number;
  appliedTotal?: number;
  appliedAverage?: number;
}

export interface EspnWeeklyProjection {
  week: number;
  points: number;
}

export function extractWeeklyProjections(
  stats: EspnStatEntry[] | undefined,
  season: number
): EspnWeeklyProjection[] {
  if (!stats) return [];
  const out: EspnWeeklyProjection[] = [];
  for (const stat of stats) {
    if (stat.statSourceId !== 1) continue;
    if (stat.statSplitTypeId !== 1) continue;
    if (stat.seasonId !== season) continue;
    const week = stat.scoringPeriodId;
    if (typeof week !== "number" || week < 1 || week > 18) continue;
    const points = stat.appliedTotal;
    if (typeof points !== "number" || points <= 0) continue;
    out.push({ week, points: Math.round(points * 10) / 10 });
  }
  return out;
}

export const PROJECTION_FRESH_MS = 6 * 60 * 60 * 1000;

export const BLEND_ESPN_WEIGHT = 0.55;

export function blendProjection(
  espnPpg: number | null,
  enginePpg: number | null
): { ppg: number; source: "espn" | "engine" } {
  if (espnPpg !== null && enginePpg !== null) {
    return {
      ppg: Math.round((BLEND_ESPN_WEIGHT * espnPpg + (1 - BLEND_ESPN_WEIGHT) * enginePpg) * 10) / 10,
      source: "espn",
    };
  }
  if (espnPpg !== null) {
    return { ppg: espnPpg, source: "espn" };
  }
  if (enginePpg !== null) {
    return { ppg: enginePpg, source: "engine" };
  }
  return { ppg: 0, source: "engine" };
}

export function computeProjectionSummary(
  enginePpg: number | null,
  espnPpg: number | null,
  byeWeek: number | undefined,
  currentWeek: number
): ProjectionSummary {
  const blend = blendProjection(espnPpg, enginePpg);
  const games = restOfSeasonGames(byeWeek, currentWeek);
  return {
    ppg: blend.ppg,
    espnPpg: espnPpg,
    enginePpg: enginePpg,
    source: blend.source,
    rosGames: games,
    rosPoints: Math.round(blend.ppg * games * 10) / 10,
  };
}

export async function saveLeagueProjections(
  leagueId: string,
  creds: EspnCredentials
): Promise<number> {
  const [league, computed] = await Promise.all([
    fetchEspnLeague(leagueId, creds),
    computeAllPlayersSafe(),
  ]);
  const indexes = buildSleeperIndexes(computed);
  const season = espnSeasonYear();
  const db = getDb();
  const upsert = db.prepare(
    "INSERT INTO projections (player_id, season, projected_total, projected_ppg, fetched_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(player_id, season) DO UPDATE SET projected_total = excluded.projected_total, projected_ppg = excluded.projected_ppg, fetched_at = excluded.fetched_at"
  );
  const upsertWeekly = db.prepare(
    "INSERT INTO weekly_projections (player_id, season, week, points, fetched_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(player_id, season, week) DO UPDATE SET points = excluded.points, fetched_at = excluded.fetched_at"
  );

  let count = 0;
  let weeklyCount = 0;
  const now = new Date().toISOString();
  const run = db.transaction(() => {
    for (const team of league.teams) {
      for (const entry of team.roster?.entries ?? []) {
        const espnPlayer = entry?.playerPoolEntry?.player;
        if (!espnPlayer) continue;
        const matched = matchEspnPlayer(espnPlayer, indexes);
        const weekly = extractWeeklyProjections(
          espnPlayer.stats as EspnStatEntry[] | undefined,
          season
        );
        if (weekly.length > 0 && matched) {
          for (const w of weekly) {
            upsertWeekly.run(matched.id, season, w.week, w.points, now);
            weeklyCount += 1;
          }
        }
        const seasonProj = (espnPlayer.stats as EspnStatEntry[] | undefined)?.find(
          (stat) =>
            stat.statSourceId === 1 &&
            stat.statSplitTypeId === 0 &&
            stat.seasonId === season &&
            (stat.appliedTotal ?? 0) > 0
        );
        if (!seasonProj) continue;
        if (!matched) continue;
        const ppg =
          typeof seasonProj.appliedAverage === "number" && seasonProj.appliedAverage > 0
            ? seasonProj.appliedAverage
            : seasonProj.appliedTotal! / 17;
        upsert.run(
          matched.id,
          season,
          Math.round(seasonProj.appliedTotal! * 10) / 10,
          Math.round(ppg * 10) / 10,
          now
        );
        count += 1;
      }
    }
  });
  run();
  if (weeklyCount > 0) {
    console.log(`[fft] saved ${weeklyCount} weekly projections alongside ${count} season rows`);
  }
  return count;
}

async function computeAllPlayersSafe() {
  const { computeAllPlayers } = await import("./nfl-data");
  return computeAllPlayers();
}

export interface EspnProjectionRow {
  ppg: number;
  total: number;
  fetchedAt: string;
}

export function getEspnProjections(): Map<string, EspnProjectionRow> {
  const season = espnSeasonYear();
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT player_id, projected_ppg, projected_total, fetched_at FROM projections WHERE season = ?"
    )
    .all(season) as {
    player_id: string;
    projected_ppg: number;
    projected_total: number;
    fetched_at: string;
  }[];
  return new Map(
    rows.map((row) => [
      row.player_id,
      { ppg: row.projected_ppg, total: row.projected_total, fetchedAt: row.fetched_at },
    ])
  );
}

export function projectionsNeedSync(): boolean {
  const season = espnSeasonYear();
  const db = getDb();
  const row = db
    .prepare("SELECT COUNT(*) AS n, MAX(fetched_at) AS latest FROM projections WHERE season = ?")
    .get(season) as { n: number; latest: string | null };
  if (row.n === 0 || !row.latest) return true;
  return Date.now() - Date.parse(row.latest) > PROJECTION_FRESH_MS;
}

export function getWeeklyProjection(
  playerId: string,
  fromWeek: number
): { week: number; points: number } | null {
  const season = espnSeasonYear();
  const db = getDb();
  const row = db
    .prepare(
      "SELECT week, points FROM weekly_projections WHERE player_id = ? AND season = ? AND week >= ? ORDER BY week ASC LIMIT 1"
    )
    .get(playerId, season, fromWeek) as { week: number; points: number } | undefined;
  return row ? { week: row.week, points: row.points } : null;
}

export async function attachProjectionContext(
  summaries: {
    id: string;
    byeWeek?: number;
    value: { ppg: number | null };
    projection?: ProjectionSummary;
  }[]
): Promise<void> {
  const [espnMap, currentWeek] = await Promise.all([getEspnProjections(), getCurrentWeek()]);
  for (const summary of summaries) {
    const espn = espnMap.get(summary.id);
    summary.projection = computeProjectionSummary(
      summary.value.ppg,
      espn ? espn.ppg : null,
      summary.byeWeek,
      currentWeek
    );
  }
}
