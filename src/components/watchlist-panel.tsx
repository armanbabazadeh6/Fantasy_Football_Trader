"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Eye, TriangleAlert } from "lucide-react";
import { PlayerAvatar } from "@/components/player-avatar";
import { PositionBadge } from "@/components/position-badge";
import { WatchStar } from "@/components/watch-star";
import { titleMentionsPlayer } from "@/lib/name-match";
import { cn, relativeTime, scoreColor } from "@/lib/utils";
import { teamDisplayName } from "@/lib/teams";
import type { NewsItem, PlayerSummary } from "@/types";

export function WatchlistPanel({ news }: { news: NewsItem[] }) {
  const [players, setPlayers] = useState<PlayerSummary[] | null>(null);
  const [watched, setWatched] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setPlayers(null);
      setWatched(false);
      let ids: string[] = [];
      try {
        const res = await fetch("/api/watchlist");
        const data = (await res.json()) as { ok: boolean; ids?: string[] };
        if (data.ok && Array.isArray(data.ids) && data.ids.length > 0) {
          ids = data.ids;
        } else {
          const local = JSON.parse(localStorage.getItem("fft.watchlist") ?? "[]");
          if (Array.isArray(local)) ids = local;
        }
      } catch {
        try {
          const local = JSON.parse(localStorage.getItem("fft.watchlist") ?? "[]");
          if (Array.isArray(local)) ids = local;
        } catch {
        }
      }
      if (cancelled || ids.length === 0) return;
      try {
        const res = await fetch(`/api/players?ids=${ids.join(",")}`);
        const data = (await res.json()) as { ok: boolean; players: PlayerSummary[] };
        if (!cancelled && data.ok) {
          setPlayers(data.players);
          setWatched(data.players.length > 0);
        }
      } catch {
      }
    };
    load();
    const interval = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!watched || !players) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
      <div className="mb-4 flex items-center gap-2">
        <Eye className="h-5 w-5 text-volt" />
        <h2 className="font-display text-2xl tracking-wide text-slate-100">YOUR WATCHLIST</h2>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {players.map((player) => {
          const matches = news.filter((item) =>
            titleMentionsPlayer(player.name, item.title, item.summary)
          );
          const injured = Boolean(player.injuryStatus);
          return (
            <div
              key={player.id}
              className="rounded-xl border border-white/5 bg-slate-900/60 p-4"
            >
              <div className="flex items-center gap-3">
                <PlayerAvatar
                  playerId={player.id}
                  name={player.name}
                  position={player.position}
                  team={player.team}
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/player/${player.id}`}
                    className="flex items-center gap-2 text-sm font-semibold text-slate-100 hover:text-volt"
                  >
                    <span className="truncate">{player.name}</span>
                    <WatchStar playerId={player.id} playerName={player.name} className="shrink-0" />
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <PositionBadge position={player.position} />
                    <span className="truncate text-xs text-slate-500">
                      {teamDisplayName(player.team)}
                    </span>
                    {injured && (
                      <span className="flex items-center gap-1 rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">
                        <TriangleAlert className="h-3 w-3" />
                        {player.injuryStatus}
                      </span>
                    )}
                    {player.byeWeek ? (
                      <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300">
                        Bye W{player.byeWeek}
                      </span>
                    ) : null}
                  </div>
                </div>
                <span className={cn("shrink-0 font-display text-2xl", scoreColor(player.value.score))}>
                  {player.value.score ?? "—"}
                </span>
              </div>
              {matches.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-white/5 pt-3">
                  {matches.slice(0, 2).map((item) => (
                    <li key={item.id}>
                      <a
                        href={item.link || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-1.5 text-xs leading-snug text-slate-400 hover:text-slate-200"
                      >
                        <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" />
                        <span className="truncate">{item.title}</span>
                        <span className="ml-auto shrink-0 text-slate-600">
                          {relativeTime(item.publishedAt)}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
