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
import { CountUp } from "@/components/count-up";
import { NewsCard } from "@/components/news-card";
import { PlayerCard } from "@/components/player-card";
import { Reveal } from "@/components/reveal";
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
    text: "Search any NFL player and stack both sides of the deal. Pull your real league roster for full context.",
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

  const stats: { value: number; label: string; icon: typeof Users }[] = [
    { value: playerCount, label: "players valued", icon: Users },
    { value: 36, label: "weeks of NFL stats", icon: Database },
    { value: 300, label: "news articles per refresh", icon: Newspaper },
    { value: 32, label: "NFL teams tracked", icon: Trophy },
  ];

  return (
    <div>
      <section className="field-lines hero-glow relative overflow-hidden border-b border-white/5">
        <svg
          viewBox="0 0 64 64"
          className="animate-float absolute right-[12%] top-24 hidden w-40 opacity-[0.07] lg:block"
          aria-hidden="true"
        >
          <ellipse cx="32" cy="32" rx="30" ry="18" transform="rotate(-35 32 32)" fill="#a3e635" />
          <path
            d="M26 26 L30 30 M30 26 L26 30 M34 34 L38 38 M38 34 L34 38"
            stroke="#020617"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <path d="M28 30 L36 38" stroke="#020617" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
          <p
            className="animate-fade-up mb-4 inline-flex items-center gap-2 rounded-full border border-volt/30 bg-volt/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-volt"
            style={{ animationDelay: "0ms" }}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            {season} season data · live news · ESPN leagues
          </p>
          <h1 className="max-w-4xl font-display text-6xl leading-[0.95] tracking-wide text-slate-100 sm:text-7xl lg:text-8xl">
            <span
              className="animate-fade-up block"
              style={{ animationDelay: "90ms" }}
            >
              WIN YOUR LEAGUE.
            </span>
            <span
              className="animate-fade-up block text-volt"
              style={{ animationDelay: "220ms" }}
            >
              ONE TRADE AT A TIME.
            </span>
          </h1>
          <p
            className="animate-fade-up mt-6 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg"
            style={{ animationDelay: "340ms" }}
          >
            Evaluate any fantasy trade with two seasons of real NFL stats,
            weekly consistency profiles, injury reports, live news, and an AI
            analyst that shows its math.
          </p>
          <div
            className="animate-fade-up mt-8 flex flex-wrap items-center gap-3"
            style={{ animationDelay: "460ms" }}
          >
            <Link
              href="/analyzer"
              className="animate-glow inline-flex items-center gap-2 rounded-lg bg-volt px-6 py-3 text-sm font-bold text-slate-950 transition-all hover:brightness-110"
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
          <div
            className="animate-fade-up mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4"
            style={{ animationDelay: "580ms" }}
          >
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="flex items-center gap-3 rounded-lg border border-white/5 bg-slate-900/60 px-4 py-3 transition-colors hover:border-volt/30"
              >
                <stat.icon className="h-5 w-5 shrink-0 text-volt" />
                <div>
                  <p className="font-display text-2xl leading-none text-slate-100">
                    <CountUp value={stat.value} />
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <WatchlistPanel news={news} />

      {trending.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <SectionHeading
            icon={TrendingUp}
            title="TRENDING UP"
            subtitle="Most added players across fantasy leagues in the last 24 hours"
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
              <Reveal key={player.id} delay={index * 70}>
                <PlayerCard player={player} rank={index + 1} />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {news.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <SectionHeading
            icon={Newspaper}
            title="AROUND THE LEAGUE"
            subtitle="Latest NFL headlines pulled live from every major outlet"
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
            {news.map((item, index) => (
              <Reveal key={item.id} delay={index * 60}>
                <NewsCard item={item} />
              </Reveal>
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
            <Reveal key={step.title} delay={index * 120}>
              <div className="card-hover h-full rounded-xl border border-white/5 bg-slate-900/60 p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-volt/30 bg-volt/10">
                    <step.icon className="h-4 w-4 text-volt" />
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
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 pt-4 sm:px-6">
        <Reveal>
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
                className="animate-glow mt-6 inline-flex items-center gap-2 rounded-lg bg-volt px-6 py-3 text-sm font-bold text-slate-950 transition-all hover:brightness-110"
              >
                Run the Analysis
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
