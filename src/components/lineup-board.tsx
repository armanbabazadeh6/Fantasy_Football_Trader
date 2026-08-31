"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, Loader2, Trophy } from "lucide-react";
import { PlayerAvatar } from "@/components/player-avatar";
import { PositionBadge } from "@/components/position-badge";
import { cn } from "@/lib/utils";

interface LineupPlayerInfo {
  id: string;
  name: string;
  position: string;
  team: string | null;
  points: number;
  source: "weekly" | "blend" | "season" | "none";
  opponent: string | null;
  homeAway: "home" | "away" | null;
  isBye: boolean;
  valueScore: number | null;
  injuryStatus?: string;
}

interface LineupResponse {
  ok: boolean;
  error?: string;
  week: number;
  starters: { slot: string; player: LineupPlayerInfo | null }[];
  bench: LineupPlayerInfo[];
  projectedTotal: number;
  tightCalls: {
    slot: string;
    starter: LineupPlayerInfo;
    backup: LineupPlayerInfo;
    margin: number;
  }[];
}

interface StoredRoster {
  platform: string;
  leagueId: string;
  teamName?: string;
  players?: { id: string }[];
  rosterSlots?: Record<string, number>;
}

const SOURCE_LABEL: Record<LineupPlayerInfo["source"], string> = {
  weekly: "ESPN week",
  blend: "blend",
  season: "season",
  none: "none",
};

export function LineupBoard() {
  const [lineup, setLineup] = useState<LineupResponse | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noRoster, setNoRoster] = useState(false);

  useEffect(() => {
    let roster: StoredRoster | null = null;
    try {
      const raw = localStorage.getItem("fft.league");
      if (raw) roster = JSON.parse(raw) as StoredRoster;
    } catch {
    }
    const ids = (roster?.players ?? []).map((p) => p.id).filter(Boolean);
    if (!roster || ids.length === 0) {
      setNoRoster(true);
      setLoading(false);
      return;
    }
    setTeamName(roster.teamName ?? null);
    fetch("/api/lineup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ players: ids, rosterSlots: roster.rosterSlots }),
    })
      .then(async (res) => {
        const json = (await res.json()) as LineupResponse;
        if (!json.ok) throw new Error(json.error ?? "Lineup failed");
        setLineup(json);
      })
      .catch(() => setError("Could not build your lineup. Try again."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mx-auto flex max-w-7xl items-center justify-center px-4 py-24 sm:px-6">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin text-volt" />
          <span className="text-sm">Optimizing your week...</span>
        </div>
      </div>
    );
  }

  if (noRoster) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <Header week={null} teamName={null} />
        <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-10 text-center">
          <Trophy className="mx-auto h-10 w-10 text-slate-600" />
          <p className="mt-4 text-sm text-slate-300">
            No roster selected yet. Load your league and pick your team once —
            this page remembers it.
          </p>
          <Link
            href="/league"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-volt px-5 py-3 text-sm font-bold text-slate-950 transition-all hover:brightness-110"
          >
            Go to League
          </Link>
        </div>
      </div>
    );
  }

  if (error || !lineup) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <Header week={null} teamName={teamName} />
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error ?? "Lineup unavailable."}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Header week={lineup.week} teamName={teamName} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {lineup.starters.map((entry, index) => (
              <div
                key={`${entry.slot}-${index}`}
                className={cn(
                  "rounded-xl border p-4",
                  entry.player
                    ? entry.player.isBye
                      ? "border-amber-400/20 bg-amber-400/5"
                      : "border-white/5 bg-slate-900/60"
                    : "border-dashed border-white/10"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {entry.slot}
                  </span>
                  {entry.player?.source === "weekly" ? (
                    <span className="rounded-full border border-volt/30 bg-volt/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-volt">
                      ESPN proj
                    </span>
                  ) : null}
                </div>
                {entry.player ? (
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <Link
                      href={`/player/${entry.player.id}`}
                      className="flex min-w-0 items-center gap-2.5"
                    >
                      <PlayerAvatar
                        playerId={entry.player.id}
                        name={entry.player.name}
                        position={entry.player.position}
                        team={entry.player.team}
                        size="sm"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-100">
                          {entry.player.name}
                          {entry.player.injuryStatus ? (
                            <span className="ml-1.5 rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">
                              {entry.player.injuryStatus}
                            </span>
                          ) : null}
                        </span>
                        <span className="block text-xs text-slate-400">
                          {entry.player.isBye
                            ? "BYE week"
                            : entry.player.opponent
                              ? `${entry.player.homeAway === "home" ? "vs" : "at"} ${entry.player.opponent}`
                              : "no matchup"}
                        </span>
                      </span>
                    </Link>
                    <span className="shrink-0 text-right">
                      <span
                        className={cn(
                          "font-display text-2xl tabular-nums",
                          entry.player.isBye ? "text-amber-400" : "text-volt"
                        )}
                      >
                        {entry.player.isBye ? "—" : entry.player.points.toFixed(1)}
                      </span>
                      <span className="block text-[10px] uppercase tracking-wider text-slate-500">
                        {SOURCE_LABEL[entry.player.source]}
                      </span>
                    </span>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">Empty slot</p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-8">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Bench
            </h2>
            <div className="overflow-hidden rounded-xl border border-white/5">
              <table className="w-full text-sm">
                <tbody>
                  {lineup.bench.map((player) => (
                    <tr key={player.id} className="border-b border-white/5 last:border-0">
                      <td className="px-3 py-2.5">
                        <Link href={`/player/${player.id}`} className="flex items-center gap-2.5">
                          <PositionBadge position={player.position} />
                          <span className="max-w-[220px] truncate text-slate-200">
                            {player.name}
                          </span>
                          {player.injuryStatus ? (
                            <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">
                              {player.injuryStatus}
                            </span>
                          ) : null}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs text-slate-400">
                        {player.isBye
                          ? "BYE"
                          : player.opponent
                            ? `${player.homeAway === "home" ? "vs" : "at"} ${player.opponent}`
                            : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">
                        {player.isBye ? "—" : player.points.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section>
          <div className="rounded-2xl border border-volt/20 bg-volt/5 p-5 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Week {lineup.week} projected total
            </p>
            <p className="mt-1 font-display text-6xl tracking-wide text-volt">
              {lineup.projectedTotal.toFixed(1)}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              points from your optimal starters
            </p>
          </div>

          <h2 className="mb-3 mt-8 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Tight calls
          </h2>
          <div className="space-y-2">
            {lineup.tightCalls.length === 0 ? (
              <p className="rounded-xl border border-white/5 bg-slate-900/60 p-4 text-sm text-slate-400">
                No close decisions this week. Your starters are clear.
              </p>
            ) : (
              lineup.tightCalls.map((call, index) => (
                <div
                  key={`${call.slot}-${index}`}
                  className="rounded-xl border border-white/5 bg-slate-900/60 p-4"
                >
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <ArrowLeftRight className="h-3.5 w-3.5 text-volt" />
                    {call.slot} decision
                  </div>
                  <p className="mt-2 text-sm text-slate-200">
                    Start{" "}
                    <span className="font-semibold text-volt">{call.starter.name}</span>{" "}
                    ({call.starter.points.toFixed(1)}) over{" "}
                    {call.backup.name} ({call.backup.points.toFixed(1)})
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {call.margin >= 0
                      ? `+${call.margin.toFixed(1)} pts of cushion`
                      : `${Math.abs(call.margin).toFixed(1)} pts the other way — consider swapping`}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Header({ week, teamName }: { week: number | null; teamName: string | null }) {
  return (
    <div className="mb-6">
      <h1 className="font-display text-4xl tracking-wide text-slate-100 sm:text-5xl">
        START <span className="text-volt">/ SIT</span>
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-400">
        {week
          ? `Optimal lineup for week ${week}${teamName ? ` · ${teamName}` : ""} — weekly projections, matchups, and byes from your roster.`
          : "Your gameday lineup, optimized with weekly projections and matchups."}
      </p>
    </div>
  );
}
