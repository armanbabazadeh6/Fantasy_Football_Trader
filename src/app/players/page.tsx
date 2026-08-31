import { PlayersTable } from "@/components/players-table";
import { getPlayerSummaries } from "@/lib/nfl-data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Player Values",
};

export default async function PlayersPage() {
  const players = await getPlayerSummaries();
  const light = players.map((p) => ({
    id: p.id,
    name: p.name,
    position: p.position,
    team: p.team,
    status: p.status,
    injuryStatus: p.injuryStatus,
    age: p.age,
    rookie: p.rookie,
    posRank: p.posRank,
    trendCount: p.trendCount,
    byeWeek: p.byeWeek,
    valueTrend: p.valueTrend,
    projection: p.projection,
    value: {
      score: p.value.score,
      tier: p.value.tier,
      ppg: p.value.ppg,
      games: p.value.games,
    },
  }));
  return <PlayersTable players={light} />;
}
