import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { NewsCard } from "@/components/news-card";
import { PlayerAvatar } from "@/components/player-avatar";
import { PositionBadge } from "@/components/position-badge";
import { TrendSparkline } from "@/components/trend-sparkline";
import { WatchStar } from "@/components/watch-star";
import { WeeklyChart } from "@/components/weekly-chart";
import { getPlayerDetail } from "@/lib/nfl-data";
import { cn, formatPts, scoreBarColor, scoreColor } from "@/lib/utils";
import { teamDisplayName } from "@/lib/teams";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const detail = await getPlayerDetail(id);
  return { title: detail ? detail.player.name : "Player" };
}

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getPlayerDetail(id);
  if (!detail) notFound();

  const { player, seasons, news, summary, valueHistory, trendCount, gameLog } = detail;
  const value = summary.value;
  const latest = seasons.find((s) => s.games > 0);
  const breakdown = value.breakdown;

  const isQb = player.position === "QB";
  const isSkill = ["RB", "WR", "TE"].includes(player.position);
  const logColumns = isQb
    ? [
        { key: "passYd", label: "Pass Yds" },
        { key: "passTd", label: "Pass TD" },
        { key: "passInt", label: "INT" },
        { key: "rushYd", label: "Rush Yds" },
        { key: "rushTd", label: "Rush TD" },
      ]
    : isSkill
      ? [
          { key: "rec", label: "Rec" },
          { key: "targets", label: "Tgt" },
          { key: "recYd", label: "Rec Yds" },
          { key: "recTd", label: "Rec TD" },
          { key: "rushYd", label: "Rush Yds" },
          { key: "rushTd", label: "Rush TD" },
        ]
      : [];

  const metaChips: { label: string; value: string }[] = [
    { label: "Team", value: teamDisplayName(player.team) },
    { label: "Age", value: player.age ? String(player.age) : "—" },
    {
      label: "Experience",
      value: player.rookie ? "Rookie" : player.yearsExp ? `${player.yearsExp} yrs` : "—",
    },
    { label: "Status", value: player.status || "—" },
  ];

  if (summary.byeWeek) {
    metaChips.push({ label: "Bye week", value: `Week ${summary.byeWeek}` });
  }

  if (player.injuryStatus) {
    metaChips.push({
      label: "Injury",
      value: `${player.injuryStatus}${player.injuryBodyPart ? ` · ${player.injuryBodyPart}` : ""}`,
    });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Link
        href="/players"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-volt"
      >
        <ArrowLeft className="h-4 w-4" />
        All players
      </Link>

      <div className="animate-scale-in rounded-2xl border border-white/5 bg-slate-900/60 p-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-center gap-5">
            <PlayerAvatar
              playerId={player.id}
              name={player.name}
              position={player.position}
              team={player.team}
              size="lg"
            />
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-display text-4xl tracking-wide text-slate-100 sm:text-5xl">
                  {player.name}
                </h1>
                <WatchStar playerId={player.id} playerName={player.name} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <PositionBadge position={player.position} />
                {trendCount > 0 && (
                  <span className="flex items-center gap-1 rounded-md border border-lime-500/40 bg-lime-500/10 px-2 py-0.5 text-[11px] font-semibold text-lime-300">
                    <TrendingUp className="h-3 w-3" />
                    Trending up
                  </span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {metaChips.map((chip) => (
                  <div
                    key={chip.label}
                    className="rounded-lg border border-white/5 bg-slate-950/60 px-3 py-1.5"
                  >
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">
                      {chip.label}
                    </p>
                    <p className={cn("text-sm font-medium", chip.label === "Injury" ? "text-rose-300" : "text-slate-200")}>
                      {chip.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="min-w-[220px] flex-1 sm:max-w-xs">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Trade value
            </p>
            <div className="flex items-end gap-2">
              <span className={cn("font-display text-6xl leading-none", scoreColor(value.score))}>
                {value.score ?? "—"}
              </span>
              <span className="pb-1 text-sm text-slate-500">/ 100</span>
            </div>
            <p className="mt-1 text-sm font-medium text-slate-300">{value.tier}</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
              {value.score !== null && (
                <div
                  className={cn("h-full rounded-full", scoreBarColor(value.score))}
                  style={{ width: `${value.score}%` }}
                />
              )}
            </div>
            {summary.valueTrend !== undefined && (
              <p
                className={cn(
                  "mt-2 text-xs font-semibold",
                  summary.valueTrend > 0 ? "text-emerald-300" : "text-rose-300"
                )}
              >
                {summary.valueTrend > 0 ? "▲" : "▼"} {Math.abs(summary.valueTrend)} since last
                snapshot
              </p>
            )}
            {valueHistory.length > 1 && (
              <div className="mt-3 border-t border-white/5 pt-3">
                <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">
                  Value history ({valueHistory.length} snapshots)
                </p>
                <TrendSparkline data={valueHistory} />
              </div>
            )}
            {value.ppg !== null && (
              <p className="mt-2 text-xs text-slate-500">
                {formatPts(value.ppg)} weighted pts/game · {value.games} games last season
              </p>
            )}
          </div>
        </div>

        {breakdown && (
          <div className="mt-6 grid grid-cols-2 gap-2 border-t border-white/5 pt-5 sm:grid-cols-3 lg:grid-cols-6">
            <BreakdownTile label="Production core" value={breakdown.core} />
            <BreakdownTile label="Age adjustment" value={breakdown.ageAdj} />
            <BreakdownTile label="Consistency" value={breakdown.consistencyAdj} />
            <BreakdownTile label="Boom bonus" value={breakdown.boomAdj} />
            <BreakdownTile label="TE premium" value={breakdown.tePremium} />
            <BreakdownTile label="Injury multiplier" value={breakdown.injuryMult} mult />
          </div>
        )}
      </div>

      {latest ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="rounded-xl border border-white/5 bg-slate-900/60 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-2xl tracking-wide text-slate-100">
                {latest.season} WEEKLY OUTPUT
              </h2>
              <p className="text-xs text-slate-500">
                Dashed line = season average ({formatPts(latest.ppg)} pts)
              </p>
            </div>
            <WeeklyChart weeks={latest.weeks} ppg={latest.ppg} />
            {gameLog.length > 0 && logColumns.length > 0 && (
              <div className="mt-4 border-t border-white/5 pt-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Game log
                </p>
                <div className="max-h-64 overflow-y-auto rounded-lg border border-white/5">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-slate-900">
                      <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
                        <th className="px-3 py-2 font-semibold">Wk</th>
                        <th className="px-3 py-2 text-right font-semibold">Pts</th>
                        {logColumns.map((col) => (
                          <th key={col.key} className="px-3 py-2 text-right font-semibold">
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {gameLog.map((row) => (
                        <tr
                          key={row.week}
                          className="border-t border-white/5 text-slate-300 odd:bg-white/[0.02]"
                        >
                          <td className="px-3 py-1.5 text-slate-500">{row.week}</td>
                          <td className="px-3 py-1.5 text-right font-semibold text-slate-100">
                            {formatPts(row.pts)}
                          </td>
                          {logColumns.map((col) => (
                            <td key={col.key} className="px-3 py-1.5 text-right tabular-nums">
                              {(row as unknown as Record<string, number | undefined>)[col.key] ?? "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-white/5 bg-slate-900/60 p-5">
              <h2 className="mb-4 font-display text-2xl tracking-wide text-slate-100">
                {latest.season} PROFILE
              </h2>
              <dl className="space-y-2.5">
                <ProfileRow label="Total points" value={formatPts(latest.total)} />
                <ProfileRow label="Points per game" value={formatPts(latest.ppg)} />
                <ProfileRow label="Games played" value={String(latest.games)} />
                <ProfileRow
                  label="Positional rank"
                  value={latest.posRank ? `#${latest.posRank} ${player.position}` : "—"}
                />
                <ProfileRow label="Best week" value={`${formatPts(latest.best)} pts`} />
                <ProfileRow label="Worst week" value={`${formatPts(latest.worst)} pts`} />
                <ProfileRow label="Boom rate (20+ pts)" value={`${Math.round(latest.boomRate * 100)}%`} />
                <ProfileRow label="Bust rate (<5 pts)" value={`${Math.round(latest.bustRate * 100)}%`} />
                <ProfileRow label="Weekly std deviation" value={formatPts(latest.stdev)} />
              </dl>
            </div>

            {seasons.length > 1 && (
              <div className="rounded-xl border border-white/5 bg-slate-900/60 p-5">
                <h2 className="mb-4 font-display text-2xl tracking-wide text-slate-100">
                  SEASON BY SEASON
                </h2>
                <div className="space-y-3">
                  {seasons.map((season) => (
                    <div
                      key={season.season}
                      className="flex items-center justify-between rounded-lg bg-slate-950/60 px-3 py-2.5"
                    >
                      <span className="text-sm font-semibold text-slate-300">{season.season}</span>
                      <span className="text-xs text-slate-500">
                        {season.games} gms · {formatPts(season.total)} pts ·{" "}
                        {formatPts(season.ppg)} ppg
                        {season.posRank ? ` · #${season.posRank}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-white/5 bg-slate-900/60 p-8 text-center">
          <h2 className="font-display text-2xl tracking-wide text-slate-100">NO NFL DATA YET</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            {player.rookie
              ? "Rookie season ahead — value comes from draft capital and camp news. Check the news feed below."
              : "No recorded fantasy production over the last two seasons. Value is unknown until they see the field."}
          </p>
        </div>
      )}

      {news.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-4 font-display text-2xl tracking-wide text-slate-100">
            NEWS MENTIONING {player.name.toUpperCase()}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {news.map((item) => (
              <NewsCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function BreakdownTile({
  label,
  value,
  mult = false,
}: {
  label: string;
  value: number;
  mult?: boolean;
}) {
  const positive = value > (mult ? 1 : 0);
  const neutral = mult ? value === 1 : value === 0;
  return (
    <div className="rounded-lg bg-slate-950/60 px-3 py-2.5 text-center">
      <p
        className={cn(
          "font-display text-xl leading-none",
          neutral ? "text-slate-400" : positive ? "text-emerald-300" : "text-rose-300"
        )}
      >
        {mult ? `${value}x` : value > 0 ? `+${value}` : value}
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0 last:pb-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-sm font-semibold text-slate-200">{value}</dd>
    </div>
  );
}
