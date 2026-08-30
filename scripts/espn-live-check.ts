import { readFileSync } from "fs";
import { mapEspnLeagueToSleeper } from "@/lib/espn";
import { findTradePartners, optimalLineup, powerRankings } from "@/lib/league-intel";

async function main() {
  const [, , cookieFile, leagueId] = process.argv;
  if (!cookieFile || !leagueId) {
    console.error("usage: tsx scripts/espn-live-check.ts <cookie-file> <league-id>");
    process.exit(1);
  }
  const cookie = readFileSync(cookieFile, "utf8").trim();

  const result = await mapEspnLeagueToSleeper(leagueId, { rawCookie: cookie });

  console.log(`league: "${result.league.name}" (${result.league.scoringLabel})`);
  console.log(`roster slots: ${JSON.stringify(result.league.rosterSlots)}`);
  console.log(`teams: ${result.teams.length} · unmatched: ${result.unmatched.length}`);
  console.log("");

  for (const team of result.teams) {
    const top = team.players
      .slice(0, 3)
      .map((p) => `${p.name} ${p.value.score ?? "—"}`)
      .join(", ");
    console.log(`${team.teamName.padEnd(24)} value=${String(team.totalValue).padStart(4)}  ${team.wins}-${team.losses}  ${top}`);
  }

  if (result.unmatched.length > 0) {
    console.log(`\nunmatched (${result.unmatched.length}): ${result.unmatched.slice(0, 12).join(", ")}`);
  }

  console.log("\npower top 3:");
  for (const rank of powerRankings(result.teams).slice(0, 3)) {
    console.log(`  ${rank.rank}. ${rank.teamName} — ${Math.round(rank.powerScore)} (${rank.record})`);
  }

  const me = result.teams.find((t) => t.teamName.includes("Arman"));
  if (me) {
    console.log(`\npartners for ${me.teamName}:`);
    for (const partner of findTradePartners(result.teams, me.rosterId)) {
      const targets = partner.targets.map((t) => `${t.targetName} (${t.position})`).join(", ");
      console.log(`  ${partner.teamName}: ${targets}`);
    }
    if (result.league.rosterSlots) {
      const lineup = optimalLineup(me.players, result.league.rosterSlots);
      console.log(`\noptimal lineup (${lineup.projectedTotal} pts):`);
      console.log("  " + lineup.starters.map((s) => `${s.slot}:${s.player?.name ?? "—"}`).join(" | "));
    }
  }
}

main().catch((err) => {
  console.error("FAILED:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
