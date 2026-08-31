import { PlayersTable } from "@/components/players-table";
import { listPlayerSummaries, PLAYER_SORT_KEYS } from "@/lib/nfl-data";
import type { PlayerSortKey } from "@/lib/nfl-data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Player Values",
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PlayersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = (first(params.q) ?? "").slice(0, 60);
  const posRaw = (first(params.pos) ?? "ALL").toUpperCase();
  const pos = ["QB", "RB", "WR", "TE", "K", "DEF"].includes(posRaw) ? posRaw : "ALL";
  const sortRaw = first(params.sort) ?? "score";
  const sort = (PLAYER_SORT_KEYS.includes(sortRaw as PlayerSortKey)
    ? sortRaw
    : "score") as PlayerSortKey;
  const dir = first(params.dir) === "asc" ? "asc" : "desc";

  const initial = await listPlayerSummaries({ q, pos, sort, dir, page: 0, pageSize: 50 });

  return (
    <PlayersTable
      initialPlayers={initial.players}
      initialTotal={initial.total}
      initialFilters={{ q, pos, sort, dir }}
    />
  );
}
