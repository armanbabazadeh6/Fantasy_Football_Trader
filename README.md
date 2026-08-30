![Fantasy Football Trader](public/banner.svg)

# Fantasy Football Trader

An AI-powered fantasy football trade analyzer built for personal league use. Stack
both sides of a trade, and the app evaluates it using **two seasons of real NFL
stats, weekly consistency profiles, injury reports, live news, and your actual
Sleeper league roster** — then a GLM-powered analyst delivers a verdict with its
reasoning shown.

Tuned for 12-team PPR leagues.

## Features

| Feature | What it does |
| --- | --- |
| **Trade Analyzer** | Build any trade with a searchable player picker. A transparent value engine scores each side live as you build, then the AI analyst returns a verdict (Accept / Counter / Decline), confidence, key factors, risks, news impact, and counter-offer ideas. |
| **Player Value Board** | Every fantasy-relevant NFL player scored 0-100 with sortable columns: PPG, games, positional rank, age, tier. Search and filter by position. |
| **Player Pages** | Weekly fantasy output chart, boom/bust rates, best/worst weeks, two-season history, value breakdown, and every recent news mention. |
| **Live News Feed** | 300+ headlines per refresh from ESPN (news API + RSS), Google News (breaking, fantasy, and injury queries — each story labeled with its real publisher), CBS Sports, Yahoo Sports + Yahoo Fantasy, ProFootballTalk, Rotoballer, and the Sleeper blog — the same feed the analyzer reads, matched to players by name. Cache refreshes every 8 minutes. |
| **League Intelligence** | Connect your ESPN Fantasy or Sleeper league for standings, rosters, and scoring format. ESPN adds: **graded trade history** (every completed trade valued by the engine with winners called), **power rankings** (with ESPN's own projected rank shown alongside), a **trade partner finder**, an **auto trade proposer** that generates value-balanced offers you can copy into league chat, and **optimal lineups** built from your real roster slots using ESPN scoring. |
| **ESPN Sync + Accuracy Audit** | Player positions and team names match ESPN exactly; roster displays show ESPN's own season points alongside engine values. An audit script cross-checks every rostered player's season totals against ESPN's numbers — 0 unmatched players, 0 position differences, 79% within 2.0 fantasy points (remaining deltas are platform scoring quirks on QBs/D-STs). |
| **Watchlist** | Star any player from the value board or their page — the home dashboard shows your watched players with injuries, bye weeks, and their latest news mentions. |
| **Shareable Verdicts** | Export any trade verdict as a clean branded card (PNG) to drop in league chat. |
| **Bye Week Awareness** | Full-season schedule is parsed to derive every team's bye week — shown on player pages, the value board, trade cards, and included in the AI's context. |
| **Saved Analyses** | Every verdict is saved locally so you can revisit past trade calls. |

## How values are computed

The value engine is deterministic and fully visible on each player page:

- **Production core (0-80)** — weighted points per game over the last two seasons
  (70% most recent, 30% prior), measured against a replacement-level baseline for
  the position. Small samples (< 8 games) are shrunk toward the prior season to
  avoid overreacting to hot streaks.
- **Age curve** — bonus up to age 27, penalties accelerate from 30 onward (milder
  for QBs).
- **Consistency** — lower weekly standard deviation relative to scoring earns a bonus.
- **Boom bonus** — share of 20+ point weeks (24+ for QBs).
- **Positional scarcity** — top-3 tight ends get a premium.
- **Injury multiplier** — IR/Out cuts value 45%, questionable doubtful 15%.
- **Trending** — adds across Sleeper leagues in the last 24h nudge value up.

The AI layer reads this computed context plus recent news — it never invents
numbers, and if no API key is configured the app falls back to the rule-engine
verdict.

## Quick start

Requires Node.js 18.18+.

```bash
git clone git@github.com:armanbabazadeh6/Fantasy_Football_Trader.git
cd Fantasy_Football_Trader
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. The first request fetches Sleeper data (~15-30s),
then everything is served from a persistent on-disk cache.

### Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `AI_BASE_URL` | No | OpenAI-compatible chat completions endpoint, e.g. `https://api.openference.com/v1` |
| `AI_API_KEY` | No | Your API key. Without it the app uses the rule-engine verdict only. |
| `AI_MODEL` | No | Model ID to call, e.g. `openference/GLM-5.3` |

## Data sources

| Source | Use |
| --- | --- |
| [Sleeper API](https://docs.sleeper.app) | Players, weekly/season stats, trending |
| ESPN Fantasy API | League standings, rosters, scoring settings (private leagues via your own `espn_s2` + `SWID` cookies, which stay in your browser) |
| ESPN site APIs | NFL news feed, full-season schedule for bye weeks |
| CBS Sports, Yahoo Sports + Fantasy, ProFootballTalk, Rotoballer, Sleeper Blog RSS | Additional live news |
| Google News RSS | Breaking NFL (last 24h), injury, and fantasy queries across every major outlet |
| Sleeper CDN | Player headshots and team logos |

All data is cached to a local `.cache/` directory with per-type TTLs so the
Sleeper API is treated gently and restarts are instant.

## Testing

The smoke suite runs unit tests on the scoring math plus live integration tests
against the real Sleeper API and news feeds:

```bash
npm run smoke
```

ESPN integration can be verified against a real league with saved cookies:

```bash
npx tsx scripts/espn-live-check.ts <cookie-file> <league-id>
npx tsx scripts/espn-audit.ts <cookie-file> <league-id>
```

## Project structure

```
src/
  app/
    page.tsx              Home (watchlist, trending, news)
    analyzer/             Trade builder + verdict UI
    players/              Value board
    player/[id]/          Player detail
    news/                 News browser
    league/               League intelligence (ESPN + Sleeper)
    api/
      analyze/            Trade analysis (rule engine + AI)
      players/            Player search / fetch by ids
      trending/           Trending adds
      news/               News feed
      league/[leagueId]/  Sleeper standings + rosters
      espn-league/[leagueId]/
        route.ts          ESPN standings + rosters
        transactions/     Graded trade history
  components/             Shared UI
  lib/
    sleeper.ts            Sleeper API client
    espn.ts              ESPN fantasy client + player-to-Sleeper mapping
    league-intel.ts       Power rankings, trade partners, optimal lineups
    schedule.ts           Bye weeks from ESPN schedule
    cache.ts              Disk cache with TTLs
    fantasy.ts            PPR math + weekly aggregation
    value-engine.ts       Player values, side totals, verdicts
    news.ts                RSS + Google News aggregation, player matching
    share-card.ts         Verdict card generator
    ai.ts                 OpenAI-compatible AI analyst client
    nfl-data.ts           Composition layer
scripts/
  smoke.ts                Unit + integration test suite
```

## Roadmap

- AI narratives via OpenAI-compatible endpoints (GLM) — wired and awaiting an API key
- In-season weekly projections and matchup context
- Dynasty vs redraft value profiles
- Automated watchlists for players in your news feed

## Disclaimer

For personal fantasy league use. Not affiliated with the NFL, ESPN, or Sleeper.
