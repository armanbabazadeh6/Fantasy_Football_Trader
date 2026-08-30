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
| **Live News Feed** | Headlines from ESPN (news API + RSS), CBS Sports, Yahoo Sports, and ProFootballTalk — the same feed the analyzer reads, matched to players by name. |
| **League Integration** | Connect your ESPN Fantasy or Sleeper league to load real standings, rosters, and scoring format. Set your team once and the analyzer shows quick-add chips from your roster and factors your positional needs into the verdict. ESPN rosters are matched to Sleeper player IDs automatically. |
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
| CBS Sports, Yahoo Sports, ProFootballTalk RSS | Additional live news |
| Sleeper CDN | Player headshots and team logos |

All data is cached to a local `.cache/` directory with per-type TTLs so the
Sleeper API is treated gently and restarts are instant.

## Testing

The smoke suite runs unit tests on the scoring math plus live integration tests
against the real Sleeper API and news feeds:

```bash
npm run smoke
```

## Project structure

```
src/
  app/
    page.tsx              Home
    analyzer/             Trade builder + verdict UI
    players/             Value board
    player/[id]/         Player detail
    news/                News browser
    league/              League import (ESPN + Sleeper)
    api/
      analyze/           Trade analysis (rule engine + AI)
      players/           Player search
      trending/          Trending adds
      news/              News feed
      league/[leagueId]/ League standings + rosters
  components/            Shared UI
  lib/
    sleeper.ts           Sleeper API client
    cache.ts             Disk cache with TTLs
    fantasy.ts           PPR math + weekly aggregation
    value-engine.ts      Player values, side totals, verdicts
    news.ts              RSS aggregation + player matching
    ai.ts                OpenAI-compatible AI analyst client
    nfl-data.ts          Composition layer
scripts/
  smoke.ts               Unit + integration test suite
```

## Roadmap

- AI narratives via OpenAI-compatible endpoints (GLM) — wired and awaiting an API key
- In-season weekly projections and matchup context
- Dynasty vs redraft value profiles
- Automated watchlists for players in your news feed

## Disclaimer

For personal fantasy league use. Not affiliated with the NFL, ESPN, or Sleeper.
