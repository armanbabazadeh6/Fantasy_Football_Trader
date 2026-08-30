"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { PlayerAvatar } from "@/components/player-avatar";
import { PositionBadge } from "@/components/position-badge";
import { cn, formatPts } from "@/lib/utils";
import { teamDisplayName } from "@/lib/teams";
import type { PlayerSummary } from "@/types";

interface PlayerSearchProps {
  onAdd: (player: PlayerSummary) => void;
  disabledIds: string[];
}

export function PlayerSearch({ onAdd, disabledIds }: PlayerSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayerSummary[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      const q = query.trim();
      if (q.length < 2) {
        setResults([]);
        setOpen(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/players?q=${encodeURIComponent(q)}&limit=8`);
        const data = (await res.json()) as { ok: boolean; players: PlayerSummary[] };
        if (!cancelled && data.ok) {
          setResults(data.players);
          setHighlight(0);
          setOpen(true);
        }
      } catch {
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function add(player: PlayerSummary) {
    onAdd(player);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open || results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((h) => (h + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((h) => (h - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const player = results[highlight];
      if (player && !disabledIds.includes(player.id)) {
        add(player);
      }
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2.5 transition-colors focus-within:border-volt/50">
        <Search className="h-4 w-4 shrink-0 text-slate-500" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          placeholder="Search a player..."
          className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none"
        />
        {loading && <Loader2 className="h-4 w-4 animate-spin text-volt" />}
      </div>

      {open && (loading || results.length > 0) && (
        <div className="absolute z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-white/10 bg-slate-900 shadow-2xl shadow-black/60">
          {loading && results.length === 0 && (
            <p className="px-4 py-3 text-sm text-slate-500">Searching players...</p>
          )}
          {results.map((player, index) => {
            const disabled = disabledIds.includes(player.id);
            return (
              <button
                key={player.id}
                type="button"
                disabled={disabled}
                onClick={() => add(player)}
                onMouseEnter={() => setHighlight(index)}
                className={cn(
                  "flex w-full items-center gap-3 border-b border-transparent px-3 py-2.5 text-left transition-colors",
                  index === highlight && !disabled && "bg-white/5",
                  disabled ? "cursor-not-allowed opacity-40" : "hover:bg-white/5"
                )}
              >
                <PlayerAvatar
                  playerId={player.id}
                  name={player.name}
                  position={player.position}
                  team={player.team}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-sm font-medium text-slate-100">
                    {player.name}
                    {player.injuryStatus && (
                      <span className="shrink-0 rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">
                        {player.injuryStatus}
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    <PositionBadge position={player.position} className="mr-1" />
                    {teamDisplayName(player.team)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display text-lg leading-none text-slate-100">
                    {player.value.score ?? "—"}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {player.value.ppg !== null ? `${formatPts(player.value.ppg)} ppg` : "no data"}
                  </p>
                </div>
              </button>
            );
          })}
          {!loading && results.length === 0 && query.trim().length >= 2 && (
            <p className="px-4 py-3 text-sm text-slate-500">No players found.</p>
          )}
        </div>
      )}
    </div>
  );
}
