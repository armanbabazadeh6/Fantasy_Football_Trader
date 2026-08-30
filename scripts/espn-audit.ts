import { readFileSync } from "fs";
import {
  buildSleeperIndexes,
  espnPlayerName,
  fetchEspnLeague,
  normalizeNameKey,
  resolveEspnPosition,
  espnProTeamToAbbr,
} from "@/lib/espn";
import { computeAllPlayers } from "@/lib/nfl-data";
import { statSeasons } from "@/lib/sleeper";

interface EspnStatEntry {
  statSourceId?: number;
  statSplitTypeId?: number;
  seasonId?: number;
  appliedTotal?: number;
}

async function main() {
  const [, , cookieFile, leagueId] = process.argv;
  if (!cookieFile || !leagueId) {
    console.error("usage: tsx scripts/espn-audit.ts <cookie-file> <league-id>");
    process.exit(1);
  }
  const cookie = readFileSync(cookieFile, "utf8").trim();

  const [espnLeague, computed] = await Promise.all([
    fetchEspnLeague(leagueId, { rawCookie: cookie }),
    computeAllPlayers(),
  ]);
  const indexes = buildSleeperIndexes(computed);
  const auditSeason = Math.max(...statSeasons());

  let compared = 0;
  let withinTolerance = 0;
  let missingSleeper = 0;
  let missingEspn = 0;
  const bigDeltas: { name: string; espn: number; ours: number }[] = [];
  const positionMismatches: { name: string; espnPos: string; sleeperPos: string }[] = [];
  const unmatchedPlayers: string[] = [];

  for (const team of espnLeague.teams) {
    for (const entry of team.roster?.entries ?? []) {
      const espnPlayer = entry?.playerPoolEntry?.player;
      if (!espnPlayer) continue;
      const name = espnPlayerName(espnPlayer);
      if (!name) continue;

      let sleeperId: string | null = null;
      let matched = null as null | (typeof computed extends Map<string, infer V> ? V : never);
      const posKey = resolveEspnPosition(espnPlayer);
      const espnTeamAbbr = espnProTeamToAbbr(espnPlayer);
      if (posKey === "DEF" && espnTeamAbbr) {
        const def = indexes.defByTeam.get(espnTeamAbbr);
        if (def) {
          sleeperId = def.id;
          matched = computed.get(def.id) ?? null;
        }
      } else {
        const candidates = indexes.byNamePos.get(`${normalizeNameKey(name)}|${posKey}`) ?? [];
        const loose = indexes.byNameOnly.get(normalizeNameKey(name)) ?? [];
        const pool = candidates.length > 0 ? candidates : loose;
        const pick =
          pool.length === 1
            ? pool[0]
            : pool.find((p) => p.team === espnTeamAbbr) ?? null;
        if (pick) {
          sleeperId = pick.id;
          matched = computed.get(pick.id) ?? null;
        }
      }

      if (!matched) {
        unmatchedPlayers.push(name);
        continue;
      }

      const espnSeasonStat = (espnPlayer.stats as EspnStatEntry[] | undefined)?.find(
        (stat) =>
          stat.statSourceId === 0 &&
          stat.statSplitTypeId === 0 &&
          stat.seasonId === auditSeason
      );
      const espnTotal = espnSeasonStat?.appliedTotal ?? null;
      const ourAgg = matched.aggs.find((agg) => agg.season === auditSeason) ?? null;
      const ourTotal = ourAgg?.total ?? null;

      if (posKey && matched.player.position && posKey !== matched.player.position) {
        positionMismatches.push({
          name,
          espnPos: posKey,
          sleeperPos: matched.player.position,
        });
      }

      if (espnTotal === null) {
        missingEspn += 1;
        continue;
      }
      if (ourTotal === null) {
        missingSleeper += 1;
        continue;
      }

      compared += 1;
      const delta = Math.abs(espnTotal - ourTotal);
      if (delta <= 2) {
        withinTolerance += 1;
      } else {
        bigDeltas.push({ name, espn: espnTotal, ours: ourTotal });
      }
    }
  }

  console.log(`audit season: ${auditSeason}`);
  console.log(`compared: ${compared} players`);
  console.log(`matched within 2.0 pts: ${withinTolerance} (${compared > 0 ? Math.round((withinTolerance / compared) * 100) : 0}%)`);
  console.log(`deltas over 2.0 pts: ${bigDeltas.length}`);
  for (const d of bigDeltas.slice(0, 15)) {
    console.log(`  ${d.name}: espn=${d.espn} ours=${d.ours} (delta ${(d.espn - d.ours).toFixed(1)})`);
  }
  console.log(`no ESPN season stat: ${missingEspn} · no Sleeper stat: ${missingSleeper}`);
  console.log(`unmatched to Sleeper: ${unmatchedPlayers.length}${unmatchedPlayers.length ? ` — ${unmatchedPlayers.slice(0, 10).join(", ")}` : ""}`);
  console.log(`position display differences (ESPN vs Sleeper): ${positionMismatches.length}`);
  for (const p of positionMismatches.slice(0, 15)) {
    console.log(`  ${p.name}: ESPN=${p.espnPos} Sleeper=${p.sleeperPos}`);
  }
}

main().catch((err) => {
  console.error("AUDIT FAILED:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
