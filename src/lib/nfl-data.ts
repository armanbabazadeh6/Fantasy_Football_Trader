import { getCached } from "./cache";
import { fetchNews, matchNewsForPlayer } from "./news";
import { fetchAllPlayers, fetchSeasonWeekly, fetchTrending, statSeasons } from "./sleeper";
import { fetchTeamByeWeeks } from "./schedule";
import { aggregateSeason } from "./fantasy";
import { computePlayerValue } from "./value-engine";
import type {
  NFLPlayer,
  NewsItem,
  PlayerBundle,
  PlayerSeasonAgg,
  PlayerSummary,
  PlayerValue,
  StatRow,
} from "@/types";

export interface ComputedPlayer {
  player: NFLPlayer;
  aggs: PlayerSeasonAgg[];
  value: PlayerValue;
  trendCount: number;
}

interface CoreData {
  players: Map<string, NFLPlayer>;
  weeklyBySeason: Map<number, Record<number, Record<string, StatRow>>>;
  trendCounts: Map<string, number>;
}

let corePromise: Promise<CoreData> | null = null;

export async function loadCoreData(): Promise<CoreData> {
  corePromise ??= (async () => {
    const [players, trending] = await Promise.all([
      fetchAllPlayers(),
      fetchTrending("add", 24),
    ]);
    const weeklyBySeason = new Map<number, Record<number, Record<string, StatRow>>>();
    await Promise.all(
      statSeasons().map(async (season) => {
        weeklyBySeason.set(season, await fetchSeasonWeekly(season));
      })
    );
    const trendCounts = new Map(trending.map((t) => [t.playerId, t.count]));
    return { players, weeklyBySeason, trendCounts };
  })();
  return corePromise;
}

export async function computeAllPlayers(): Promise<Map<string, ComputedPlayer>> {
  const cached = await getCached<ComputedPlayer[]>("computed_players_v3", 3 * 60 * 60 * 1000, async () => {
    const core = await loadCoreData();
    const seasons = statSeasons();
    const result: ComputedPlayer[] = [];
    for (const player of core.players.values()) {
      const aggs: PlayerSeasonAgg[] = [];
      for (const season of seasons) {
        const agg = aggregateSeason(
          player.id,
          player.position,
          season,
          core.weeklyBySeason.get(season) ?? {}
        );
        if (agg) aggs.push(agg);
      }
      const trendCount = core.trendCounts.get(player.id) ?? 0;
      result.push({
        player,
        aggs,
        value: computePlayerValue(player, aggs, trendCount),
        trendCount,
      });
    }
    applyPositionRanks(result);
    return result;
  });
  return new Map(cached.map((c) => [c.player.id, c]));
}

function applyPositionRanks(computed: ComputedPlayer[]): void {
  const bySeason = new Map<number, ComputedPlayer[]>();
  for (const entry of computed) {
    for (const agg of entry.aggs) {
      const key = agg.season;
      bySeason.set(key, [...(bySeason.get(key) ?? []), entry]);
    }
  }
  for (const [season, entries] of bySeason) {
    const byPos = new Map<string, ComputedPlayer[]>();
    for (const entry of entries) {
      byPos.set(entry.player.position, [...(byPos.get(entry.player.position) ?? []), entry]);
    }
    for (const group of byPos.values()) {
      group.sort((a, b) => {
        const aTotal = a.aggs.find((g) => g.season === season)?.total ?? -1;
        const bTotal = b.aggs.find((g) => g.season === season)?.total ?? -1;
        return bTotal - aTotal;
      });
      group.forEach((entry, index) => {
        const agg = entry.aggs.find((g) => g.season === season);
        if (agg) agg.posRank = index + 1;
      });
    }
  }
}

function toSummary(entry: ComputedPlayer): PlayerSummary {
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
    posRank: entry.aggs.find((a) => a.games > 0)?.posRank,
    trendCount: entry.trendCount || undefined,
  };
}

export async function getPlayerSummaries(): Promise<PlayerSummary[]> {
  const [map, byes] = await Promise.all([computeAllPlayers(), fetchTeamByeWeeks()]);
  const summaries = Array.from(map.values()).map((entry) => {
    const summary = toSummary(entry);
    if (entry.player.team && byes[entry.player.team]) {
      summary.byeWeek = byes[entry.player.team];
    }
    return summary;
  });
  summaries.sort((a, b) => {
    const av = a.value.score ?? -1;
    const bv = b.value.score ?? -1;
    if (bv !== av) return bv - av;
    return a.name.localeCompare(b.name);
  });
  return summaries;
}

export async function searchPlayerSummaries(
  query: string,
  position: string,
  limit: number
): Promise<{ players: PlayerSummary[]; total: number }> {
  const summaries = await getPlayerSummaries();
  const q = query.trim().toLowerCase();
  let filtered = position ? summaries.filter((p) => p.position === position) : summaries;
  let total = filtered.length;
  if (q) {
    const scored = filtered
      .map((p) => {
        const name = p.name.toLowerCase();
        if (name.startsWith(q)) return { p, rank: 0 };
        if (name.includes(q)) return { p, rank: 1 };
        if (p.team && p.team.toLowerCase() === q) return { p, rank: 2 };
        return { p, rank: 3 };
      })
      .filter((entry) => entry.rank < 3);
    scored.sort((a, b) => a.rank - b.rank || (b.p.value.score ?? -1) - (a.p.value.score ?? -1));
    filtered = scored.map((entry) => entry.p);
    total = filtered.length;
  }
  return { players: filtered.slice(0, limit), total };
}

export async function getTrendingSummaries(limit = 20): Promise<PlayerSummary[]> {
  const [core, computed] = await Promise.all([loadCoreData(), computeAllPlayers()]);
  const trending = [...core.trendCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
  const summaries: PlayerSummary[] = [];
  for (const [playerId, count] of trending) {
    const entry = computed.get(playerId);
    if (!entry) continue;
    const summary = toSummary(entry);
    summary.trendCount = count;
    summaries.push(summary);
  }
  return summaries;
}

export async function getPlayerBundles(ids: string[]): Promise<PlayerBundle[]> {
  if (ids.length === 0) return [];
  const [computed, news, byes] = await Promise.all([
    computeAllPlayers(),
    fetchNews(),
    fetchTeamByeWeeks(),
  ]);
  const bundles: PlayerBundle[] = [];
  for (const id of ids) {
    const entry = computed.get(id);
    if (!entry) continue;
    const bundle: PlayerBundle = {
      ...toSummary(entry),
      seasons: entry.aggs,
      news: matchNewsForPlayer(news, entry.player, 3),
    };
    if (entry.player.team && byes[entry.player.team]) {
      bundle.byeWeek = byes[entry.player.team];
    }
    bundles.push(bundle);
  }
  return bundles;
}

export interface PlayerDetailData {
  summary: PlayerSummary;
  player: NFLPlayer;
  seasons: PlayerSeasonAgg[];
  news: NewsItem[];
  trendCount: number;
}

export async function getPlayerDetail(id: string): Promise<PlayerDetailData | null> {
  const [computed, news, byes] = await Promise.all([
    computeAllPlayers(),
    fetchNews(),
    fetchTeamByeWeeks(),
  ]);
  const entry = computed.get(id);
  if (!entry) return null;
  const summary = toSummary(entry);
  if (entry.player.team && byes[entry.player.team]) {
    summary.byeWeek = byes[entry.player.team];
  }
  return {
    summary,
    player: entry.player,
    seasons: entry.aggs,
    news: matchNewsForPlayer(news, entry.player, 12, 120),
    trendCount: entry.trendCount,
  };
}
