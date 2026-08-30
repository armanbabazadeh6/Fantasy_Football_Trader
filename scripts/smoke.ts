import { fetchAllPlayers, fetchWeeklyStats, fetchTrending, statSeasons } from "@/lib/sleeper";
import { aggregateSeason, extractPPR } from "@/lib/fantasy";
import { computeAllPlayers, getPlayerBundles, getPlayerSummaries } from "@/lib/nfl-data";
import { fetchNews, matchNewsForPlayer } from "@/lib/news";
import {
  computeNeeds,
  computePlayerValue,
  ruleVerdict,
  sideValue,
} from "@/lib/value-engine";
import type { NFLPlayer, PlayerSeasonAgg } from "@/types";

let failures = 0;

function check(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`PASS  ${name}${detail ? " — " + detail : ""}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${name}${detail ? " — " + detail : ""}`);
  }
}

function fakePlayer(overrides: Partial<NFLPlayer> = {}): NFLPlayer {
  return {
    id: "test",
    name: "Test Player",
    position: "RB",
    team: "KC",
    status: "Active",
    rookie: false,
    ...overrides,
  };
}

function fakeAgg(overrides: Partial<PlayerSeasonAgg> = {}): PlayerSeasonAgg {
  return {
    season: 2025,
    games: 17,
    total: 340,
    ppg: 20,
    best: 35,
    worst: 4,
    stdev: 6,
    boomRate: 0.4,
    bustRate: 0.1,
    weeks: [],
    ...overrides,
  };
}

async function unitTests(): Promise<void> {
  console.log("\n=== Unit tests (pure functions) ===\n");

  const a = extractPPR({ pts_ppr: 18.7 });
  check("extractPPR uses pts_ppr when present", a === 18.7, `got ${a}`);

  const b = extractPPR({ pass_yd: 300, pass_td: 3, pass_int: 1 });
  check("extractPPR computes PPR from raw stats", b === 22, `got ${b}`);

  const c = extractPPR({ rec: 10, rec_yd: 100, rec_td: 1, rush_yd: 50, rush_td: 1 });
  check("extractPPR computes skill player line", c === 37, `got ${c}`);

  const d = extractPPR(undefined);
  check("extractPPR returns null for missing row", d === null);

  const agg = aggregateSeason("test", "RB", 2025, {
    1: { test: { pts_ppr: 10 } },
    2: { test: { pts_ppr: 20 } },
    3: { test: { pts_ppr: 0 } },
    4: {},
  });
  check("aggregateSeason aggregates weeks", agg !== null && agg.games === 3 && agg.total === 30, agg ? `games=${agg.games} total=${agg.total} ppg=${agg.ppg}` : "null");

  const aggMissing = aggregateSeason("other", "RB", 2025, { 1: { test: { pts_ppr: 10 } } });
  check("aggregateSeason returns null when player has no games", aggMissing === null);

  const eliteYoung = computePlayerValue(
    fakePlayer({ age: 24, position: "RB" }),
    [fakeAgg({ ppg: 22, total: 374 })]
  );
  const agingDecline = computePlayerValue(
    fakePlayer({ age: 31, position: "RB" }),
    [fakeAgg({ ppg: 11, total: 187, boomRate: 0.1 })]
  );
  check(
    "value engine ranks elite young player above aging decline",
    (eliteYoung.score ?? 0) > (agingDecline.score ?? 0),
    `young=${eliteYoung.score} aging=${agingDecline.score}`
  );
  check(
    "elite young player scores as starter+ tier",
    (eliteYoung.score ?? 0) >= 70,
    `score=${eliteYoung.score} tier=${eliteYoung.tier}`
  );

  const injured = computePlayerValue(
    fakePlayer({ age: 24, position: "RB", injuryStatus: "IR" }),
    [fakeAgg({ ppg: 22, total: 374 })]
  );
  check(
    "injury status reduces value",
    (injured.score ?? 0) < (eliteYoung.score ?? 0),
    `injured=${injured.score} healthy=${eliteYoung.score}`
  );

  const noData = computePlayerValue(fakePlayer({ rookie: true }), []);
  check(
    "rookie with no data gets null score, not zero",
    noData.score === null && noData.tier === "Rookie / Prospect",
    `score=${noData.score} tier=${noData.tier}`
  );

  check(
    "sideValue applies diminishing returns",
    sideValue([100, 100]) < 200 && sideValue([100]) === 100,
    `two 100s = ${sideValue([100, 100])}`
  );

  check("ruleVerdict big gain = ACCEPT", ruleVerdict(50, 80) === "ACCEPT");
  check("ruleVerdict small loss = LEAN_DECLINE", ruleVerdict(80, 72) === "LEAN_DECLINE");
  check("ruleVerdict even = FAIR", ruleVerdict(70, 70) === "FAIR");
  check("ruleVerdict big loss = DECLINE", ruleVerdict(80, 50) === "DECLINE");
}

async function integrationTests(): Promise<void> {
  console.log("\n=== Integration tests (live APIs) ===\n");

  const seasons = statSeasons();
  console.log(`info  stat seasons: ${seasons.join(", ")}`);
  check(
    "stat seasons resolve to two recent years",
    seasons[0] >= 2025 && seasons[0] - seasons[1] === 1
  );

  const players = await fetchAllPlayers();
  check("Sleeper players fetch", players.size > 1000, `${players.size} fantasy-relevant players`);
  const name = [...players.values()].slice(0, 3).map((p) => `${p.name} (${p.position}/${p.team ?? "FA"})`).join(", ");
  console.log(`info  sample players: ${name}`);

  const mahomes = [...players.values()].find((p) => p.name === "Patrick Mahomes");
  check("known player present (Patrick Mahomes)", Boolean(mahomes));
  if (mahomes) {
    console.log(`info  Mahomes: id=${mahomes.id} age=${mahomes.age} yearsExp=${mahomes.yearsExp}`);
  }

  const week1 = await fetchWeeklyStats(seasons[0], 1);
  const week1Count = Object.keys(week1).length;
  check("weekly stats fetch + normalize", week1Count > 100, `week 1 ${seasons[0]}: ${week1Count} stat lines`);
  const sampleRow = Object.entries(week1).slice(0, 5).map(([pid, row]) => `${players.get(pid)?.name ?? pid}: ${row.pts_ppr ?? "no pts_ppr"}`).join("; ");
  console.log(`info  week 1 sample rows: ${sampleRow}`);

  const computed = await computeAllPlayers();
  check("computeAllPlayers builds full value board", computed.size > 1000, `${computed.size} computed players`);

  const board = [...computed.values()].sort((a, b) => (b.value.score ?? -1) - (a.value.score ?? -1));
  console.log("info  top 15 by computed value:");
  board.slice(0, 15).forEach((entry, i) => {
    const latest = entry.aggs[0];
    console.log(
      `      ${String(i + 1).padStart(2)}. ${entry.player.name.padEnd(22)} ${entry.player.position} ${entry.player.team ?? "FA"} score=${entry.value.score} tier=${entry.value.tier} ppg=${latest?.ppg ?? "?"} rank=${latest?.posRank ?? "?"}`
    );
  });

  const knownElite = board.slice(0, 30).filter((e) => ["QB", "RB", "WR", "TE"].includes(e.player.position));
  check("top of value board is all skill positions", knownElite.length === Math.min(30, board.length), `${knownElite.length}/30`);

  const rb1 = board.find((e) => e.player.position === "RB");
  const wr1 = board.find((e) => e.player.position === "WR");
  const te1 = board.find((e) => e.player.position === "TE");
  check("positional ranks assigned", Boolean(rb1?.aggs[0]?.posRank && wr1?.aggs[0]?.posRank && te1?.aggs[0]?.posRank), `RB1 rank=${rb1?.aggs[0]?.posRank}, WR1 rank=${wr1?.aggs[0]?.posRank}, TE1 rank=${te1?.aggs[0]?.posRank}`);

  const kScores = board.filter((e) => e.player.position === "K").filter((e) => e.value.score !== null).length;
  const defScores = board.filter((e) => e.player.position === "DEF").filter((e) => e.value.score !== null).length;
  console.log(`info  kickers with computed value: ${kScores}, defenses: ${defScores}`);

  const news = await fetchNews();
  check("news aggregator returns items", news.length > 20, `${news.length} articles`);
  const bySource = new Map<string, number>();
  for (const item of news) bySource.set(item.source, (bySource.get(item.source) ?? 0) + 1);
  console.log(`info  news by source: ${[...bySource.entries()].map(([s, n]) => `${s}=${n}`).join(", ")}`);
  if (news.length > 0) {
    console.log(`info  latest headline: [${news[0].source}] ${news[0].title}`);
  }

  const trending = await fetchTrending("add", 24);
  check("trending fetch", trending.length > 5, `${trending.length} trending players`);
  const trendingNames = trending.slice(0, 5).map((t) => players.get(t.playerId)?.name ?? t.playerId);
  console.log(`info  trending adds: ${trendingNames.join(", ")}`);

  if (mahomes) {
    const bundle = await getPlayerBundles([mahomes.id]);
    check("player bundle builds", bundle.length === 1 && bundle[0].seasons.length > 0, `seasons=${bundle[0]?.seasons.length}, news matched=${bundle[0]?.news.length}`);
    if (bundle[0]) {
      const s = bundle[0].seasons[0];
      console.log(`info  Mahomes ${s.season}: ${s.games} games, ${s.total} total pts, ${s.ppg} ppg, boom ${(s.boomRate * 100).toFixed(0)}%, pos rank ${s.posRank}`);
      bundle[0].news.forEach((n) => console.log(`      news: [${n.source}] ${n.title}`));
      check("news matcher scoped to player", bundle[0].news.every((n) => `${n.title} ${n.summary}`.toLowerCase().includes("mahomes") || `${n.title} ${n.summary}`.toLowerCase().includes("chiefs")), "all matched items mention Mahomes/Chiefs");
    }
  }

  const give = [board[0], board[1]].map((e) => e.player.id);
  const get = [board[5], board[8], board[12]].map((e) => e.player.id);
  const [giveBundles, getBundles] = await Promise.all([getPlayerBundles(give), getPlayerBundles(get)]);
  const giveVal = sideValue(giveBundles.map((b) => b.value.score));
  const getVal = sideValue(getBundles.map((b) => b.value.score));
  const verdict = ruleVerdict(giveVal, getVal);
  check("end-to-end trade evaluation runs", typeof giveVal === "number" && typeof getVal === "number", `give=${giveVal} get=${getVal} verdict=${verdict}`);

  const roster = await getPlayerBundles(board.slice(0, 14).map((e) => e.player.id));
  const needs = computeNeeds(roster);
  check("roster needs analysis runs", Array.isArray(needs), needs.join(" | ") || "no needs flagged (deep roster)");

  const summaries = await getPlayerSummaries();
  check("player summaries sorted by value", summaries.length > 1000 && (summaries[0]?.value.score ?? -1) >= (summaries[50]?.value.score ?? -1), `total=${summaries.length}, top=${summaries[0]?.name} (${summaries[0]?.value.score})`);
}

async function main(): Promise<void> {
  console.log("Fantasy Football Trader — smoke test");
  await unitTests();
  await integrationTests();
  console.log("");
  if (failures > 0) {
    console.error(`${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("All checks passed");
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});
