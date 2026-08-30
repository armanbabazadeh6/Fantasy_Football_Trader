"use client";

import { Fragment, useEffect, useState } from "react";
import { Link2, Loader2, Trophy, UserPlus } from "lucide-react";
import { PlayerAvatar } from "@/components/player-avatar";
import { PositionBadge } from "@/components/position-badge";
import { cn, scoreColor } from "@/lib/utils";
import type { LeagueResponse } from "@/types";

type Platform = "ESPN" | "SLEEPER";

interface StoredLeague {
  platform: Platform;
  leagueId: string;
  rosterId: number;
  teamName: string;
}

interface StoredEspnCreds {
  leagueId: string;
  s2: string;
  swid: string;
}

export default function LeaguePage() {
  const [platform, setPlatform] = useState<Platform>("ESPN");
  const [leagueId, setLeagueId] = useState("");
  const [s2, setS2] = useState("");
  const [swid, setSwid] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LeagueResponse | null>(null);
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null);
  const [stored, setStored] = useState<StoredLeague | null>(null);

  useEffect(() => {
    try {
      let storedLeague: StoredLeague | null = null;
      const leagueRaw = localStorage.getItem("fft.league");
      if (leagueRaw) {
        storedLeague = JSON.parse(leagueRaw) as StoredLeague;
        setStored(storedLeague);
        setPlatform(storedLeague.platform ?? "SLEEPER");
      }
      let creds: StoredEspnCreds | null = null;
      const credsRaw = localStorage.getItem("fft.espn");
      if (credsRaw) {
        creds = JSON.parse(credsRaw) as StoredEspnCreds;
        setS2(creds.s2 ?? "");
        setSwid(creds.swid ?? "");
      }
      setLeagueId(storedLeague?.leagueId ?? creds?.leagueId ?? "");
    } catch {
    }
  }, []);

  async function loadLeague() {
    const id = leagueId.trim();
    if (!/^\d{4,12}$/.test(id)) {
      setError("Enter a numeric league ID (found in your league URL).");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let json: LeagueResponse & { error?: string };
      if (platform === "ESPN") {
        const res = await fetch(`/api/espn-league/${id}`, {
          headers: {
            ...(s2.trim() ? { "x-espn-s2": s2.trim() } : {}),
            ...(swid.trim() ? { "x-espn-swid": swid.trim() } : {}),
          },
        });
        json = (await res.json()) as LeagueResponse;
      } else {
        const res = await fetch(`/api/league/${id}`);
        json = (await res.json()) as LeagueResponse;
      }
      if (!json.ok) throw new Error(json.error || "League not found");
      setData(json);
      setExpandedTeam(stored?.leagueId === id ? stored.rosterId : null);
      if (platform === "ESPN" && s2.trim()) {
        try {
          localStorage.setItem(
            "fft.espn",
            JSON.stringify({ leagueId: id, s2: s2.trim(), swid: swid.trim() } as StoredEspnCreds)
          );
        } catch {
        }
      }
    } catch (err) {
      setData(null);
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
      platform,
      leagueId: leagueId.trim(),
      rosterId,
      teamName,
      players,
    };
    try {
      localStorage.setItem("fft.league", JSON.stringify(payload));
      setStored({ platform, leagueId: payload.leagueId, rosterId, teamName });
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
          Connect your real league to see standings, roster values, and unlock
          quick-add in the trade analyzer. Works with ESPN and Sleeper.
        </p>
      </div>

      <div className="mb-5 flex gap-2">
        {(["ESPN", "SLEEPER"] as Platform[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              setPlatform(p);
              setData(null);
              setError(null);
            }}
            className={cn(
              "rounded-lg border px-4 py-2 text-sm font-semibold transition-colors",
              platform === p
                ? "border-volt/40 bg-volt/10 text-volt"
                : "border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200"
            )}
          >
            {p === "ESPN" ? "ESPN Fantasy" : "Sleeper"}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-white/5 bg-slate-900/60 p-5">
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          League ID
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={leagueId}
            onChange={(event) => setLeagueId(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") loadLeague();
            }}
            placeholder={platform === "ESPN" ? "e.g. 359217243" : "e.g. 987654321098765432"}
            inputMode="numeric"
            className="min-w-[220px] flex-1 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-volt/50 focus:outline-none"
          />
          <button
            type="button"
            onClick={loadLeague}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-volt px-5 py-3 text-sm font-bold text-slate-950 transition-all enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
            {loading ? "Loading..." : "Load League"}
          </button>
        </div>

        {platform === "ESPN" && (
          <div className="mt-4 space-y-3 border-t border-white/5 pt-4">
            <details className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3 text-xs leading-relaxed text-slate-400">
              <summary className="cursor-pointer font-semibold text-sky-300">
                Private league? Get your ESPN cookies (one time, ~60 seconds)
              </summary>
              <ol className="mt-2 list-decimal space-y-1 pl-4">
                <li>Log into fantasy.espn.com in this browser</li>
                <li>Press F12 and open the Application tab (Storage on Firefox)</li>
                <li>Under Cookies, select fantasy.espn.com</li>
                <li>
                  Copy the value of <span className="text-sky-300">espn_s2</span> (very long
                  string) and <span className="text-sky-300">SWID</span> (looks like
                  {" {"}XXXXXXXX-...{"}"}) into the fields below
                </li>
              </ol>
              <p className="mt-2 text-[11px] text-slate-500">
                Cookies are stored only in your browser on this machine and are sent
                straight to ESPN with each league request. They are never written to disk
                by the server.
              </p>
            </details>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                espn_s2 cookie
              </label>
              <textarea
                value={s2}
                onChange={(event) => setS2(event.target.value)}
                placeholder="AEABjAI..."
                rows={2}
                spellCheck={false}
                className="w-full resize-y rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2.5 font-mono text-xs text-slate-100 placeholder:text-slate-600 focus:border-volt/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                SWID cookie
              </label>
              <input
                value={swid}
                onChange={(event) => setSwid(event.target.value)}
                placeholder="{8C5F9A61-...}"
                spellCheck={false}
                className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2.5 font-mono text-xs text-slate-100 placeholder:text-slate-600 focus:border-volt/50 focus:outline-none"
              />
            </div>
          </div>
        )}

        {platform === "SLEEPER" && (
          <p className="mt-3 border-t border-white/5 pt-3 text-xs text-slate-500">
            The league ID is the number in your Sleeper league URL:
            sleeper.com/leagues/<span className="text-slate-300">987654321098765432</span>
          </p>
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
              {data.league.season} season · {data.league.totalRosters} teams ·{" "}
              {data.platform === "ESPN" ? "ESPN Fantasy" : "Sleeper"}
            </span>
          </div>

          {data.unmatched && data.unmatched.length > 0 && (
            <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-300">
              Could not match {data.unmatched.length} rostered player(s) to Sleeper IDs:{" "}
              {data.unmatched.slice(0, 8).join(", ")}
              {data.unmatched.length > 8 ? ", ..." : ""}. They were skipped in value totals.
            </p>
          )}

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
                          <p className="text-xs text-slate-500">{team.displayName}</p>
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
                                    {player.byeWeek ? ` · Bye W${player.byeWeek}` : ""}
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
            to the trade analyzer for quick-add
            {data.platform === "ESPN" ? " (ESPN players are matched to Sleeper IDs)" : ""}.
          </p>
        </div>
      )}

      {!data && !loading && !error && (
        <div className="mt-8 rounded-xl border border-dashed border-white/10 bg-slate-900/40 px-6 py-16 text-center">
          <Trophy className="mx-auto h-8 w-8 text-slate-700" />
          <p className="mt-3 text-sm text-slate-500">
            Load a league to see standings, rosters, and team values.
          </p>
          <p className="mt-1 flex items-center justify-center gap-1 text-xs text-slate-600">
            <Link2 className="h-3 w-3" />
            Your selection is remembered on this device
          </p>
        </div>
      )}
    </div>
  );
}
