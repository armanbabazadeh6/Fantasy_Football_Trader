"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, Search, TrendingUp } from "lucide-react";
import { PlayerAvatar } from "@/components/player-avatar";
import { PositionBadge } from "@/components/position-badge";
import { WatchStar } from "@/components/watch-star";
import { cn, formatPts, scoreBarColor, scoreColor } from "@/lib/utils";
import type { PlayerSummary } from "@/types";

const POSITIONS = ["ALL", "QB", "RB", "WR", "TE", "K", "DEF"];
const PAGE_SIZE = 50;

type SortKey = "score" | "ppg" | "games" | "posRank" | "age" | "name";

export function PlayersTable({ players }: { players: PlayerSummary[] }) {
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players.filter((p) => {
      if (position !== "ALL" && p.position !== position) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q);
    });
  }, [players, query, position]);

  const sorted = useMemo(() => {
    const dir = sortDir === "desc" ? -1 : 1;
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "ppg":
          return ((a.value.ppg ?? -1) - (b.value.ppg ?? -1)) * dir;
        case "games":
          return (a.value.games - b.value.games) * dir;
        case "posRank":
          return ((a.posRank ?? 9999) - (b.posRank ?? 9999)) * dir;
        case "age":
          return ((a.age ?? 99) - (b.age ?? 99)) * dir;
        default:
          return ((a.value.score ?? -1) - (b.value.score ?? -1)) * dir;
      }
    });
  }, [filtered, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(0);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl tracking-wide text-slate-100 sm:text-5xl">
            PLAYER <span className="text-volt">VALUES</span>
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Every fantasy-relevant NFL player scored by the value engine — two
            seasons of PPR data, consistency, age curve, and injuries.
          </p>
        </div>
        <p className="text-sm text-slate-500">
          Showing <span className="font-semibold text-slate-300">{rows.length}</span> of{" "}
          <span className="font-semibold text-slate-300">{filtered.length.toLocaleString()}</span> players
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2.5 focus-within:border-volt/50 sm:max-w-sm">
          <Search className="h-4 w-4 shrink-0 text-slate-500" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder="Search players..."
            className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {POSITIONS.map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => {
                setPosition(pos);
                setPage(0);
              }}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors",
                position === pos
                  ? "border-volt/40 bg-volt/10 text-volt"
                  : "border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200"
              )}
            >
              {pos}
            </button>
          ))}
        </div>
        <a
          href="/api/export/players"
          className="ml-auto rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-400 transition-colors hover:border-volt/40 hover:text-volt"
        >
          Export CSV
        </a>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/5 bg-slate-900/60">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-white/5 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="py-3 pl-4 pr-2 font-semibold">#</th>
              <th className="px-2 py-3 font-semibold">
                <SortButton label="Player" active={sortKey === "name"} dir={sortDir} onClick={() => toggleSort("name")} />
              </th>
              <th className="px-2 py-3 font-semibold">Pos</th>
              <th className="px-2 py-3 font-semibold">Team</th>
              <th className="px-2 py-3 text-right font-semibold">
                <SortButton label="PPG" active={sortKey === "ppg"} dir={sortDir} onClick={() => toggleSort("ppg")} />
              </th>
              <th className="px-2 py-3 text-right font-semibold">
                <SortButton label="Gms" active={sortKey === "games"} dir={sortDir} onClick={() => toggleSort("games")} />
              </th>
              <th className="px-2 py-3 text-right font-semibold">
                <SortButton label="Rank" active={sortKey === "posRank"} dir={sortDir} onClick={() => toggleSort("posRank")} />
              </th>
              <th className="px-2 py-3 text-center font-semibold">Bye</th>
              <th className="px-2 py-3 text-right font-semibold">
                <SortButton label="Age" active={sortKey === "age"} dir={sortDir} onClick={() => toggleSort("age")} />
              </th>
              <th className="px-2 py-3 font-semibold">
                <SortButton label="Value" active={sortKey === "score"} dir={sortDir} onClick={() => toggleSort("score")} />
              </th>
              <th className="py-3 pl-2 pr-4 font-semibold">Tier</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((player, index) => (
              <tr
                key={player.id}
                className="value-row-hover border-b border-white/5 transition-colors last:border-0 hover:bg-white/[0.03]"
              >
                <td className="py-2.5 pl-4 pr-2 text-slate-600">
                  {safePage * PAGE_SIZE + index + 1}
                </td>
                <td className="px-2 py-2.5">
                  <Link href={`/player/${player.id}`} className="flex items-center gap-2.5">
                    <WatchStar playerId={player.id} playerName={player.name} className="shrink-0" />
                    <PlayerAvatar
                      playerId={player.id}
                      name={player.name}
                      position={player.position}
                      team={player.team}
                      size="sm"
                    />
                    <span className="max-w-[180px] truncate font-medium text-slate-100 hover:text-volt">
                      {player.name}
                    </span>
                    {player.injuryStatus && (
                      <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">
                        {player.injuryStatus}
                      </span>
                    )}
                    {player.trendCount ? (
                      <TrendingUp className="h-3.5 w-3.5 text-lime-400" />
                    ) : null}
                  </Link>
                </td>
                <td className="px-2 py-2.5">
                  <PositionBadge position={player.position} />
                </td>
                <td className="px-2 py-2.5 text-xs text-slate-400">
                  {player.team ?? "FA"}
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums text-slate-300">
                  {formatPts(player.value.ppg)}
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums text-slate-400">
                  {player.value.games || "—"}
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums text-slate-400">
                  {player.posRank ? `#${player.posRank}` : "—"}
                </td>
                <td className="px-2 py-2.5 text-center tabular-nums text-slate-400">
                  {player.byeWeek ? `W${player.byeWeek}` : "—"}
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums text-slate-400">
                  {player.age ?? "—"}
                </td>
                <td className="px-2 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className={cn("w-8 text-right font-display text-lg tabular-nums", scoreColor(player.value.score))}>
                      {player.value.score ?? "—"}
                    </span>
                    {player.valueTrend ? (
                      <span
                        className={cn(
                          "text-[10px] font-bold",
                          player.valueTrend > 0 ? "text-emerald-400" : "text-rose-400"
                        )}
                      >
                        {player.valueTrend > 0 ? "▲" : "▼"}
                        {Math.abs(player.valueTrend)}
                      </span>
                    ) : null}
                    <div className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-slate-800 sm:block">
                      {player.value.score !== null && (
                        <div
                          className={cn("h-full rounded-full", scoreBarColor(player.value.score))}
                          style={{ width: `${player.value.score}%` }}
                        />
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-2.5 pl-2 pr-4 text-xs text-slate-500">
                  {player.value.tier}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-slate-600">
          Page {safePage + 1} of {pageCount}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className="rounded-lg border border-white/10 p-2 text-slate-400 transition-colors enabled:hover:border-volt/40 enabled:hover:text-volt disabled:opacity-30"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={safePage >= pageCount - 1}
            className="rounded-lg border border-white/10 p-2 text-slate-400 transition-colors enabled:hover:border-volt/40 enabled:hover:text-volt disabled:opacity-30"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function SortButton({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 uppercase tracking-wider transition-colors",
        active ? "text-volt" : "hover:text-slate-300"
      )}
    >
      {label}
      <ChevronDown
        className={cn(
          "h-3.5 w-3.5 transition-transform",
          active ? (dir === "asc" ? "rotate-180" : "") : "opacity-30"
        )}
      />
    </button>
  );
}
