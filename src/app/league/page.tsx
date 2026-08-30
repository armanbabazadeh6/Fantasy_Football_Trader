"use client";

import { Fragment, useEffect, useState } from "react";
import { Link2, Loader2, Search, Trophy, UserPlus } from "lucide-react";
import { PlayerAvatar } from "@/components/player-avatar";
import { PositionBadge } from "@/components/position-badge";
import { cn, scoreColor } from "@/lib/utils";
import type { LeagueResponse } from "@/types";

interface StoredLeague {
  leagueId: string;
  rosterId: number;
  teamName: string;
}

export default function LeaguePage() {
  const [leagueId, setLeagueId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LeagueResponse | null>(null);
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null);
  const [stored, setStored] = useState<StoredLeague | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("fft.league");
      if (raw) {
        const parsed = JSON.parse(raw) as StoredLeague;
        setStored(parsed);
        setLeagueId(parsed.leagueId);
      }
    } catch {
    }
  }, []);

  async function loadLeague() {
    const id = leagueId.trim();
    if (!/^\d{4,12}$/.test(id)) {
      setError("Enter a numeric Sleeper league ID (found in your league URL).");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/league/${id}`);
      const json = (await res.json()) as LeagueResponse & { error?: string };
      if (!json.ok) throw new Error(json.error || "League not found");
      setData(json);
      setExpandedTeam(null);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "Failed to load league");
    } finally {
      setLoading(false);
    }
  }

  async function loadStored() {
    if (!stored) return;
    setLeagueId(stored.leagueId);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/league/${stored.leagueId}`);
      const json = (await res.json()) as LeagueResponse & { error?: string };
      if (!json.ok) throw new Error(json.error || "League not found");
      setData(json);
      setExpandedTeam(stored.rosterId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load league");
    } finally {
      setLoading(false);
    }
  }

  function selectTeamForAnalyzer(
    rosterId: number,
    teamName: string,
    players: LeagueResponse["teams"][number]["players"]
  ) {
    const payload = {
      leagueId: data?.league.id ?? leagueId.trim(),
      rosterId,
      teamName,
      players,
    };
    try {
      localStorage.setItem("fft.league", JSON.stringify(payload));
      setStored({ leagueId: payload.leagueId, rosterId, teamName });
    } catch {
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-6">
        <h1 className="font-display text-4xl tracking-wide text-slate-100 sm:text-5xl">
          YOUR <span className="text-volt">LEAGUE</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Paste your Sleeper league ID (the number in your league URL) to see
          standings, roster values, and unlock quick-add in the trade analyzer.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-lg border border-white/10 bg-slate-900/80 px-3 py-3 focus-within:border-volt/50 sm:max-w-md">
          <Search className="h-4 w-4 shrink-0 text-slate-500" />
          <input
            value={leagueId}
            onChange={(event) => setLeagueId(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") loadLeague();
            }}
            placeholder="Sleeper league ID, e.g. 987654321098765432"
            inputMode="numeric"
            className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={loadLeague}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-volt px-5 py-3 text-sm font-bold text-slate-950 transition-all enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
          {loading ? "Loading..." : "Load League"}
        </button>
        {stored && !loading && data?.league.id !== stored.leagueId && (
          <button
            type="button"
            onClick={loadStored}
            className="flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm font-medium text-sky-300 transition-colors hover:bg-sky-500/20"
          >
            <Link2 className="h-4 w-4" />
            Reopen {stored.teamName}
          </button>
        )}
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </p>
      )}

      {data && (
        <div className="mt-8">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h2 className="font-display text-2xl tracking-wide text-slate-100">
              {data.league.name}
            </h2>
            <span className="rounded-full border border-volt/30 bg-volt/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-volt">
              {data.league.scoringLabel}
            </span>
            <span className="text-xs text-slate-500">
              {data.league.season} season · {data.league.totalRosters} teams
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/5 bg-slate-900/60">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="py-3 pl-4 pr-2 font-semibold">#</th>
                  <th className="px-2 py-3 font-semibold">Team</th>
                  <th className="px-2 py-3 text-right font-semibold">Record</th>
                  <th className="px-2 py-3 text-right font-semibold">Points For</th>
                  <th className="px-2 py-3 text-right font-semibold">Roster Value</th>
                  <th className="py-3 pl-2 pr-4 text-right font-semibold">Analyzer</th>
                </tr>
              </thead>
              <tbody>
                {data.teams.map((team, index) => (
                  <Fragment key={team.rosterId}>
                    <tr
                      className="cursor-pointer border-b border-white/5 transition-colors hover:bg-white/[0.03]"
                      onClick={() =>
                        setExpandedTeam(expandedTeam === team.rosterId ? null : team.rosterId)
                      }
                    >
                      <td className="py-3 pl-4 pr-2 text-slate-600">{index + 1}</td>
                      <td className="px-2 py-3">
                        <p className="font-medium text-slate-100">{team.teamName}</p>
                        {team.displayName && team.displayName !== team.teamName && (
                          <p className="text-xs text-slate-500">@{team.displayName}</p>
                        )}
                      </td>
                      <td className="px-2 py-3 text-right tabular-nums text-slate-300">
                        {team.wins}-{team.losses}
                        {team.ties > 0 ? `-${team.ties}` : ""}
                      </td>
                      <td className="px-2 py-3 text-right tabular-nums text-slate-400">
                        {team.fpts.toFixed(2)}
                      </td>
                      <td className={cn("px-2 py-3 text-right font-display text-lg", scoreColor(team.totalValue))}>
                        {team.totalValue}
                      </td>
                      <td className="py-3 pl-2 pr-4 text-right">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            selectTeamForAnalyzer(team.rosterId, team.teamName, team.players);
                          }}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors",
                            stored?.rosterId === team.rosterId
                              ? "border-volt/40 bg-volt/10 text-volt"
                              : "border-white/10 text-slate-400 hover:border-volt/40 hover:text-volt"
                          )}
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          {stored?.rosterId === team.rosterId ? "Active" : "Use my team"}
                        </button>
                      </td>
                    </tr>
                    {expandedTeam === team.rosterId && (
                      <tr className="border-b border-white/5 bg-slate-950/40">
                        <td colSpan={6} className="px-4 py-4">
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {team.players.map((player) => (
                              <div
                                key={player.id}
                                className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-slate-900/60 px-3 py-2"
                              >
                                <PlayerAvatar
                                  playerId={player.id}
                                  name={player.name}
                                  position={player.position}
                                  team={player.team}
                                  size="sm"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium text-slate-200">
                                    {player.name}
                                  </p>
                                  <p className="text-[11px] text-slate-500">
                                    {player.value.tier}
                                    {player.injuryStatus ? ` · ${player.injuryStatus}` : ""}
                                  </p>
                                </div>
                                <PositionBadge position={player.position} />
                                <span className={cn("font-display text-lg", scoreColor(player.value.score))}>
                                  {player.value.score ?? "—"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-600">
            Click a team row to expand its roster. &quot;Use my team&quot; saves that roster
            to the trade analyzer for quick-add.
          </p>
        </div>
      )}

      {!data && !loading && !error && (
        <div className="mt-8 rounded-xl border border-dashed border-white/10 bg-slate-900/40 px-6 py-16 text-center">
          <Trophy className="mx-auto h-8 w-8 text-slate-700" />
          <p className="mt-3 text-sm text-slate-500">
            Where do I find my league ID? Open your league on Sleeper and copy the
            number from the URL: sleeper.com/leagues/
            <span className="text-slate-300">987654321098765432</span>
          </p>
        </div>
      )}
    </div>
  );
}
