import Link from "next/link";
import {
  ArrowRight,
  Brain,
  Database,
  Newspaper,
  Search,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { NewsCard } from "@/components/news-card";
import { PlayerCard } from "@/components/player-card";
import { SectionHeading } from "@/components/section-heading";
import { WatchlistPanel } from "@/components/watchlist-panel";
import { computeAllPlayers, getTrendingSummaries } from "@/lib/nfl-data";
import { fetchNews } from "@/lib/news";
import { currentStatSeason } from "@/lib/sleeper";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    icon: Search,
    title: "Build the Trade",
    text: "Search any NFL player and stack both sides of the deal. Pull your real Sleeper league roster for full context.",
  },
  {
    icon: Brain,
    title: "Let the Engine Think",
    text: "A transparent value engine weighs two seasons of PPR stats, weekly consistency, age curves, injuries, and trending movement. The AI analyst then reads everything and argues its case.",
  },
  {
    icon: Trophy,
    title: "Get the Verdict",
    text: "Accept, counter, or decline — with a confidence score, the key factors that drove the call, and concrete counter-offer ideas.",
  },
];

export default async function HomePage() {
  const [trendingSettled, newsSettled, computedSettled] = await Promise.allSettled([
    getTrendingSummaries(8),
    fetchNews(),
    computeAllPlayers(),
  ]);
  const trending = trendingSettled.status === "fulfilled" ? trendingSettled.value : [];
  const news = newsSettled.status === "fulfilled" ? newsSettled.value.slice(0, 6) : [];
  const playerCount =
    computedSettled.status === "fulfilled" ? computedSettled.value.size : 0;
  const season = currentStatSeason();

  const stats = [
    { icon: Users, label: `${playerCount.toLocaleString()} players valued` },
    { icon: Database, label: `${season} & ${season - 1} weekly stats` },
    { icon: Newspaper, label: "4 live news feeds" },
    { icon: Brain, label: "AI verdicts with receipts" },
  ];

  return (
    <div>
      <section className="field-lines hero-glow relative overflow-hidden border-b border-white/5">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-volt/30 bg-volt/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-volt">
            <TrendingUp className="h-3.5 w-3.5" />
            {season} season data · live news · Sleeper leagues
          </p>
          <h1 className="max-w-4xl font-display text-6xl leading-[0.95] tracking-wide text-slate-100 sm:text-7xl lg:text-8xl">
            WIN YOUR LEAGUE.
            <br />
            <span className="text-volt">ONE TRADE AT A TIME.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">
            Evaluate any fantasy trade with two seasons of real NFL stats,
            weekly consistency profiles, injury reports, live news, and an AI
            analyst that shows its math — tuned for 12-team PPR.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/analyzer"
              className="inline-flex items-center gap-2 rounded-lg bg-volt px-6 py-3 text-sm font-bold text-slate-950 transition-all hover:brightness-110 hover:shadow-[0_0_30px_rgba(163,230,53,0.35)]"
            >
              Analyze a Trade
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/players"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-200 transition-colors hover:border-volt/40 hover:text-volt"
            >
              Browse Player Values
            </Link>
          </div>
          <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-slate-900/60 px-3.5 py-3"
              >
                <stat.icon className="h-4 w-4 shrink-0 text-volt" />
                <span className="text-xs font-medium text-slate-300">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {trending.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <SectionHeading
            icon={TrendingUp}
            title="TRENDING UP"
            subtitle="Most added players across Sleeper leagues in the last 24 hours"
            action={
              <Link
                href="/players"
                className="inline-flex items-center gap-1 text-sm font-medium text-volt hover:text-volt/80"
              >
                Full value board
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {trending.map((player, index) => (
              <PlayerCard key={player.id} player={player} rank={index + 1} />
            ))}
          </div>
        </section>
      )}

      <WatchlistPanel news={news} />

      {news.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <SectionHeading
            icon={Newspaper}
            title="AROUND THE LEAGUE"
            subtitle="Latest NFL headlines pulled live from ESPN, CBS, Yahoo, and ProFootballTalk"
            action={
              <Link
                href="/news"
                className="inline-flex items-center gap-1 text-sm font-medium text-volt hover:text-volt/80"
              >
                All news
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {news.map((item) => (
              <NewsCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <SectionHeading
          icon={Brain}
          title="HOW IT WORKS"
          subtitle="Facts first, AI second — the analysis cites real numbers, not vibes"
        />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <div
              key={step.title}
              className="rounded-xl border border-white/5 bg-slate-900/60 p-5"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-volt/30 bg-volt/10">
                  <step.icon className="h-4.5 w-4.5 text-volt" />
                </span>
                <span className="font-display text-2xl text-slate-600">
                  0{index + 1}
                </span>
              </div>
              <h3 className="mt-3 font-display text-xl tracking-wide text-slate-100">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 pt-4 sm:px-6">
        <div className="field-lines relative overflow-hidden rounded-2xl border border-volt/20 bg-slate-900/60 px-6 py-12 text-center">
          <div className="hero-glow absolute inset-0" />
          <div className="relative">
            <h2 className="font-display text-4xl tracking-wide text-slate-100 sm:text-5xl">
              THAT TRADE OFFER ON YOUR DESK?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-slate-400">
              Stop guessing. Get a data-backed verdict in seconds — with the
              reasoning to take back to your league chat.
            </p>
            <Link
              href="/analyzer"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-volt px-6 py-3 text-sm font-bold text-slate-950 transition-all hover:brightness-110 hover:shadow-[0_0_30px_rgba(163,230,53,0.35)]"
            >
              Run the Analysis
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
