"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowLeftRight, ArrowUpRight, Link2, Loader2, Trophy, UserPlus } from "lucide-react";
import { PlayerAvatar } from "@/components/player-avatar";
import { PositionBadge } from "@/components/position-badge";
import { findTradePartners, optimalLineup, powerRankings } from "@/lib/league-intel";
import { cn, formatPts, relativeTime, scoreColor } from "@/lib/utils";
import type { LeagueResponse, LeagueTrade, TradesResponse } from "@/types";

type Platform = "ESPN" | "SLEEPER";
type Tab = "standings" | "trades" | "power" | "partners";

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
  raw?: string;
}

interface ParsedEspnCreds {
  s2?: string;
  swid?: string;
  rawCookie?: string;
}

function parseEspnCreds(rawS2: string, rawSwid: string): ParsedEspnCreds {
  const trimmedS2 = rawS2.trim();
  const trimmedSwid = rawSwid.trim();
  if (/espn_s2\s*=/i.test(trimmedS2)) {
    const raw = trimmedS2
      .replace(/^cookie\s*:\s*/i, "")
      .replace(/[\r\n]+/g, " ")
      .replace(/;\s*;/g, "; ")
      .trim();
    let parsedS2 = "";
    let parsedSwid = "";
    for (const pair of raw.split(/;\s*/)) {
      const eq = pair.indexOf("=");
      if (eq === -1) continue;
      const name = pair.slice(0, eq).trim().toLowerCase();
      const value = pair.slice(eq + 1).trim();
      if (name === "espn_s2") parsedS2 = value;
      if (name === "swid") parsedSwid = value;
    }
    return {
      s2: parsedS2 || undefined,
      swid: parsedSwid || trimmedSwid || undefined,
      rawCookie: raw,
    };
  }
  return {
    s2: trimmedS2 || undefined,
    swid: trimmedSwid || undefined,
  };
}

function credsToHeaders(creds: ParsedEspnCreds): Record<string, string> {
  const headers: Record<string, string> = {};
  if (creds.s2) headers["x-espn-s2"] = creds.s2;
  if (creds.swid) headers["x-espn-swid"] = creds.swid;
  if (creds.rawCookie) headers["x-espn-cookie"] = creds.rawCookie;
  return headers;
}

const TABS: { key: Tab; label: string }[] = [
  { key: "standings", label: "Standings" },
  { key: "trades", label: "Trade History" },
  { key: "power", label: "Power Rankings" },
  { key: "partners", label: "Trade Partners" },
];

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
  const [tab, setTab] = useState<Tab>("standings");
  const [trades, setTrades] = useState<LeagueTrade[] | null>(null);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [tradesError, setTradesError] = useState<string | null>(null);

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
        setS2(creds.raw || creds.s2 || "");
        setSwid(creds.swid ?? "");
      }
      setLeagueId(storedLeague?.leagueId ?? creds?.leagueId ?? "");
    } catch {
    }
  }, []);

  useEffect(() => {
    if (
      tab !== "trades" ||
      !data ||
      data.platform !== "ESPN" ||
      trades !== null ||
      tradesLoading
    ) {
      return;
    }
    let cancelled = false;
    setTradesLoading(true);
    setTradesError(null);
    const creds = parseEspnCreds(s2, swid);
    fetch(`/api/espn-league/${data.league.id}/transactions`, {
      headers: credsToHeaders(creds),
    })
      .then((res) => res.json())
      .then((json: TradesResponse) => {
        if (cancelled) return;
        if (!json.ok) throw new Error(json.error || "Failed to load trades");
        setTrades(json.trades);
      })
      .catch((err) => {
        if (!cancelled) {
          setTradesError(err instanceof Error ? err.message : "Failed to load trades");
        }
      })
      .finally(() => {
        if (!cancelled) setTradesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, data, trades, tradesLoading, s2, swid]);

  async function loadLeague() {
    const id = leagueId.trim();
    if (!/^\d{4,12}$/.test(id)) {
      setError("Enter a numeric league ID (found in your league URL).");
      return;
    }
    setLoading(true);
    setError(null);
    const creds = parseEspnCreds(s2, swid);
    try {
      let json: LeagueResponse & { error?: string };
      if (platform === "ESPN") {
        const res = await fetch(`/api/espn-league/${id}`, {
          headers: credsToHeaders(creds),
        });
        json = (await res.json()) as LeagueResponse;
      } else {
        const res = await fetch(`/api/league/${id}`);
        json = (await res.json()) as LeagueResponse;
      }
      if (!json.ok) throw new Error(json.error || "League not found");
      setData(json);
      setTrades(null);
      setTradesError(null);
      setTab("standings");
      setExpandedTeam(stored?.leagueId === id ? stored.rosterId : null);
      if (platform === "ESPN" && (creds.s2 || creds.rawCookie)) {
        try {
          localStorage.setItem(
            "fft.espn",
            JSON.stringify({
              leagueId: id,
              s2: creds.s2 ?? "",
              swid: creds.swid ?? "",
              raw: creds.rawCookie ?? "",
            } as StoredEspnCreds)
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

  const power = useMemo(() => (data ? powerRankings(data.teams) : []), [data]);
  const partners = useMemo(
    () =>
      data && stored?.leagueId === data.league.id
        ? findTradePartners(data.teams, stored.rosterId)
        : [],
    [data, stored]
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-6">
        <h1 className="font-display text-4xl tracking-wide text-slate-100 sm:text-5xl">
          YOUR <span className="text-volt">LEAGUE</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Connect your real league for standings, graded trade history, power
          rankings, trade partners, and quick-add in the analyzer. ESPN and Sleeper supported.
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
              <p className="mt-2 font-semibold text-slate-300">Easiest way (Network tab):</p>
              <ol className="mt-1 list-decimal space-y-1 pl-4">
                <li>Log into fantasy.espn.com in this browser</li>
                <li>Open your league page, then press F12 and go to the Network tab</li>
                <li>Refresh the page, click the very first request, then Headers</li>
                <li>Scroll to Request Headers, find <span className="text-sky-300">cookie:</span></li>
                <li>Right-click its value and copy the entire string</li>
                <li>Paste it into the espn_s2 box below — it will be parsed automatically</li>
              </ol>
              <p className="mt-2 font-semibold text-slate-300">Alternative (Application tab):</p>
              <ol className="mt-1 list-decimal space-y-1 pl-4">
                <li>F12, Application tab, Cookies, fantasy.espn.com</li>
                <li>
                  Copy the full <span className="text-sky-300">espn_s2</span> value (it is long, make
                  sure you get all of it) and <span className="text-sky-300">SWID</span> (looks like
                  {" {"}XXXXXXXX-...{"}"})
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
                espn_s2 cookie (or paste the whole cookie header here)
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

      <div className="mt-6">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {TABS.map((t) => {
            const available = Boolean(data) && (t.key !== "trades" || data?.platform === "ESPN");
            return (
              <button
                key={t.key}
                type="button"
                disabled={!available}
                onClick={() => setTab(t.key)}
                className={cn(
                  "rounded-lg border px-3.5 py-2 text-xs font-semibold uppercase tracking-wider transition-colors",
                  tab === t.key && available
                    ? "border-volt/40 bg-volt/10 text-volt"
                    : available
                      ? "border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200"
                      : "cursor-not-allowed border-white/5 text-slate-700"
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        {!data && (
          <p className="px-1 text-xs text-slate-600">
            Load a league above to unlock standings, trade history, power rankings,
            trade partners, and optimal lineups.
          </p>
        )}
      </div>

      {data && (
        <div className="mt-4">
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

          {tab === "standings" && (
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
                            {data.league.rosterSlots && (
                              <LineupCard players={team.players} slots={data.league.rosterSlots} />
                            )}
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
              <p className="px-4 py-3 text-xs text-slate-600">
                Click a team row to expand its roster{data.league.rosterSlots ? " and optimal lineup" : ""}.
                &quot;Use my team&quot; saves that roster to the trade analyzer.
              </p>
            </div>
          )}

          {tab === "trades" && (
            <div className="space-y-4">
              {tradesLoading && (
                <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-slate-900/60 px-5 py-8 text-sm text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin text-volt" />
                  Pulling and grading league trades...
                </div>
              )}
              {tradesError && (
                <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                  {tradesError}
                </p>
              )}
              {trades && trades.length === 0 && !tradesLoading && (
                <div className="rounded-xl border border-white/5 bg-slate-900/60 px-5 py-10 text-center text-sm text-slate-500">
                  No completed trades found in this league yet.
                </div>
              )}
              {trades?.map((trade) => (
                <div
                  key={trade.id}
                  className="rounded-xl border border-white/5 bg-slate-900/60 p-5"
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500">
                      <ArrowLeftRight className="h-4 w-4 text-volt" />
                      {relativeTime(trade.date)} · {trade.status}
                    </p>
                    {trade.winnerTeamId !== null && trade.maxNet >= 8 && (
                      <p className="text-xs font-semibold text-emerald-300">
                        Value-engine verdict: {trade.teams.find((t) => t.teamId === trade.winnerTeamId)?.teamName} won by {trade.maxNet}
                      </p>
                    )}
                    {trade.winnerTeamId !== null && trade.maxNet < 8 && (
                      <p className="text-xs font-semibold text-sky-300">
                        Roughly even deal
                      </p>
                    )}
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {trade.teams.map((team) => (
                      <div
                        key={team.teamId}
                        className={cn(
                          "rounded-lg border p-4",
                          team.netValue > 7
                            ? "border-emerald-500/30 bg-emerald-500/5"
                            : team.netValue < -7
                              ? "border-rose-500/30 bg-rose-500/5"
                              : "border-white/5 bg-slate-950/40"
                        )}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-100">{team.teamName}</p>
                          <span
                            className={cn(
                              "font-display text-lg",
                              team.netValue > 0 ? "text-emerald-300" : team.netValue < 0 ? "text-rose-300" : "text-slate-400"
                            )}
                          >
                            {team.netValue > 0 ? "+" : ""}{team.netValue}
                          </span>
                        </div>
                        {team.incoming.length > 0 && (
                          <div className="mb-2">
                            <p className="text-[10px] uppercase tracking-wider text-emerald-400">Received</p>
                            <p className="text-xs text-slate-300">
                              {team.incoming.map((p) => `${p.name} (${p.position})`).join(", ")}
                            </p>
                          </div>
                        )}
                        {team.outgoing.length > 0 && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-rose-400">Sent</p>
                            <p className="text-xs text-slate-300">
                              {team.outgoing.map((p) => `${p.name} (${p.position})`).join(", ")}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "power" && (
            <div className="space-y-2">
              {power.map((entry) => (
                <div
                  key={entry.rosterId}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-white/5 bg-slate-900/60 px-4 py-3"
                >
                  <span className="w-7 text-center font-display text-2xl text-slate-500">
                    {entry.rank}
                  </span>
                  <div className="min-w-[180px] flex-1">
                    <p className="text-sm font-semibold text-slate-100">{entry.teamName}</p>
                    <p className="text-xs text-slate-500">
                      {entry.record} · {entry.topPlayers.join(", ") || "no valued players"}
                    </p>
                  </div>
                  <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-volt/80"
                      style={{ width: `${entry.powerScore}%` }}
                    />
                  </div>
                  <span className="w-10 text-right font-display text-xl text-volt">
                    {Math.round(entry.powerScore)}
                  </span>
                  {entry.movement !== 0 && (
                    <span
                      className={cn(
                        "flex items-center gap-1 text-xs font-semibold",
                        entry.movement > 0 ? "text-emerald-300" : "text-rose-300"
                      )}
                    >
                      {entry.movement > 0 ? (
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDownRight className="h-3.5 w-3.5" />
                      )}
                      {Math.abs(entry.movement)} vs standings
                    </span>
                  )}
                </div>
              ))}
              <p className="px-1 pt-1 text-xs text-slate-600">
                Power score blends roster value (55%), record (25%), and points for (20%).
              </p>
            </div>
          )}

          {tab === "partners" && (
            <div className="space-y-3">
              {stored?.leagueId !== data.league.id && (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-300">
                  Pick &quot;Use my team&quot; on the Standings tab first so partner matching
                  knows your roster.
                </p>
              )}
              {stored?.leagueId === data.league.id && partners.length === 0 && (
                <div className="rounded-xl border border-white/5 bg-slate-900/60 px-5 py-10 text-center text-sm text-slate-500">
                  {findTradePartners(data.teams, stored.rosterId).length === 0 && stored
                    ? "No obvious surplus/need matches right now — your roster is either balanced or dominant everywhere."
                    : ""}
                </div>
              )}
              {partners.map((partner) => (
                <div
                  key={partner.rosterId}
                  className="rounded-xl border border-white/5 bg-slate-900/60 p-5"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="font-display text-xl tracking-wide text-slate-100">
                      {partner.teamName}
                    </p>
                    {partner.theirNeeds.length > 0 && (
                      <p className="text-xs text-slate-500">
                        They could use: {partner.theirNeeds.join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    {partner.targets.map((target) => (
                      <div
                        key={`${partner.rosterId}-${target.position}-${target.targetName}`}
                        className="flex flex-wrap items-center gap-3 rounded-lg border border-volt/20 bg-volt/5 px-4 py-2.5"
                      >
                        <PositionBadge position={target.position} />
                        <span className="text-sm font-semibold text-slate-100">
                          {target.targetName}
                        </span>
                        <span className="font-display text-lg text-volt">{target.targetScore}</span>
                        <span className="ml-auto text-xs text-slate-500">
                          stuck behind {target.blockedBy}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!data && !loading && !error && (
        <div className="mt-8 rounded-xl border border-dashed border-white/10 bg-slate-900/40 px-6 py-16 text-center">
          <Trophy className="mx-auto h-8 w-8 text-slate-700" />
          <p className="mt-3 text-sm text-slate-500">
            Load a league to see standings, trades, rankings, and partners.
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

function LineupCard({
  players,
  slots,
}: {
  players: LeagueResponse["teams"][number]["players"];
  slots: Record<string, number>;
}) {
  const lineup = useMemo(() => optimalLineup(players, slots), [players, slots]);
  if (lineup.starters.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-sky-500/20 bg-sky-500/5 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-300">
          Optimal lineup · {formatPts(lineup.projectedTotal)} projected pts
        </p>
        <p className="text-[11px] text-slate-500">{lineup.bench.length} on bench</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {lineup.starters.map((slot, index) => (
          <span
            key={`${slot.slot}-${index}`}
            className={cn(
              "rounded-md border px-2 py-1 text-[11px] font-medium",
              slot.player
                ? "border-white/10 bg-slate-950/60 text-slate-200"
                : "border-dashed border-rose-500/30 text-rose-300"
            )}
          >
            <span className="text-slate-500">{slot.slot}</span>{" "}
            {slot.player ? `${slot.player.name} (${formatPts(slot.ppg)})` : "empty"}
          </span>
        ))}
      </div>
    </div>
  );
}
