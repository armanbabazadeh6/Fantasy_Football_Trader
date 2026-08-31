![Fantasy Football Trader](public/banner.svg)

# Fantasy Football Trader

A fantasy football trade analyzer you run for your own league. Stack both sides
of a trade and the app scores it against two seasons of real NFL stats,
consistency profiles, injury reports, and live news. A GLM-powered analyst
reads all of it and returns a verdict you can argue with, because every number
it used is on the screen.

Tuned for 12-team PPR.

## Features

| Feature | What you get |
| --- | --- |
| Trade Analyzer | Search players, build both sides, watch the value balance move as you build. The verdict names a winner, a confidence score, the factors that drove it, the risks, and counter-offer ideas. |
| Value Board | ~3,000 players scored 0-100. Sort by PPG, games, positional rank, age, or value. Daily snapshots give each player a trend arrow so you can spot rising and falling assets. |
| Player Pages | Weekly scoring chart, game log with passing, rushing, and receiving lines, boom and bust rates, value history sparkline, and recent news mentions. |
| Head to Head | `/compare` puts any two players side by side with overlaid weekly scoring and winner highlighting on every stat. |
| Waiver Wire | The 30 most added players ranked by value, with badges when one fills a weak spot on your roster. |
| League Intelligence | Connect an ESPN or Sleeper league for standings, graded trade history, power rankings, and trade partners. The proposer generates value-balanced offers with copy-paste text for league chat. |
| ESPN Accuracy | Positions, team names, and season points match what ESPN shows. An audit script verified 150 rostered players: 0 unmatched, 0 position differences, 79% within 2.0 fantasy points of ESPN's own totals. |
| Watchlist | Star players anywhere. The home dashboard tracks their injuries, bye weeks, and news. Stored server side, so it survives browser clears. |
| Verdict Cards | Export any verdict as a PNG card for league chat. |
| Saved Analyses | Every trade call is stored in SQLite with both rosters and the verdict. |

## How values are computed

The engine is deterministic and every component shows on the player page:

- Production core (0-80): weighted PPG over two seasons, 70% recent and 30%
  prior, against a replacement-level baseline per position. Samples under 8
  games shrink toward the prior season so hot streaks do not inflate anyone.
- Age curve: bonus through 27, penalties from 30, milder for quarterbacks.
- Consistency: low weekly standard deviation relative to scoring earns a bonus.
- Boom rate: share of 20-point weeks, 24 for quarterbacks.
- Scarcity: top-3 tight ends get a premium.
- Injury: IR or Out cuts value 45%, Questionable or Doubtful 15%.
- Trending: adds across Sleeper leagues in the last day nudge value up.

The AI layer reads this context plus matched news. It invents nothing. No API
key configured? You get the rule-engine verdict with the same math on screen.

## Quick start

Requires Node.js 18.18+.

```bash
git clone git@github.com:armanbabazadeh6/Fantasy_Football_Trader.git
cd Fantasy_Football_Trader
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. The first request pulls Sleeper data, which takes
15 to 30 seconds. After that a disk cache serves everything and a background
job refreshes data every two hours.

### Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `AI_BASE_URL` | No | OpenAI-compatible chat completions endpoint, e.g. `https://api.openference.com/v1` |
| `AI_API_KEY` | No | API key. Without it, verdicts come from the rule engine only. |
| `AI_MODEL` | No | Model ID, e.g. `openference/GLM-5.3` |
| `AUTH_PASSWORD` | No | When set, every page sits behind a password gate. Unset means open access. |
| `AUTH_SECRET` | No | HMAC key for the session cookie. Falls back to `AUTH_PASSWORD` when empty. |
| `CRON_SECRET` | No | When set, `POST /api/cron` with header `X-Cron-Secret` triggers a data refresh. |

## Data sources

| Source | Use |
| --- | --- |
| Sleeper API | Players, weekly and season stats, trending |
| ESPN Fantasy API | League standings, rosters, scoring, transactions. Private leagues need your `espn_s2` and `SWID` cookies, which stay in your browser. |
| ESPN site APIs | NFL news, full-season schedule for bye weeks |
| Google News RSS | Breaking, injury, and fantasy queries, with each story labeled by its publisher |
| ESPN, CBS, Yahoo, ProFootballTalk, Rotoballer, Sleeper blog | Additional news feeds, roughly 300 articles per refresh |
| Sleeper CDN | Player headshots and team logos |

News refreshes every 8 minutes. Stats and players carry their own TTLs in
`.cache/`, and the background scheduler keeps them warm.

## Testing

```bash
npm run smoke
```

Unit tests cover the scoring math, value engine, trade logic, and database
layer. Live integration tests hit the real Sleeper API and every news feed.

Two scripts verify ESPN integration against a real league using saved cookies:

```bash
npx tsx scripts/espn-live-check.ts <cookie-file> <league-id>
npx tsx scripts/espn-audit.ts <cookie-file> <league-id>
```

## Deployment

The app ships with a Dockerfile and a compose file, sized for a small VPS.

```bash
cp .env.example .env
docker compose up -d --build
```

SQLite data and the disk cache live in the `fft-data` and `fft-cache`
volumes, so rebuilds keep player values, projections, and the news archive.

To open it up beyond localhost, set `AUTH_PASSWORD` and `AUTH_SECRET` in
`.env` and restart. Every route then redirects to `/login` unless the browser
holds a signed session cookie. `GET /api/health` stays public for uptime
checks.

The in-process scheduler refreshes data every two hours. To drive refreshes
from outside instead, set `CRON_SECRET` and call:

```bash
curl -X POST -H "X-Cron-Secret: $CRON_SECRET" https://your-host/api/cron
```

A systemd timer or any uptime service works fine for this. Put HTTPS in
front with a reverse proxy, Caddy or nginx with a certificate, since the
container itself speaks plain HTTP.

## Project structure

```
src/
  app/
    analyzer/             Trade builder and verdict UI
    compare/              Head-to-head comparison
    league/               League intelligence, ESPN and Sleeper
    login/                Password gate sign-in
    news/                 News browser
    ops/                  Data pipeline dashboard
    player/[id]/          Player detail with game log
    players/              Value board with CSV export
    waiver/               Trending adds with roster-need badges
    api/
      analyze/            Trade analysis, rule engine + AI
      analyses/           Saved analyses (SQLite)
      auth/login/         Password sign-in, rate limited
      compare/            Comparison bundles
      cron/               External refresh trigger, X-Cron-Secret
      espn-league/[id]/   ESPN league + transactions
      export/players/     Value board CSV
      health/             Uptime endpoint, public
      news/               players/ trending/ watchlist/
      ops/health/         Pipeline health report
      league/[id]/       Sleeper league
  components/             Shared UI
  middleware.ts           Auth gate, active when AUTH_PASSWORD is set
  lib/
    espn.ts               ESPN client, player mapping, cookie handling
    sleeper.ts            Sleeper client
    value-engine.ts       Player values, verdicts, roster needs
    league-intel.ts       Power rankings, partners, proposals, lineups
    value-history.ts      Daily snapshots and trend deltas (SQLite)
    db.ts                 SQLite schema and connection
    nfl-data.ts           Data composition and background scheduler
    news-archive.ts       News archive, dedupe, classification
    ops.ts                Ops dashboard report
    projections.ts        ESPN projection sync and blending
    session.ts            Signed session cookies
    news.ts schedule.ts ai.ts cache.ts rate-limit.ts share-card.ts
  tickets/                Open work items
scripts/
  smoke.ts                Test suite
  espn-live-check.ts      Live ESPN verification
  espn-audit.ts           ESPN accuracy audit
Dockerfile                Multi-stage build with standalone output
docker-compose.yml        VPS deployment, data and cache volumes
```

## Roadmap

- AI verdicts, once an API key is set in `.env.local`
- Weekly projections with matchup context
- Dynasty and redraft value profiles

## Disclaimer

Personal league tool. Not affiliated with the NFL, ESPN, or Sleeper.
