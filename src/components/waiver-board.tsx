"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Flame, Search } from "lucide-react";
import { PlayerAvatar } from "@/components/player-avatar";
import { PositionBadge } from "@/components/position-badge";
import { cn, formatPts, scoreColor } from "@/lib/utils";
import type { PlayerSummary } from "@/types";

const POSITIONS = ["ALL", "QB", "RB", "WR", "TE", "K", "DEF"];
const NEED_THRESHOLD = 55;

interface StoredLeaguePlayer {
  id: string;
  position: string;
  value: { score: number | null };
}

export function WaiverBoard({ players }: { players: PlayerSummary[] }) {
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("ALL");
  const [needs, setNeeds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("fft.league");
      if (!raw) return;
      const stored = JSON.parse(raw) as { players?: StoredLeaguePlayer[] };
      if (!Array.isArray(stored.players)) return;
      const byPos = new Map<string, number>();
      for (const p of stored.players) {
        const score = p.value?.score ?? -1;
        const current = byPos.get(p.position) ?? -1;
        if (score > current) byPos.set(p.position, score);
      }
      const weak = ["QB", "RB", "WR", "TE"].filter(
        (pos) => (byPos.get(pos) ?? -1) < NEED_THRESHOLD
      );
      setNeeds(weak);
    } catch {
    }
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players.filter((p) => {
      if (position !== "ALL" && p.position !== position) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q);
    });
  }, [players, query, position]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-6">
        <h1 className="font-display text-4xl tracking-wide text-slate-100 sm:text-5xl">
          WAIVER <span className="text-volt">WIRE</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          The most added players across fantasy leagues in the last 24 hours,
          ranked by trade value.{" "}
          {needs.length > 0
            ? `Badges mark players who fill your weak ${needs.join("/")} spot.`
            : "Connect your league to highlight players who fill your needs."}
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-lg border border-white/10 bg-slate-900/80 px-3 py-1.5 focus-within:border-volt/50 sm:max-w-sm">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search trending players..."
            aria-label="Search trending players"
            className="w-full bg-transparent py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {POSITIONS.map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => setPosition(pos)}
              className={cn(
                "rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors",
                position === pos
                  ? "border-volt/40 bg-volt/10 text-volt"
                  : "border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200"
              )}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/5 bg-slate-900/60">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-white/5 text-left text-[11px] uppercase tracking-wider text-slate-400">
              <th className="py-3 pl-4 pr-2 font-semibold">#</th>
              <th className="px-2 py-3 font-semibold">Player</th>
              <th className="px-2 py-3 font-semibold">Pos</th>
              <th className="px-2 py-3 text-right font-semibold">Adds</th>
              <th className="px-2 py-3 text-right font-semibold">PPG</th>
              <th className="px-2 py-3 text-right font-semibold">Bye</th>
              <th className="px-2 py-3 font-semibold">Tier</th>
              <th className="px-2 py-3 font-semibold">Value</th>
              <th className="py-3 pl-2 pr-4 font-semibold">Fit</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((player, index) => {
              const fits = needs.includes(player.position);
              return (
                <tr
                  key={player.id}
                  className="value-row-hover border-b border-white/5 transition-colors last:border-0 hover:bg-white/[0.03]"
                >
                  <td className="py-2.5 pl-4 pr-2 text-slate-400">{index + 1}</td>
                  <td className="px-2 py-2.5">
                    <Link href={`/player/${player.id}`} className="flex items-center gap-2.5">
                      <PlayerAvatar
                        playerId={player.id}
                        name={player.name}
                        position={player.position}
                        team={player.team}
                        size="sm"
                      />
                      <span className="max-w-[200px] truncate font-medium text-slate-100 hover:text-volt">
                        {player.name}
                      </span>
                      {player.injuryStatus && (
                        <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">
                          {player.injuryStatus}
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="px-2 py-2.5">
                    <PositionBadge position={player.position} />
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Flame className="h-3.5 w-3.5 text-orange-400" />
                      {player.trendCount ?? 0}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-slate-300">
                    {formatPts(player.value.ppg)}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-slate-400">
                    {player.byeWeek ? `W${player.byeWeek}` : "—"}
                  </td>
                  <td className="px-2 py-2.5 text-xs text-slate-400">{player.value.tier}</td>
                  <td className={cn("px-2 py-2.5 font-display text-lg", scoreColor(player.value.score))}>
                    {player.value.score ?? "—"}
                  </td>
                  <td className="py-2.5 pl-2 pr-4">
                    {fits ? (
                      <span className="rounded-full border border-volt/30 bg-volt/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-volt">
                        Fills your {player.position} need
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
