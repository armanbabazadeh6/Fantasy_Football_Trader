import Link from "next/link";
import { PlayersTable } from "@/components/players-table";
import { getPlayerSummaries, listPlayerSummaries, PLAYER_SORT_KEYS } from "@/lib/nfl-data";
import type { PlayerSortKey } from "@/lib/nfl-data";
import { cn } from "@/lib/utils";

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
  const rookies = first(params.rookies) === "1";
  const sortRaw = first(params.sort) ?? "score";
  const sort = (PLAYER_SORT_KEYS.includes(sortRaw as PlayerSortKey)
    ? sortRaw
    : "score") as PlayerSortKey;
  const dir = first(params.dir) === "asc" ? "asc" : "desc";

  const [initial, summaries] = await Promise.all([
    listPlayerSummaries({ q, pos, rookies: rookies ? true : undefined, sort, dir, page: 0, pageSize: 50 }),
    getPlayerSummaries(),
  ]);
  const risers = summaries
    .filter((p) => (p.valueTrend ?? 0) > 0)
    .sort((a, b) => (b.valueTrend ?? 0) - (a.valueTrend ?? 0))
    .slice(0, 5);
  const fallers = summaries
    .filter((p) => (p.valueTrend ?? 0) < 0)
    .sort((a, b) => (a.valueTrend ?? 0) - (b.valueTrend ?? 0))
    .slice(0, 5);

  return (
    <div>
      <div className="mx-auto grid max-w-7xl gap-3 px-4 pt-10 sm:grid-cols-2 sm:px-6">
        <MoversRail
          title="Top risers"
          players={risers.map((p) => ({ id: p.id, name: p.name, trend: p.valueTrend ?? 0 }))}
          positive
        />
        <MoversRail
          title="Top fallers"
          players={fallers.map((p) => ({ id: p.id, name: p.name, trend: p.valueTrend ?? 0 }))}
          positive={false}
        />
      </div>
      <PlayersTable
        initialPlayers={initial.players}
        initialTotal={initial.total}
        initialFilters={{ q, pos, rookies, sort, dir }}
      />
    </div>
  );
}

function MoversRail({
  title,
  players,
  positive,
}: {
  title: string;
  players: { id: string; name: string; trend: number }[];
  positive: boolean;
}) {
  if (players.length === 0) return null;
  return (
    <section className="rounded-xl border border-white/5 bg-slate-900/60 p-4">
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </h2>
      <ol className="mt-2 space-y-1.5">
        {players.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
            <Link href={`/player/${p.id}`} className="truncate text-slate-200 hover:text-volt">
              {p.name}
            </Link>
            <span
              className={cn(
                "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold",
                positive
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-rose-500/15 text-rose-300"
              )}
            >
              {p.trend > 0 ? `+${p.trend}` : p.trend}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
