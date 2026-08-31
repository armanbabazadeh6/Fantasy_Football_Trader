import { fetchAllPlayers, fetchWeeklyStats, fetchTrending, statSeasons } from "@/lib/sleeper";
import { aggregateSeason, extractPPR } from "@/lib/fantasy";
import { computeAllPlayers, getPlayerBundles, getPlayerSummaries } from "@/lib/nfl-data";
import { fetchNews, matchNewsForPlayer } from "@/lib/news";
import { fetchTeamByeWeeks } from "@/lib/schedule";
import { restOfSeasonGames } from "@/lib/schedule";
import { blendProjection, computeProjectionSummary, getEspnProjections, projectionsNeedSync } from "@/lib/projections";
import { classifyNews, dedupeKeyFor, getArchivedNews, ingestNews } from "@/lib/news-archive";
import { buildCardSvg, escapeXml, wrapText } from "@/lib/share-card";
import { computeValueTrends, recordDailyScores } from "@/lib/value-history";
import { getDb } from "@/lib/db";
import { findTradePartners, optimalLineup, powerRankings, proposeTrades } from "@/lib/league-intel";
import { espnTeamToSleeper, normalizeEspnPosition, normalizeNameKey } from "@/lib/espn";
import type { LeagueTeam, PlayerSummary } from "@/types";
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

  check(
    "espn name normalization handles hyphens, punctuation, and suffixes",
    normalizeNameKey("Amon-Ra St. Brown Jr.") === "amonrastbrown" &&
      normalizeNameKey("Amon Ra St. Brown") === normalizeNameKey("Amon-Ra St. Brown") &&
      normalizeNameKey("D.J. Moore") === normalizeNameKey("DJ Moore")
  );
  check(
    "espn position normalization handles D/ST",
    normalizeEspnPosition("D/ST") === "DEF" && normalizeEspnPosition("WR") === "WR"
  );
  check(
    "espn team abbreviation maps WSH to WAS",
    espnTeamToSleeper("WSH") === "WAS" && espnTeamToSleeper("KC") === "KC"
  );

  check(
    "xml escaping handles special characters",
    escapeXml(`Ja'Marr <&> "Chase"`) === "Ja&apos;Marr &lt;&amp;&gt; &quot;Chase&quot;"
  );
  const wrapped = wrapText("one two three four five six seven eight", 11, 2);
  check(
    "share card text wraps to max lines",
    wrapped.length === 2 && wrapped[0].length <= 11
  );
  const cardFixture = {
    ok: true,
    give: [
      {
        id: "1",
        name: "Ja'Marr Chase",
        position: "WR",
        team: "CIN",
        status: "Active",
        rookie: false,
        value: { score: 84, tier: "Elite Starter", ppg: 19.6, games: 16 },
        seasons: [],
        news: [],
      },
    ],
    get: [],
    engine: { giveValue: 84, getValue: 120, diff: 36, verdict: "LEAN_DECLINE" as const, needs: [] },
    ai: null,
    aiConfigured: false,
    generatedAt: new Date().toISOString(),
  };
  const svg = buildCardSvg(cardFixture, "LEAN_DECLINE");
  check(
    "share card builds valid svg with escaped names and verdict",
    svg.startsWith("<svg") &&
      svg.includes("Ja&apos;Marr Chase") &&
      svg.includes("LEAN DECLINE") &&
      !svg.includes("<&")
  );

  const makePlayer = (id: string, name: string, position: string, score: number | null, ppg: number | null): PlayerSummary => ({
    id,
    name,
    position,
    team: "KC",
    status: "Active",
    rookie: false,
    value: { score, tier: score === null ? "Unknown" : "Starter", ppg, games: 16 },
  });
  const makeTeam = (rosterId: number, teamName: string, players: PlayerSummary[], wins = 5, losses = 5, fpts = 1000): LeagueTeam => ({
    rosterId,
    teamName,
    displayName: "",
    wins,
    losses,
    ties: 0,
    fpts,
    players,
    starters: [],
    totalValue: Math.round(players.reduce((sum, p) => sum + (p.value.score ?? 0), 0)),
  });

  const qbA = makePlayer("q1", "Alpha QB", "QB", 80, 20);
  const rbWeak = makePlayer("r1", "Weak RB", "RB", 40, 8);
  const stackTeam = makeTeam(1, "Stacked", [qbA, rbWeak, makePlayer("w1", "Star WR", "WR", 90, 22), makePlayer("r2", "Backup RB", "RB", 65, 12)], 10, 2, 1400);
  const rbHeavy = makeTeam(2, "RB Rich", [makePlayer("r3", "Elite RB", "RB", 92, 23), makePlayer("r4", "Good RB", "RB", 75, 15), makePlayer("q2", "Bad QB", "QB", 30, 10), makePlayer("w2", "Fine WR", "WR", 60, 14)], 4, 8, 1100);
  const myTeam = makeTeam(3, "My Team", [makePlayer("q3", "Shaky QB", "QB", 40, 11), makePlayer("r5", "Barely RB", "RB", 35, 7), makePlayer("w3", "Fine WR", "WR", 70, 16), makePlayer("k1", "Solid K", "K", 60, 8)], 5, 5, 1000);
  const teams = [stackTeam, rbHeavy, myTeam];

  const ranks = powerRankings(teams);
  check(
    "power rankings rank the stronger team first",
    ranks.length === 3 && ranks[0].teamName === "Stacked" && ranks[0].rank === 1,
    `order: ${ranks.map((r) => `${r.teamName}(${Math.round(r.powerScore)})`).join(" > ")}`
  );

  const partners = findTradePartners(teams, 3);
  check(
    "trade partner finder spots RB surplus for weak RB team",
    partners.length === 1 &&
      partners[0].teamName === "RB Rich" &&
      partners[0].targets.some((t) => t.position === "RB" && t.targetName === "Good RB"),
    partners.length ? `target: ${partners[0].targets[0].targetName}` : "no partners"
  );

  const lineup = optimalLineup(stackTeam.players, { QB: 1, RB: 1, WR: 1, FLEX: 1, K: 1, DEF: 1 });
  check(
    "optimal lineup fills slots with best players",
    lineup.starters.find((s) => s.slot === "QB")?.player?.name === "Alpha QB" &&
      lineup.starters.find((s) => s.slot === "RB")?.player?.name === "Backup RB" &&
      lineup.starters.find((s) => s.slot === "FLEX")?.player?.name === "Weak RB",
    lineup.starters.map((s) => `${s.slot}:${s.player?.name ?? "—"}`).join(" ")
  );
  check(
    "optimal lineup leaves K/DEF empty when unavailable and sums projections",
    lineup.starters.find((s) => s.slot === "K")?.player === null &&
      lineup.projectedTotal > 0,
    `projected ${lineup.projectedTotal}`
  );

  const me = makeTeam(4, "Proposer", [
    makePlayer("p1", "Start WR", "WR", 70, 18),
    makePlayer("p2", "Bench WR", "WR", 62, 14),
    makePlayer("p3", "Starter QB", "QB", 50, 17),
    makePlayer("p4", "Thin RB", "RB", 35, 8),
  ]);
  const them = makeTeam(5, "RB Factory", [
    makePlayer("p5", "Elite RB", "RB", 92, 23),
    makePlayer("p6", "Backup RB", "RB", 68, 15),
    makePlayer("p7", "Their QB", "QB", 30, 10),
  ]);
  const suggested = proposeTrades([me, them], 4);
  check(
    "trade proposer generates value-balanced upgrade",
    suggested.length === 1 &&
      suggested[0].youGive[0]?.name === "Bench WR" &&
      suggested[0].youGet[0]?.name === "Backup RB" &&
      Math.abs(suggested[0].giveValue - suggested[0].getValue) <= 10,
    suggested.length
      ? `${suggested[0].youGive.map((p) => p.name).join("+")} for ${suggested[0].youGet.map((p) => p.name).join("+")}`
      : "none"
  );
  const noDepth = makeTeam(6, "No Depth", [
    makePlayer("q1", "Solo WR", "WR", 80, 20),
    makePlayer("q2", "Solo RB", "RB", 80, 20),
  ]);
  check(
    "trade proposer stays quiet with nothing spare to offer",
    proposeTrades([noDepth, them], 6).length === 0
  );

  const db = getDb();
  db.exec("DELETE FROM value_history");
  db.prepare(
    "INSERT INTO value_history (player_id, date, score) VALUES ('smoke-a', '2000-01-01', 40)"
  ).run();
  recordDailyScores(new Map([["smoke-a", 45]]));
  const trendMap = computeValueTrends(new Map([["smoke-a", 45]]));
  check(
    "value history records snapshots and computes deltas",
    trendMap.get("smoke-a") === 5,
    `delta=${trendMap.get("smoke-a")}`
  );
  db.prepare("DELETE FROM value_history WHERE player_id = 'smoke-a'").run();

  check(
    "projection blend weights espn and engine",
    blendProjection(20, 10).ppg === 15.5 && blendProjection(20, 10).source === "espn",
    `blend=${blendProjection(20, 10).ppg}`
  );
  check(
    "projection blend falls back to single sources",
    blendProjection(20, null).ppg === 20 &&
      blendProjection(null, 12).ppg === 12 &&
      blendProjection(null, null).ppg === 0
  );
  check(
    "rest of season counts remaining games with byes",
    restOfSeasonGames(undefined, 0) === 18 &&
      restOfSeasonGames(9, 0) === 17 &&
      restOfSeasonGames(3, 5) === 13 &&
      restOfSeasonGames(8, 5) === 12,
    `preseason=${restOfSeasonGames(9, 0)} week5-bye8=${restOfSeasonGames(8, 5)}`
  );
  const proj = computeProjectionSummary(21.8, 20.75, 5, 0);
  check(
    "projection summary computes ros points",
    proj.rosGames === 17 && proj.rosPoints === Math.round(proj.ppg * 17 * 10) / 10,
    `ppg=${proj.ppg} ros=${proj.rosPoints} over ${proj.rosGames}`
  );

  db.prepare("DELETE FROM projections WHERE player_id = 'smoke-proj'").run();
  db.prepare(
    "INSERT INTO projections (player_id, season, projected_total, projected_ppg, fetched_at) VALUES ('smoke-proj', ?, 300, 18.5, ?)"
  ).run(new Date().getFullYear(), new Date().toISOString());
  const projMap = getEspnProjections();
  check(
    "projections roundtrip through sqlite",
    projMap.get("smoke-proj")?.ppg === 18.5,
    `ppg=${projMap.get("smoke-proj")?.ppg}`
  );
  db.prepare("DELETE FROM projections WHERE player_id = 'smoke-proj'").run();
  db.exec("DELETE FROM projections");
  check("projections sync flag true when empty", projectionsNeedSync());

  check(
    "news classifier routes categories",
    classifyNews("Patrick Mahomes questionable for Week 1 with ankle injury") === "injury" &&
      classifyNews("Bears acquire edge rusher in blockbuster trade") === "transaction" &&
      classifyNews("Rookie named starter after camp battle") === "depth" &&
      classifyNews("Ten breakout candidates for 2026") === "performance" &&
      classifyNews("NFL announces 2026 kickoff times") === "general"
  );
  check(
    "news dedupe keys match across stop-word variants",
    dedupeKeyFor("Mahomes questionable for Week 1") ===
      dedupeKeyFor("Mahomes is questionable in Week 1"),
    `key=${dedupeKeyFor("Mahomes questionable for Week 1")}`
  );
  const ingested = await ingestNews();
  check(
    "news archive ingests live feed",
    ingested.inserted > 0,
    `inserted=${ingested.inserted} skipped=${ingested.skipped}`
  );
  const injuries = await getArchivedNews({ category: "injury", limit: 50 });
  const allArchive = await getArchivedNews({ limit: 500 });
  check(
    "news archive filters by category",
    injuries.length > 0 &&
      injuries.every((item) => item.category === "injury") &&
      allArchive.length > injuries.length,
    `archive=${allArchive.length} injuries=${injuries.length}`
  );
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
  const withByes = summaries.filter((p) => p.byeWeek);
  check("bye weeks attached to summaries", withByes.length > 200, `${withByes.length} players carry a bye week`);

  const byes = await fetchTeamByeWeeks();
  const byeValues = Object.values(byes);
  check(
    "bye week map covers teams and valid weeks",
    Object.keys(byes).length >= 30 && byeValues.every((w) => w >= 5 && w <= 14),
    `${Object.keys(byes).length} teams, weeks ${Math.min(...byeValues)}-${Math.max(...byeValues)}`
  );
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
