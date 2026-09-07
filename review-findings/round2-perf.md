# Performance & Resource Review — Round 2 (2026-09-07)

Read-only review. All prior review-findings/*.md read first; anything they already list (memory-growth items, player-detail double-fetch, watchlist remount flicker, single-flight getCached, sleeperFetch timeout, scheduler overlap, etc.) is excluded — those are either already fixed or known. New findings ranked smallest-change/biggest-win first.

---

## New findings (ranked by leverage)

### P1 — Home page runs the entire 3 000-player summary pipeline just to print a count
**Impact: High (home-page TTFB + CPU on the most-visited route) · trivial fix**
**Files:** `src/app/page.tsx:17-27` (with `src/lib/nfl-data.ts:224-259`)

Current: `HomePage` awaits `getPlayerSummaries()` inside `Promise.allSettled` and uses the result **only** for `summaries.value.length` (`page.tsx:27`). On a cold or memo-expired (5 min) hit, that triggers `computeAllPlayers()` + `fetchTeamByeWeeks()` + `recordDailyScores` (SQLite write tx) + `computeValueTrends` (full `value_history` date-scan, see P2) + `attachProjectionContext` + a 3 000-element sort — all to render the number "3 000 players valued".

Failing scenario: first visitor after each 5-minute memo window pays hundreds of ms of CPU + 2 DB queries for a stat tile; concurrent cold hits amplify via the (now single-flighted) loader.

Fix: `const computed = await computeAllPlayers(); const playerCount = computed.size;` — or cache the count in the refresh cycle. Expected gain: removes the heaviest call from the home page's critical path; home render drops to trending (top-8) + 20 news rows.

### P2 — `value_history` has no index on `date`; trend queries full-scan a table that grows ~3 000 rows/day forever
**Impact: High (grows daily) · one-line DDL + retention DELETE**
**Files:** `src/lib/db.ts:10-15` (schema), `src/lib/value-history.ts:37-42` (`SELECT MAX(date) … WHERE date < ?`) and `:43-46` (`SELECT player_id, score … WHERE date = ?`)

Current: `value_history`'s only key is `PRIMARY KEY (player_id, date)`, which cannot serve date-only predicates. `computeValueTrends` runs both a `MAX(date)` scan and a `WHERE date = ?` scan over the whole table. The table gets ~3 000 rows per day with **no retention prune anywhere** (grep-verified).

Failing scenario: by week 8 of the season the table holds ~700k rows; every `getPlayerSummaries` memo expiry (every 5 min) does two full scans of it; by season's end ~1M rows scanned per trend pass, every 5 minutes, plus the same scans inside `getPlayerDetail` (P3).

Fix: (a) `CREATE INDEX IF NOT EXISTS idx_value_history_date ON value_history (date);` in the db.ts bootstrap. (b) In `executeRefreshCycle`, add `DELETE FROM value_history WHERE date < date('now', '-45 days')` (the UI only uses a 30-day window — `getPlayerValueHistory` defaults to 30). Expected gain: trend queries go from O(table) to O(rows-per-day); DB file stops growing without bound.

### P3 — `getPlayerDetail` re-derives the trend for one player by scanning the entire prior-day snapshot
**Impact: Medium-High · small fix**
**Files:** `src/lib/nfl-data.ts:486-496`; `src/lib/value-history.ts:35-55`

Current: for a single player page, `getPlayerDetail` builds a 1-entry `Map([[id, score]])` and calls the **batch** `computeValueTrends`, which runs the `MAX(date)` full scan, then fetches **every** player's prior-day score (~3 000 rows) to look up one. The batch pass in `computePlayerSummaries` already computes trends for all players — this is pure repeated work on the player-detail hot path.

Failing scenario: every `/player/[id]` view costs two extra full-table scans (×2 for metadata+content) for a number already computed in the summaries pass.

Fix: add `getPlayerValueTrend(playerId)` to value-history that runs one indexed point lookup (needs P2's date index). Expected gain: player-page trend cost drops from O(all players) to O(1).

### P4 — `matchNewsForPlayer` re-normalizes the same news items once per player (analyze hot path)
**Impact: Medium · contained fix**
**Files:** `src/lib/news.ts:268-296` (normalizeName inside the per-item loop, `Date.parse(item.publishedAt)` likewise); called per-player at `src/lib/nfl-data.ts:398-400` (bundles) and `:505` (detail)

Current: `normalizeName` (two regex replaces + trim) runs on title+summary for **every (player, item) pair**. A roster-context analyze call fetches bundles for give + get + up to 30 roster ids = ~35 players × 300 news items ≈ **10 500 re-normalizations of the same 300 strings** per request, each allocating a new string.

Failing scenario: `POST /api/analyze` with a full 16-man roster attached spends single-digit ms × 10k in pure regex churn before the AI call — added latency on the app's marquee route.

Fix: precompute normalized haystacks (+parsed timestamps) once per `fetchNews()` result — memoize on the array identity or build a `{item, hay, ts}` list at the top of `getPlayerBundles` and pass it down. Expected gain: ~30× reduction in matching work for multi-player requests; measurable analyze latency drop.

### P5 — Read path writes to the DB: every `getPlayerSummaries` compute runs `recordDailyScores` + trend scan
**Impact: Medium · small fix**
**Files:** `src/lib/nfl-data.ts:236-238`

Current: `GET /api/players` (and the home page) trigger a SQLite **write transaction** via `recordDailyScores` on the read path (daily-guarded, but the guard only helps within a UTC day — the first request of each day per process still opens a write tx) plus a trend scan. This also structurally prevents adding response caching to these GETs.

Failing scenario: first `/api/players` hit after midnight takes a write lock while a background refresh transaction is mid-flight → busy-wait added to request latency.

Fix: move `recordDailyScores` out of `computePlayerSummaries` — it already runs in `executeRefreshCycle`; the read path only needs `computeValueTrends`. Expected gain: GET handlers become read-only; removes WAL contention window.

### P6 — Watchlist panel: always-on 30 s poll, sequential fetches, and non-memoized O(players × news) matching on every render
**Impact: Medium · moderate fix**
**Files:** `src/components/watchlist-panel.tsx:31-67` (poll effect), `:85-88` (inline filter in render map)

Current: (a) `setInterval(load, 30000)` runs forever, including when the tab is backgrounded — every hidden tab fires 2 requests/30 s, each server-side pass walking the summaries pipeline. (b) `setPlayers(data.players)` installs a fresh array every tick → full panel re-render, and the news-match `filter` inside the row map re-runs `titleMentionsPlayer` for every player × every news item on **every** render — including renders caused by unrelated state. (c) The home page passes only 6 news items to the panel, so the matching cost buys little there.

Failing scenario: user parks the home tab open overnight with a 10-player watchlist → ~5 760 requests/day from a hidden tab, each poll triggering a full-panel re-render + 60 regex matches when values change.

Fix: wrap matches in `useMemo`; skip the second fetch when the id list is unchanged and data is fresh; pause the interval on `document.hidden` (visibilitychange). Expected gain: zero background-tab traffic, ~10× fewer match computations per update.

### P7 — `applyPositionRanks` sort comparator calls `aggs.find()` per comparison
**Impact: Medium · small fix**
**Files:** `src/lib/nfl-data.ts:167-180`

Current: the comparator does `a.aggs.find((g) => g.season === season)?.total ?? -1` on **every comparison**, and `group.forEach` re-runs `find` a third time per player. Sorting ~800 WRs ≈ 8 000 comparisons × 2–3 finds each, per position, per season, per recompute. (The old spread-append quadratic is fixed — `push` is used now — but the comparator cost is new.)

Failing scenario: every `computed_players_v4` expiry (3 h) plus each refresh cycle pays ~50k redundant linear scans inside sorts.

Fix: decorate-sort-undecorate — precompute a `Map<ComputedPlayer, number>` of season totals per group before sorting, and write `posRank` from the captured total. Expected gain: comparator becomes O(1); rank pass is a clean O(n log n).

### P8 — `getEspnProjections()` re-SELECTs the whole projections table on every attach call
**Impact: Low-Medium · small fix**
**Files:** `src/lib/projections.ts:205-221`, `:223-243`; callers: `computePlayerSummaries` (memoized), `getPlayerBundles` (per analyze request ×3 — see P9), `getPlayerDetail` (×2 per player page)

Current: each `attachProjectionContext` call runs a full-table SELECT and rebuilds the Map plus `getCurrentWeek()`. Cheap per call, but repeats 3× per analyze and 2× per player page for data that only changes on `projections/sync`.

Fix: memoize the Map on `globalThis` keyed by season, invalidated by a counter bumped in `saveLeagueProjections` (or a 60 s TTL). Expected gain: removes redundant queries from the analyze/player paths; trivial.

### P9 — Analyze route fans `getPlayerBundles` three times
**Impact: Low-Medium · small fix**
**Files:** `src/app/api/analyze/route.ts:84-90`

Current: `getPlayerBundles(giveIds)`, `getPlayerBundles(getIds)`, `getPlayerBundles(myRosterIds)` each independently call `computeAllPlayers` + `fetchNews` + `fetchTeamByeWeeks` + `attachProjectionContext` (so P4's news matching and P8's SELECT run in three separate passes over the same cached inputs).

Fix: one `getPlayerBundles([...giveIds, ...getIds, ...myRosterIds])` then split by id (order is preserved). Expected gain: 3× fewer pipeline invocations per analyze; pairs naturally with P4/P8.

### P10 — `getArchivedNews` runs a `COUNT(*)` full scan as an emptiness probe on every call
**Impact: Low-Medium · one-line fix**
**Files:** `src/lib/news-archive.ts:146-151`; hot caller `src/lib/nfl-data.ts:455-459` (`getArchivedNewsForMatching` → every player-detail request)

Current: every `getArchivedNews` (news page, home page, each player page ×2) starts with `SELECT COUNT(*) FROM news_items` — a full scan of a table growing ~1.3 M rows/year — only to decide `count === 0`.

Fix: `SELECT EXISTS(SELECT 1 FROM news_items LIMIT 1)`. Expected gain: player-page/news-page latency independent of archive size.

### P11 — `getCached` file-cache write serializes multi-MB JSON on every `computed_players_v4` recompute
**Impact: Low · moderate fix**
**Files:** `src/lib/cache.ts:36-44` (write), payload built at `src/lib/nfl-data.ts:126-183`

Current: the cached `ComputedPlayer[]` embeds, per player: the full NFLPlayer object, every season agg including `weeks: WeekPoints[]` (18 × 2 seasons), and the value breakdown — ~5 MB total. Every 3 h TTL expiry does `JSON.stringify` of the whole array + a 5 MB file write; every cold boot does the matching `JSON.parse` (~100–300 ms of main-thread parse, plus 36 Sleeper week-file parses).

Failing scenario: container restart during a week-1 traffic spike → first request blocks on a ~5 MB JSON.parse.

Fix options: (a) gzip the cache file; (b) store `weeks` as parallel number arrays; (c) accept it — 3 h cadence makes steady-state cost negligible. Low priority but cheap.

### P12 — `localeCompare` inside hot sort comparators
**Impact: Low · one-line fix**
**Files:** `src/lib/nfl-data.ts:386-391` (`listPlayerSummaries` tie-break), `:243-247` (summaries sort), `:321-327` (search ranking)

Current: every `/api/players` request re-sorts the full 3 000-element list; ties (common — all null-score players map to -1) fall through to `localeCompare`, which is 10–50× slower than a plain compare. Tens of thousands of collator calls per request.

Fix: module-scope `const collator = new Intl.Collator("en")` and use `collator.compare`. Expected gain: a few ms per players-list request; trivial and free.

### P13 — Docker: no HEALTHCHECK, compose has no healthcheck or resource limits
**Impact: Low · few lines**
**Files:** `Dockerfile` (runner stage), `docker-compose.yml`

Current: `restart: unless-stopped` only reacts to process exit, so a wedged-but-alive server is never restarted; a public `/api/health` exists to probe. No memory limit while the process holds ~5 MB cache + 3 000-player Map + news arrays.

Fix: `HEALTHCHECK CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"`; `healthcheck:` + `mem_limit: 512m` in compose. Expected gain: self-healing restarts, bounded blast radius.

### P14 — `next.config.ts` images config is dead; avatars bypass next/image entirely
**Impact: Low**
**Files:** `next.config.ts:5-12`; `src/components/player-avatar.tsx:37-49`; `src/lib/utils.ts:118-124`

Current: `images.remotePatterns` for sleepercdn.com is configured but **no `next/image` exists in the repo** — `PlayerAvatar` renders raw `<img>` to full-size sleepercdn thumbs (small, `loading="lazy"` set, so practical impact is small). Either adopt `next/image` for the avatar or drop the unused config. Also add `poweredByHeader: false` while touching the file.

### P15 — `readCacheStats` stats every cache file sequentially
**Impact: Low · tiny fix**
**Files:** `src/lib/ops.ts:76-110`

Current: the /ops cache scan `await fs.stat(full)` one-at-a-time over ~40+ files. Fix: `await Promise.all(entries.map(...))`. Trivial.

---

## Confirmations (previously reported — verified state, no new action)

- **Single-flight `getCached`** — implemented (`cache.ts:8, 30-51`); data-pipeline bug 3 fixed.
- **`sleeperFetch` 20 s timeout** — present (`sleeper.ts:76-85`).
- **`backgroundStarted` on globalThis, refresh lock, `DISABLE_INTERNAL_SCHEDULER`** — present (`nfl-data.ts:34-37, 92-124`).
- **Season-boundary live-TTL guard** — `fetchWeeklyStats` checks `currentWeek >= 1 && week <= currentWeek+1`; `fetchSeasonWeekly` short-circuits before week 1 (`sleeper.ts:166-201`).
- **`corePromise` reset per refresh cycle** — `executeRefreshCycle` nulls it (`nfl-data.ts:42`).
- **`busy_timeout = 5000`** — set (`db.ts:15`).
- **League cache LRU (50) + credential-keyed** — implemented (`espn-league/route.ts:13-55`).
- **applyPositionRanks spread-append** — now `push` (`nfl-data.ts:163`); residual comparator cost is new (P7). **buildSleeperIndexes spread-append still present** (`espn.ts:406-407`) — known, keys near-unique so cost is 2 allocations/player.
- **Player-detail double pipeline run** (`player/[id]/page.tsx:24,77`) — still present, known (frontend #7).
- **Watchlist flicker/unmount** — fixed; P6 covers residual poll/render waste.

## Not pursued (checked, judged not worth changing)

- `computeAllPlayers` rebuilding the 3 000-entry Map per call — sub-ms.
- `groupByPosition` spread-append (`league-intel.ts:62-64`) — arrays ≤ 20 players.
- `optimalLineup` `pool.find` per slot — pool ≤ 30, slots ≤ 12.
- lucide-react named imports — Next 15 `optimizePackageImports` covers it.
- `fetchNews` 11-source fan-out — TTL-cached 8 min + single-flighted; fine.
- `/api/players` payload size — paginated on every path; no 3 000-player payload found on any route (export route streams CSV).
- Docker deps/build layering — already optimal for cache invalidation.

*Review date: 2026-09-07 · Read-only review · No files modified.*
