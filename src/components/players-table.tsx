"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Search, TrendingUp } from "lucide-react";
import { PlayerAvatar } from "@/components/player-avatar";
import { PositionBadge } from "@/components/position-badge";
import { WatchStar } from "@/components/watch-star";
import { cn, formatPts, scoreBarColor, scoreColor } from "@/lib/utils";
import type { PlayerSummary } from "@/types";

const POSITIONS = ["ALL", "QB", "RB", "WR", "TE", "K", "DEF"];
const PAGE_SIZE = 50;

type SortKey = "score" | "ppg" | "proj" | "games" | "posRank" | "age" | "name";
type SortDir = "asc" | "desc";

interface Filters {
  q: string;
  pos: string;
  sort: SortKey;
  dir: SortDir;
}

export function PlayersTable({
  initialPlayers,
  initialTotal,
  initialFilters,
}: {
  initialPlayers: PlayerSummary[];
  initialTotal: number;
  initialFilters: Filters;
}) {
  const [query, setQuery] = useState(initialFilters.q);
  const [debouncedQ, setDebouncedQ] = useState(initialFilters.q);
  const [position, setPosition] = useState(initialFilters.pos);
  const [sortKey, setSortKey] = useState<SortKey>(initialFilters.sort);
  const [sortDir, setSortDir] = useState<SortDir>(initialFilters.dir);
  const [players, setPlayers] = useState<PlayerSummary[]>(initialPlayers);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isFirstRender = useRef(true);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const buildParams = useCallback(
    (page: number) => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      params.set("sort", sortKey);
      params.set("dir", sortDir);
      if (position !== "ALL") params.set("pos", position);
      if (debouncedQ.trim()) params.set("q", debouncedQ.trim());
      return params;
    },
    [sortKey, sortDir, position, debouncedQ]
  );

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    listPlayerSummariesApi(buildParams(0))
      .then((data) => {
        if (cancelled) return;
        setPlayers(data.players);
        setTotal(data.total);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load players.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [buildParams]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQ.trim()) params.set("q", debouncedQ.trim());
    if (position !== "ALL") params.set("pos", position);
    if (sortKey !== "score") params.set("sort", sortKey);
    if (sortDir !== "desc") params.set("dir", sortDir);
    const qs = params.toString();
    const href = qs ? `/players?${qs}` : "/players";
    const search = typeof window !== "undefined" ? window.location.search : "";
    if (`/players${search}` !== href) {
      window.history.replaceState(null, "", href);
    }
  }, [debouncedQ, position, sortKey, sortDir]);

  const hasMore = players.length < total;

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listPlayerSummariesApi(
        buildParams(Math.ceil(players.length / PAGE_SIZE))
      );
      setPlayers((prev) => [...prev, ...data.players]);
      setTotal(data.total);
    } catch {
      setError("Failed to load more players.");
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, players.length, buildParams]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMore();
        }
      },
      { rootMargin: "400px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
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
          Showing{" "}
          <span className="font-semibold text-slate-300">{players.length}</span>{" "}
          of <span className="font-semibold text-slate-300">{total.toLocaleString()}</span>{" "}
          players
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2.5 focus-within:border-volt/50 sm:max-w-sm">
          <Search className="h-4 w-4 shrink-0 text-slate-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search players..."
            className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {POSITIONS.map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => setPosition(pos)}
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
                <SortButton label="Proj" active={sortKey === "proj"} dir={sortDir} onClick={() => toggleSort("proj")} />
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
            {players.map((player, index) => (
              <PlayerRow key={player.id} player={player} rank={index + 1} />
            ))}
            {loading && (
              <tr>
                <td colSpan={12} className="px-4 py-6 text-center text-sm text-slate-500">
                  Loading players...
                </td>
              </tr>
            )}
            {error && (
              <tr>
                <td colSpan={12} className="px-4 py-6 text-center text-sm text-red-400">
                  {error}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-slate-600">
          {hasMore
            ? `${(total - players.length).toLocaleString()} more on the board`
            : "End of board"}
        </p>
        {hasMore ? (
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300 transition-colors enabled:hover:border-volt/40 enabled:hover:text-volt disabled:opacity-40"
          >
            Load more
          </button>
        ) : null}
      </div>
      <div ref={sentinelRef} className="h-px w-full" aria-hidden="true" />
    </div>
  );
}

async function listPlayerSummariesApi(
  params: URLSearchParams
): Promise<{ players: PlayerSummary[]; total: number }> {
  const res = await fetch(`/api/players?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`players api failed (${res.status})`);
  const data = (await res.json()) as {
    ok: boolean;
    players: PlayerSummary[];
    total: number;
  };
  if (!data.ok) throw new Error("players api returned error");
  return { players: data.players, total: data.total };
}

function PlayerRow({ player, rank }: { player: PlayerSummary; rank: number }) {
  return (
    <tr className="value-row-hover border-b border-white/5 transition-colors last:border-0 hover:bg-white/[0.03]">
      <td className="py-2.5 pl-4 pr-2 text-slate-600">{rank}</td>
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
      <td className="px-2 py-2.5 text-right tabular-nums">
        <span
          className={cn(
            player.projection?.source === "espn"
              ? "text-slate-200"
              : "text-slate-500"
          )}
        >
          {formatPts(player.projection?.ppg)}
        </span>
        {player.projection?.source === "espn" && (
          <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-volt align-middle" />
        )}
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
  dir: SortDir;
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
