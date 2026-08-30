import type { PlayerSeasonAgg, StatRow, WeekPoints } from "@/types";
import { NFL_WEEKS } from "./sleeper";

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function extractPPR(row: StatRow | undefined): number | null {
  if (!row) return null;
  if (typeof row.pts_ppr === "number") return round1(row.pts_ppr);
  const probe = ["pass_yd", "pass_td", "rush_yd", "rush_td", "rec", "rec_yd", "rec_td"];
  if (!probe.some((k) => typeof row[k] === "number")) return null;
  const value =
    (row.pass_yd ?? 0) * 0.04 +
    (row.pass_td ?? 0) * 4 -
    (row.pass_int ?? 0) * 2 +
    (row.rush_yd ?? 0) * 0.1 +
    (row.rush_td ?? 0) * 6 +
    (row.rec ?? 0) * 1 +
    (row.rec_yd ?? 0) * 0.1 +
    (row.rec_td ?? 0) * 6 -
    (row.fum_lost ?? 0) * 2;
  return round1(value);
}

function boomThreshold(position: string): number {
  return position === "QB" ? 24 : 20;
}

function bustThreshold(position: string): number {
  return position === "QB" ? 12 : 5;
}

export function aggregateSeason(
  playerId: string,
  position: string,
  season: number,
  weekly: Record<number, Record<string, StatRow>>
): PlayerSeasonAgg | null {
  const weeks: WeekPoints[] = [];
  for (let week = 1; week <= NFL_WEEKS; week++) {
    const pts = extractPPR(weekly[week]?.[playerId]);
    if (pts !== null) weeks.push({ week, pts });
  }
  if (weeks.length === 0) return null;
  const games = weeks.length;
  const total = round1(weeks.reduce((s, w) => s + w.pts, 0));
  const ppg = round1(total / games);
  const sorted = [...weeks].sort((a, b) => b.pts - a.pts);
  const best = sorted[0].pts;
  const worst = sorted[sorted.length - 1].pts;
  const variance = weeks.reduce((s, w) => s + (w.pts - ppg) ** 2, 0) / games;
  const stdev = round1(Math.sqrt(variance));
  const boom = weeks.filter((w) => w.pts >= boomThreshold(position)).length;
  const bust = weeks.filter((w) => w.pts < bustThreshold(position)).length;
  return {
    season,
    games,
    total,
    ppg,
    best,
    worst,
    stdev,
    boomRate: round2(boom / games),
    bustRate: round2(bust / games),
    weeks,
  };
}
