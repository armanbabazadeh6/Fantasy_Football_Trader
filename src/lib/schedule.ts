import { getCached } from "./cache";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const SCOREBOARD_TTL = 6 * 60 * 60 * 1000;

export function scheduleSeason(): number {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

interface ScoreboardEvent {
  season?: { type?: number };
  week?: { number?: number };
  status?: { type?: { completed?: boolean } };
  competitions?: {
    competitors?: {
      homeAway?: string;
      team?: { abbreviation?: string };
    }[];
  }[];
}

export interface WeekMatchup {
  opponent: string;
  homeAway: "home" | "away";
}

function normalizeAbbr(abbr?: string): string | null {
  if (!abbr) return null;
  const upper = abbr.toUpperCase();
  return upper === "WSH" ? "WAS" : upper;
}

export function buildWeekMatchups(
  events: ScoreboardEvent[],
  week: number
): Record<string, WeekMatchup> {
  const map: Record<string, WeekMatchup> = {};
  for (const event of events) {
    if (event.season?.type !== 2) continue;
    if (event.week?.number !== week) continue;
    for (const competition of event.competitions ?? []) {
      const competitors = (competition.competitors ?? [])
        .map((competitor) => ({
          abbr: normalizeAbbr(competitor.team?.abbreviation),
          homeAway: competitor.homeAway === "home" ? ("home" as const) : ("away" as const),
        }))
        .filter((competitor) => competitor.abbr !== null);
      if (competitors.length !== 2) continue;
      const [a, b] = competitors as { abbr: string; homeAway: "home" | "away" }[];
      map[a.abbr] = { opponent: b.abbr, homeAway: a.homeAway };
      map[b.abbr] = { opponent: a.abbr, homeAway: b.homeAway };
    }
  }
  return map;
}

export async function fetchWeekMatchups(
  week: number
): Promise<Record<string, WeekMatchup>> {
  return buildWeekMatchups(await fetchScoreboard(), week);
}

async function fetchScoreboard(): Promise<ScoreboardEvent[]> {
  return getCached<ScoreboardEvent[]>("nfl_scoreboard_v1", SCOREBOARD_TTL, async () => {
    const season = scheduleSeason();
    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${season}0901-${season + 1}0131&limit=500`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch(url, {
        headers: { "user-agent": BROWSER_UA, accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) return [];
      const json = (await res.json()) as { events?: ScoreboardEvent[] };
      return json.events ?? [];
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
    }
  });
}

export async function fetchTeamByeWeeks(): Promise<Record<string, number>> {
  const events = await fetchScoreboard();

  const played = new Map<string, Set<number>>();
  for (const event of events) {
    if (event.season?.type !== 2) continue;
    const week = event.week?.number;
    if (!week || week < 1 || week > 18) continue;
    for (const competition of event.competitions ?? []) {
      for (const competitor of competition.competitors ?? []) {
        const abbr = competitor.team?.abbreviation;
        if (!abbr) continue;
        const sleeperAbbr = abbr.toUpperCase() === "WSH" ? "WAS" : abbr.toUpperCase();
        if (!played.has(sleeperAbbr)) played.set(sleeperAbbr, new Set());
        played.get(sleeperAbbr)!.add(week);
      }
    }
  }

  const byes: Record<string, number> = {};
  for (const [team, weeks] of played) {
    for (let week = 5; week <= 14; week++) {
      if (!weeks.has(week)) {
        byes[team] = week;
        break;
      }
    }
  }
  return byes;
}

export async function getCurrentWeek(): Promise<number> {
  const events = await fetchScoreboard();
  let current = 0;
  for (const event of events) {
    if (event.season?.type !== 2) continue;
    const week = event.week?.number;
    if (!week || week < 1 || week > 18) continue;
    if (event.status?.type?.completed && week > current) {
      current = week;
    }
  }
  return current;
}

export function restOfSeasonGames(byeWeek: number | undefined, currentWeek: number): number {
  const remaining = Math.max(0, 18 - currentWeek);
  if (byeWeek && byeWeek > currentWeek) return Math.max(0, remaining - 1);
  return remaining;
}
