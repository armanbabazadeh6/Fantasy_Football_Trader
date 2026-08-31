"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowLeftRight, Loader2, Scale } from "lucide-react";
import { PlayerAvatar } from "@/components/player-avatar";
import { PlayerSearch } from "@/components/player-search";
import { PositionBadge } from "@/components/position-badge";
import { cn, scoreColor } from "@/lib/utils";
import { teamDisplayName } from "@/lib/teams";
import type { PlayerBundle, PlayerSummary } from "@/types";

interface CompareResponse {
  ok: boolean;
  error?: string;
  players: PlayerBundle[];
}

export default function ComparePage() {
  const [a, setA] = useState<PlayerSummary | null>(null);
  const [b, setB] = useState<PlayerSummary | null>(null);
  const [bundles, setBundles] = useState<PlayerBundle[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const aId = params.get("a");
    const bId = params.get("b");
    const hydrate = async () => {
      const ids = [aId, bId].filter(Boolean) as string[];
      if (ids.length === 0) return;
      try {
        const res = await fetch(`/api/players?ids=${ids.join(",")}`);
        const data = (await res.json()) as { ok: boolean; players: PlayerSummary[] };
        if (!data.ok) return;
        if (aId && data.players[0]) setA(data.players[0]);
        if (bId && data.players[1]) setB(data.players[1]);
      } catch {
      }
    };
    hydrate();
  }, []);

  useEffect(() => {
    if (!a || !b) {
      setBundles(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/compare?a=${a.id}&b=${b.id}`)
      .then((res) => res.json())
      .then((data: CompareResponse) => {
        if (cancelled) return;
        if (!data.ok) throw new Error(data.error || "Comparison failed");
        setBundles(data.players);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Comparison failed");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [a, b]);

  const chartData = useMemo(() => {
    if (!bundles || bundles.length < 2) return [];
    const [pa, pb] = bundles;
    const weeks = new Set<number>();
    for (const w of pa.seasons[0]?.weeks ?? []) weeks.add(w.week);
    for (const w of pb.seasons[0]?.weeks ?? []) weeks.add(w.week);
    return [...weeks]
      .sort((x, y) => x - y)
      .map((week) => ({
        name: `W${week}`,
        [pa.name]: pa.seasons[0]?.weeks.find((w) => w.week === week)?.pts ?? null,
        [pb.name]: pb.seasons[0]?.weeks.find((w) => w.week === week)?.pts ?? null,
      }));
  }, [bundles]);

  const rows = useMemo(() => {
    if (!bundles || bundles.length < 2) return [];
    const [pa, pb] = bundles;
    const la = pa.seasons[0];
    const lb = pb.seasons[0];
    const num = (
      label: string,
      va: number | null | undefined,
      vb: number | null | undefined,
      higherBetter = true,
      suffix = ""
    ) => {
      const aVal = va ?? null;
      const bVal = vb ?? null;
      let winner: "a" | "b" | null = null;
      if (aVal !== null && bVal !== null && aVal !== bVal) {
        winner = (aVal > bVal) === higherBetter ? "a" : "b";
      }
      return {
        label,
        a: aVal === null ? "—" : `${aVal}${suffix}`,
        b: bVal === null ? "—" : `${bVal}${suffix}`,
        winner,
      };
    };
    return [
      num("Trade value", pa.value.score, pb.value.score),
      { label: "Tier", a: pa.value.tier ?? "—", b: pb.value.tier ?? "—", winner: null },
      num("Weighted ppg", pa.value.ppg, pb.value.ppg),
      num("Season total", la?.total, lb?.total),
      num("Games", la?.games, lb?.games),
      num("Positional rank", la?.posRank, lb?.posRank, false),
      num("Boom rate", la ? Math.round(la.boomRate * 100) : null, lb ? Math.round(lb.boomRate * 100) : null, true, "%"),
      num("Bust rate", la ? Math.round(la.bustRate * 100) : null, lb ? Math.round(lb.bustRate * 100) : null, false, "%"),
      num("Best week", la?.best, lb?.best),
      num("Weekly std dev", la?.stdev, lb?.stdev, false),
      num("Age", pa.age, pb.age, false),
      num("Bye week", pa.byeWeek ?? null, pb.byeWeek ?? null, false),
    ];
  }, [bundles]);

  const render = useCallback(
    (side: "a" | "b") => (
      <div className="flex min-h-[340px] flex-1 flex-col gap-3 rounded-xl border border-white/5 bg-slate-900/60 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {side === "a" ? "Player A" : "Player B"}
        </p>
        <PlayerSearch
          onAdd={(player) => (side === "a" ? setA(player) : setB(player))}
          disabledIds={
            side === "a" ? (b ? [b.id] : []) : a ? [a.id] : []
          }
        />
        {(side === "a" ? a : b) ? (
          (() => {
            const p = side === "a" ? a : b;
            if (!p) return null;
            return (
              <div className="animate-scale-in flex flex-1 flex-col items-center justify-center gap-3 text-center">
                <PlayerAvatar
                  playerId={p.id}
                  name={p.name}
                  position={p.position}
                  team={p.team}
                  size="lg"
                />
                <Link
                  href={`/player/${p.id}`}
                  className="font-display text-3xl tracking-wide text-slate-100 hover:text-volt"
                >
                  {p.name}
                </Link>
                <div className="flex items-center gap-2">
                  <PositionBadge position={p.position} />
                  <span className="text-xs text-slate-500">{teamDisplayName(p.team)}</span>
                </div>
                <div>
                  <p className={cn("font-display text-6xl leading-none", scoreColor(p.value.score))}>
                    {p.value.score ?? "—"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{p.value.tier}</p>
                </div>
              </div>
            );
          })()
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-white/10 px-4 py-10 text-center text-xs text-slate-600">
            Search a player to fill this side
          </div>
        )}
      </div>
    ),
    [a, b]
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-6">
        <h1 className="font-display text-4xl tracking-wide text-slate-100 sm:text-5xl">
          HEAD TO <span className="text-volt">HEAD</span>
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Line up any two players — weekly scoring overlaid, stat by stat, winner
          highlighted.
        </p>
      </div>

      <div className="flex flex-col items-stretch gap-4 lg:flex-row">
        {render("a")}
        <div className="flex items-center justify-center">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 bg-slate-900 font-display text-lg text-slate-400">
            VS
          </div>
        </div>
        {render("b")}
      </div>

      {loading && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-white/5 bg-slate-900/60 px-5 py-6 text-sm text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin text-volt" />
          Pulling both players&rsquo; seasons...
        </div>
      )}
      {error && (
        <p className="mt-6 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </p>
      )}

      {bundles && bundles.length === 2 && !loading && (
        <div className="animate-fade-up mt-6 space-y-4">
          <div className="rounded-xl border border-white/5 bg-slate-900/60 p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-display text-2xl tracking-wide text-slate-100">
                <Scale className="h-5 w-5 text-volt" />
                WEEKLY SCORING
              </h2>
              <p className="text-xs text-slate-500">
                {bundles[0].seasons[0]?.season} season · volt = {bundles[0].name}
              </p>
            </div>
            {chartData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="2 4" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={{ stroke: "#1e293b" }} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", fontSize: 12 }}
                      labelStyle={{ color: "#94a3b8" }}
                    />
                    <Line type="monotone" dataKey={bundles[0].name} stroke="#a3e635" strokeWidth={2} dot={{ r: 2, fill: "#a3e635" }} connectNulls />
                    <Line type="monotone" dataKey={bundles[1].name} stroke="#fb7185" strokeWidth={2} dot={{ r: 2, fill: "#fb7185" }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-slate-500">
                No weekly data for these players.
              </p>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-white/5 bg-slate-900/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="py-3 pl-5 pr-2 font-semibold">Metric</th>
                  <th className="px-2 py-3 text-right font-semibold">{bundles[0].name}</th>
                  <th className="px-2 py-3 text-right font-semibold">{bundles[1].name}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label} className="border-b border-white/5 last:border-0 odd:bg-white/[0.02]">
                    <td className="py-2.5 pl-5 pr-2 text-slate-500">{row.label}</td>
                    <td
                      className={cn(
                        "px-2 py-2.5 text-right font-medium tabular-nums",
                        row.winner === "a" ? "text-volt" : "text-slate-200"
                      )}
                    >
                      {row.a}
                    </td>
                    <td
                      className={cn(
                        "px-2 py-2.5 text-right font-medium tabular-nums",
                        row.winner === "b" ? "text-volt" : "text-slate-200"
                      )}
                    >
                      {row.b}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-center text-xs text-slate-600">
            Green value wins each category. <ArrowLeftRight className="inline h-3 w-3" /> Try
            both sides of your next trade here before running the full analysis.
          </p>
        </div>
      )}
    </div>
  );
}
