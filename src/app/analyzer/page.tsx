"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  Check,
  ExternalLink,
  History,
  Lightbulb,
  Newspaper,
  RotateCcw,
  Save,
  Scale,
  Sparkles,
  TriangleAlert,
  Zap,
} from "lucide-react";
import { PlayerAvatar } from "@/components/player-avatar";
import { PlayerSearch } from "@/components/player-search";
import { PositionBadge } from "@/components/position-badge";
import { ShareVerdictButton } from "@/components/share-verdict-button";
import { FootballSpinner } from "@/components/football-spinner";
import { TouchdownBurst } from "@/components/touchdown-burst";
import { ruleVerdict, sideValue } from "@/lib/value-engine";
import { cn, formatPts, relativeTime, verdictStyle } from "@/lib/utils";
import { teamDisplayName } from "@/lib/teams";
import type { AnalyzeResponse, NewsItem, PlayerBundle, PlayerSummary } from "@/types";

interface LeagueContext {
  leagueId: string;
  rosterId: number;
  teamName: string;
  rosterSlots?: Record<string, number>;
  players: PlayerSummary[];
}

interface SavedAnalysis {
  id: string;
  ts: string;
  give: PlayerSummary[];
  get: PlayerSummary[];
  verdict: string;
  headline: string;
}

export default function AnalyzerPage() {
  const [give, setGive] = useState<PlayerSummary[]>([]);
  const [get, setGet] = useState<PlayerSummary[]>([]);
  const [rosterContext, setRosterContext] = useState<LeagueContext | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedAnalysis[]>([]);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    try {
      const leagueRaw = localStorage.getItem("fft.league");
      if (leagueRaw) setRosterContext(JSON.parse(leagueRaw));
      const savedRaw = localStorage.getItem("fft.savedAnalyses");
      if (savedRaw) setSaved(JSON.parse(savedRaw));
    } catch {
    }
  }, []);

  const disabledIds = useMemo(
    () => [...give, ...get].map((p) => p.id),
    [give, get]
  );

  const giveValue = sideValue(give.map((p) => p.value.score));
  const getValue = sideValue(get.map((p) => p.value.score));
  const liveVerdict = give.length > 0 && get.length > 0 ? ruleVerdict(giveValue, getValue) : null;

  function addGive(player: PlayerSummary) {
    setGive((prev) => [...prev, player]);
  }

  function addGet(player: PlayerSummary) {
    setGet((prev) => [...prev, player]);
  }

  function resetAll() {
    setGive([]);
    setGet([]);
    setResult(null);
    setError(null);
  }

  async function analyze() {
    if (give.length === 0 || get.length === 0 || analyzing) return;
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          give: give.map((p) => p.id),
          get: get.map((p) => p.id),
          myRoster: rosterContext?.players.map((p) => p.id) ?? [],
          rosterSlots: rosterContext?.rosterSlots,
        }),
      });
      const data = (await res.json()) as AnalyzeResponse & { error?: string };
      if (!data.ok) throw new Error(data.error || "Analysis failed");
      setResult(data);
      setJustSaved(false);
      setTimeout(() => {
        document.getElementById("results")?.scrollIntoView({ behavior: "smooth" });
      }, 150);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed. Try again.");
    } finally {
      setAnalyzing(false);
    }
  }

  function saveAnalysis() {
    if (!result) return;
    const verdict = result.ai?.verdict ?? result.engine.verdict;
    const headline = result.ai?.headline ?? "Rule-engine verdict";
    const entry: SavedAnalysis = {
      id: `${Date.now()}`,
      ts: new Date().toISOString(),
      give,
      get,
      verdict,
      headline,
    };
    const next = [entry, ...saved].slice(0, 12);
    setSaved(next);
    try {
      localStorage.setItem("fft.savedAnalyses", JSON.stringify(next));
    } catch {
    }
    fetch("/api/analyses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        give,
        get,
        verdict,
        headline,
        giveValue: result.engine.giveValue,
        getValue: result.engine.getValue,
        aiUsed: Boolean(result.ai),
      }),
    }).catch(() => {
    });
    setJustSaved(true);
  }

  function loadSaved(entry: SavedAnalysis) {
    setGive(entry.give);
    setGet(entry.get);
    setResult(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const finalVerdict = result?.ai?.verdict ?? result?.engine.verdict ?? null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl tracking-wide text-slate-100 sm:text-5xl">
            TRADE <span className="text-volt">ANALYZER</span>
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Stack both sides of a deal. The engine weighs two seasons of PPR
            stats, consistency, injuries, and live news — then the AI gives the verdict.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-volt/30 bg-volt/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-volt">
            12-Team PPR
          </span>
          {rosterContext && (
            <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-sky-300">
              {rosterContext.teamName}
            </span>
          )}
        </div>
      </div>

      {rosterContext && rosterContext.players.length > 0 && (
        <div className="mb-6 rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-300">
              Quick add from your Sleeper roster — {rosterContext.teamName}
            </p>
            <Link href="/league" className="text-xs text-slate-500 hover:text-sky-300">
              Change team
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {rosterContext.players.map((player) => {
              const disabled = disabledIds.includes(player.id);
              return (
                <button
                  key={player.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => addGive(player)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900/80 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors",
                    disabled ? "cursor-not-allowed opacity-40" : "hover:border-sky-400/40 hover:text-white"
                  )}
                >
                  <PositionBadge position={player.position} />
                  {player.name}
                  <span className="text-slate-500">{player.value.score ?? "—"}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <TradeSidePanel
          title="YOU SEND"
          accent="rose"
          players={give}
          onAdd={addGive}
          onRemove={(id) => setGive((prev) => prev.filter((p) => p.id !== id))}
          onClear={() => setGive([])}
          disabledIds={disabledIds}
          total={giveValue}
        />
        <div className="hidden items-center justify-center lg:flex">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-slate-900 font-display text-xl text-slate-400">
            VS
          </div>
        </div>
        <TradeSidePanel
          title="YOU RECEIVE"
          accent="emerald"
          players={get}
          onAdd={addGet}
          onRemove={(id) => setGet((prev) => prev.filter((p) => p.id !== id))}
          onClear={() => setGet([])}
          disabledIds={disabledIds}
          total={getValue}
        />
      </div>

      <div className="mt-6 rounded-xl border border-white/5 bg-slate-900/60 p-5">
        <div className="grid items-center gap-4 sm:grid-cols-[1fr_auto]">
          <div>
            <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider">
              <span className="text-rose-300">Send {giveValue || "—"}</span>
              <span className="text-slate-500">
                {give.length + get.length > 0 ? `diff ${getValue - giveValue >= 0 ? "+" : ""}${getValue - giveValue}` : "value balance"}
              </span>
              <span className="text-emerald-300">Receive {getValue || "—"}</span>
            </div>
            <div className="flex h-3 overflow-hidden rounded-full bg-slate-800">
              {giveValue + getValue > 0 && (
                <>
                  <div
                    className="bg-rose-500/70 transition-all duration-500"
                    style={{ width: `${(giveValue / (giveValue + getValue)) * 100}%` }}
                  />
                  <div
                    className="bg-emerald-500/70 transition-all duration-500"
                    style={{ width: `${(getValue / (giveValue + getValue)) * 100}%` }}
                  />
                </>
              )}
            </div>
            {liveVerdict && (
              <p className="mt-2 text-xs text-slate-500">
                Live engine read:{" "}
                <span className={cn("font-semibold", verdictStyle(liveVerdict).text)}>
                  {verdictStyle(liveVerdict).label}
                </span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetAll}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-4 py-3 text-sm font-medium text-slate-400 transition-colors hover:border-white/20 hover:text-slate-200"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
            <button
              type="button"
              onClick={analyze}
              disabled={give.length === 0 || get.length === 0 || analyzing}
              className={cn(
                "flex items-center gap-2 rounded-lg bg-volt px-6 py-3 text-sm font-bold text-slate-950 transition-all enabled:hover:brightness-110 enabled:hover:shadow-[0_0_30px_rgba(163,230,53,0.3)] disabled:cursor-not-allowed disabled:opacity-40",
                !analyzing && give.length > 0 && get.length > 0 && "btn-sheen"
              )}
            >
              {analyzing ? (
                <>
                  <FootballSpinner className="h-4 w-4" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Analyze Trade
                </>
              )}
            </button>
          </div>
        </div>
        {error && (
          <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {error}
        </p>
        )}
        {analyzing && (
          <div className="mt-4 h-1 overflow-hidden rounded-full bg-slate-800">
            <div className="analyzing-sweep h-full w-1/4 rounded-full bg-volt" />
          </div>
        )}
      </div>

      {result && (
        <section id="results" className="mt-8 scroll-mt-24">
          <VerdictBanner result={result} verdict={finalVerdict} />

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              {result.ai ? (
                <div className="rounded-xl border border-white/5 bg-slate-900/60 p-5">
                  <h3 className="flex items-center gap-2 font-display text-xl tracking-wide text-slate-100">
                    <Sparkles className="h-4 w-4 text-volt" />
                    AI ANALYSIS — {result.model}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">{result.ai.summary}</p>
                  {result.ai.final_word && (
                    <p className="mt-3 border-l-2 border-volt/50 pl-3 text-sm font-medium italic text-slate-200">
                      {result.ai.final_word}
                    </p>
                  )}
                  <div className="mt-4 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={cn("h-full rounded-full", verdictStyle(finalVerdict).bar)}
                        style={{ width: `${result.ai.confidence}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-slate-400">
                      {result.ai.confidence}% confidence
                    </span>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
                  <h3 className="flex items-center gap-2 font-display text-xl tracking-wide text-amber-200">
                    <Sparkles className="h-4 w-4" />
                    RULE ENGINE VERDICT
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">
                    {result.aiConfigured
                      ? "The AI analyst could not be reached this time — showing the deterministic verdict instead."
                      : "Add your openference API key to .env.local to unlock AI narratives on top of this verdict."}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">
                    The value engine rates the package you receive at{" "}
                    <span className="font-semibold text-emerald-300">{result.engine.getValue}</span>{" "}
                    versus{" "}
                    <span className="font-semibold text-rose-300">{result.engine.giveValue}</span>{" "}
                    going out — a gap of{" "}
                    <span className={cn("font-semibold", result.engine.diff >= 0 ? "text-emerald-300" : "text-rose-300")}>
                      {result.engine.diff >= 0 ? "+" : ""}{result.engine.diff}
                    </span>{" "}
                    points in your {result.engine.diff >= 0 ? "favor" : "opponent's favor"}.
                  </p>
                </div>
              )}

              {result.ai && result.ai.key_factors.length > 0 && (
                <FactorList
                  icon={<Check className="h-4 w-4 text-emerald-400" />}
                  title="KEY FACTORS"
                  items={result.ai.key_factors}
                />
              )}
              {result.ai && result.ai.risks.length > 0 && (
                <FactorList
                  icon={<TriangleAlert className="h-4 w-4 text-amber-400" />}
                  title="RISKS & RED FLAGS"
                  items={result.ai.risks}
                />
              )}
              {result.ai && result.ai.news_impact.length > 0 && (
                <FactorList
                  icon={<Newspaper className="h-4 w-4 text-sky-400" />}
                  title="NEWS IMPACT"
                  items={result.ai.news_impact}
                />
              )}
              {result.ai && result.ai.counter_ideas.length > 0 && (
                <FactorList
                  icon={<Lightbulb className="h-4 w-4 text-volt" />}
                  title="COUNTER IDEAS"
                  items={result.ai.counter_ideas}
                />
              )}

              <div className="rounded-xl border border-white/5 bg-slate-900/60 p-5">
                <h3 className="flex items-center gap-2 font-display text-xl tracking-wide text-slate-100">
                  <Scale className="h-4 w-4 text-volt" />
                  VALUE LEDGER
                </h3>
                <div className="mt-4 space-y-3">
                  <SideLedger
                    label="You send"
                    value={result.engine.giveValue}
                    players={result.give}
                    accent="rose"
                  />
                  <SideLedger
                    label="You receive"
                    value={result.engine.getValue}
                    players={result.get}
                    accent="emerald"
                  />
                </div>
                {result.engine.needs.length > 0 && (
                  <div className="mt-4 border-t border-white/5 pt-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Your roster needs
                    </p>
                    <ul className="mt-2 space-y-1">
                      {result.engine.needs.map((need) => (
                        <li key={need} className="flex items-start gap-2 text-sm text-slate-400">
                          <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400" />
                          {need}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="mt-4 border-t border-white/5 pt-4">
                  <h3 className="mb-3 flex items-center gap-2 font-display text-xl tracking-wide text-slate-100">
                    <Zap className="h-4 w-4 text-volt" />
                    REST OF SEASON
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-rose-500/25 bg-rose-500/5 px-4 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-300">
                        You send — projected
                      </p>
                      <p className="mt-1 font-display text-3xl text-slate-100">
                        {result.give.reduce((sum, b) => sum + (b.projection?.rosPoints ?? 0), 0).toFixed(0)}
                        <span className="ml-1 text-sm text-slate-500">pts</span>
                      </p>
                    </div>
                    <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-4 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                        You receive — projected
                      </p>
                      <p className="mt-1 font-display text-3xl text-slate-100">
                        {result.get.reduce((sum, b) => sum + (b.projection?.rosPoints ?? 0), 0).toFixed(0)}
                        <span className="ml-1 text-sm text-slate-500">pts</span>
                      </p>
                    </div>
                  </div>
                  {result.engine.lineupImpact && (
                    <p
                      className={cn(
                        "mt-3 rounded-lg border px-4 py-3 text-sm font-semibold",
                        result.engine.lineupImpact.delta >= 0
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                          : "border-rose-500/30 bg-rose-500/10 text-rose-300"
                      )}
                    >
                      Lineup impact: {result.engine.lineupImpact.delta >= 0 ? "+" : ""}
                      {result.engine.lineupImpact.delta.toFixed(1)} projected pts/week
                      ({result.engine.lineupImpact.before.toFixed(1)} →{" "}
                      {result.engine.lineupImpact.after.toFixed(1)})
                    </p>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={saveAnalysis}
                    className="flex items-center gap-2 rounded-lg border border-volt/30 bg-volt/10 px-4 py-2 text-xs font-semibold text-volt transition-colors hover:bg-volt/20"
                  >
                    {justSaved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                    {justSaved ? "Saved" : "Save this analysis"}
                  </button>
                  <ShareVerdictButton result={result} />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-display text-xl tracking-wide text-slate-100">
                PLAYERS IN THIS DEAL
              </h3>
              {[...result.give, ...result.get].map((bundle, index) => (
                <div key={bundle.id} style={{ animationDelay: `${index * 70}ms` }} className="animate-fade-up">
                  <PlayerResultCard
                    bundle={bundle}
                    side={index < result.give.length ? "send" : "receive"}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {saved.length > 0 && (
        <section className="mt-10">
          <h3 className="mb-3 flex items-center gap-2 font-display text-xl tracking-wide text-slate-300">
            <History className="h-4 w-4 text-volt" />
            SAVED ANALYSES
          </h3>
          <div className="space-y-2">
            {saved.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => loadSaved(entry)}
                className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-white/5 bg-slate-900/60 px-4 py-3 text-left transition-colors hover:border-volt/30"
              >
                <span className={cn("text-xs font-bold uppercase tracking-wider", verdictStyle(entry.verdict).text)}>
                  {verdictStyle(entry.verdict).label}
                </span>
                <span className="text-sm text-slate-300">
                  {entry.give.map((p) => p.name).join(", ")}
                </span>
                <ArrowLeftRight className="h-3.5 w-3.5 text-slate-600" />
                <span className="text-sm text-slate-300">
                  {entry.get.map((p) => p.name).join(", ")}
                </span>
                <span className="ml-auto text-xs text-slate-600">{relativeTime(entry.ts)}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function TradeSidePanel({
  title,
  accent,
  players,
  onAdd,
  onRemove,
  onClear,
  disabledIds,
  total,
}: {
  title: string;
  accent: "rose" | "emerald";
  players: PlayerSummary[];
  onAdd: (player: PlayerSummary) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  disabledIds: string[];
  total: number;
}) {
  const accentText = accent === "rose" ? "text-rose-300" : "text-emerald-300";
  const accentBorder = accent === "rose" ? "border-rose-500/20" : "border-emerald-500/20";

  return (
    <div className={cn("rounded-xl border bg-slate-900/60 p-4", accentBorder)}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className={cn("font-display text-2xl tracking-wide", accentText)}>{title}</h2>
        {players.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-slate-500 transition-colors hover:text-slate-300"
          >
            Clear
          </button>
        )}
      </div>
      <PlayerSearch onAdd={onAdd} disabledIds={disabledIds} />
      <div className="mt-3 space-y-2">
        {players.length === 0 && (
          <p className="rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-xs text-slate-600">
            Search and add players to this side of the trade
          </p>
        )}
        {players.map((player, index) => (
          <div
            key={player.id}
            style={{ animationDelay: `${index * 50}ms` }}
            className="animate-fade-up flex items-center gap-3 rounded-lg border border-white/5 bg-slate-950/60 px-3 py-2.5"
          >
            <PlayerAvatar
              playerId={player.id}
              name={player.name}
              position={player.position}
              team={player.team}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-100">{player.name}</p>
              <div className="mt-0.5 flex items-center gap-1.5">
                <PositionBadge position={player.position} />
                <span className="truncate text-[11px] text-slate-500">
                  {teamDisplayName(player.team)}
                </span>
              </div>
            </div>
            <span className="font-display text-xl text-slate-200">
              {player.value.score ?? "—"}
            </span>
            <button
              type="button"
              onClick={() => onRemove(player.id)}
              className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
              aria-label={`Remove ${player.name}`}
            >
              <span className="text-sm font-bold">×</span>
            </button>
          </div>
        ))}
      </div>
      {players.length > 0 && (
        <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Side value
          </span>
          <span className={cn("font-display text-2xl", accentText)}>{total}</span>
        </div>
      )}
    </div>
  );
}

function VerdictBanner({ result, verdict }: { result: AnalyzeResponse; verdict: string | null }) {
  const style = verdictStyle(verdict);
  const celebrate = verdict === "ACCEPT" || verdict === "LEAN_ACCEPT";
  return (
    <div className={cn("relative overflow-hidden rounded-xl border p-6", style.bg, style.border)}>
      <TouchdownBurst active={celebrate} />
      <div key={result.generatedAt} className="animate-scale-in relative flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Verdict {result.ai ? "— AI analyst" : "— rule engine"}
          </p>
          <p className={cn("mt-1 font-display text-5xl leading-none tracking-wide sm:text-6xl", style.text)}>
            {style.label}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">
            {result.ai ? result.ai.headline : `${result.engine.diff >= 0 ? "+" : ""}${result.engine.diff} value gap`}
          </p>
          <p className="mt-1 text-[11px] text-slate-600">
            {relativeTime(result.generatedAt)}
          </p>
        </div>
      </div>
    </div>
  );
}

function FactorList({
  icon,
  title,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-slate-900/60 p-5">
      <h3 className="flex items-center gap-2 font-display text-xl tracking-wide text-slate-100">
        {icon}
        {title}
      </h3>
      <ul className="mt-3 space-y-2">
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-2.5 text-sm leading-relaxed text-slate-300">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-500" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SideLedger({
  label,
  value,
  players,
  accent,
}: {
  label: string;
  value: number;
  players: PlayerBundle[];
  accent: "rose" | "emerald";
}) {
  const barColor = accent === "rose" ? "bg-rose-500/70" : "bg-emerald-500/70";
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
        <span className="font-display text-xl text-slate-200">{value}</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-slate-800">
        <div className={cn("h-full rounded-full", barColor)} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-slate-600">
        {players.map((p) => `${p.name} (${p.value.score ?? "—"})`).join(" · ")}
      </p>
    </div>
  );
}

function PlayerResultCard({ bundle, side }: { bundle: PlayerBundle; side: "send" | "receive" }) {
  const latest = bundle.seasons.find((s) => s.games > 0);
  const sideLabel = side === "send" ? "OUT" : "IN";
  const sideClass =
    side === "send"
      ? "border-rose-500/30 bg-rose-500/5 text-rose-300"
      : "border-emerald-500/30 bg-emerald-500/5 text-emerald-300";

  return (
    <div className="card-hover rounded-xl border border-white/5 bg-slate-900/60 p-4">
      <div className="flex items-start gap-3">
        <PlayerAvatar
          playerId={bundle.id}
          name={bundle.name}
          position={bundle.position}
          team={bundle.team}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/player/${bundle.id}`}
              className="truncate text-base font-semibold text-slate-100 hover:text-volt"
            >
              {bundle.name}
            </Link>
            <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-bold", sideClass)}>
              {sideLabel}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <PositionBadge position={bundle.position} />
            <span className="text-xs text-slate-500">{teamDisplayName(bundle.team)}</span>
            {bundle.injuryStatus && (
              <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">
                {bundle.injuryStatus}
              </span>
            )}
            {bundle.trendCount ? (
              <span className="rounded bg-lime-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-lime-300">
                Trending +
              </span>
            ) : null}
            {bundle.byeWeek ? (
              <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300">
                Bye W{bundle.byeWeek}
              </span>
            ) : null}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-3xl leading-none text-slate-100">
            {bundle.value.score ?? "—"}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">{bundle.value.tier}</p>
        </div>
      </div>

      {latest && (
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
          <StatTile label="PPG" value={formatPts(latest.ppg)} />
          <StatTile
            label="Proj PPG"
            value={bundle.projection ? formatPts(bundle.projection.ppg) : "—"}
            highlight={bundle.projection?.source === "espn"}
          />
          <StatTile label="Games" value={String(latest.games)} />
          <StatTile label="Pos Rank" value={latest.posRank ? `#${latest.posRank}` : "—"} />
          <StatTile label="Boom%" value={`${Math.round(latest.boomRate * 100)}%`} />
          <StatTile label="Bust%" value={`${Math.round(latest.bustRate * 100)}%`} />
        </div>
      )}

      {bundle.news.length > 0 && (
        <div className="mt-3 border-t border-white/5 pt-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Recent news
          </p>
          <ul className="space-y-1">
            {bundle.news.slice(0, 2).map((item: NewsItem) => (
              <li key={item.id}>
                <a
                  href={item.link || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-1.5 text-xs leading-snug text-slate-400 hover:text-slate-200"
                >
                  <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" />
                  {item.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg bg-slate-950/60 px-2.5 py-2 text-center",
        highlight && "ring-1 ring-volt/40"
      )}
    >
      <p className="text-sm font-semibold text-slate-200">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
    </div>
  );
}
