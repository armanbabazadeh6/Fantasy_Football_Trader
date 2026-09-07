# Data Pipeline & Caching Review — Fantasy Football Trader

**Scope:** 13 files — `src/lib/{nfl-data,sleeper,espn,espn-session,cache,schedule,news,news-archive,ops}.ts`, `src/middleware.ts`, `src/instrumentation.ts`, `scripts/{espn-live-check,espn-audit}.ts` — plus supporting context (`db.ts`, `session.ts`, `value-history.ts`, `projections.ts`, `prewarm.ts`, API routes, `Dockerfile`, `docker-compose.yml`, `README.md`, `scripts/smoke.ts`).

**Method:** Static read-only review; every anchor below re-verified against current source. No files modified, no builds or smoke runs.

**Temporal context:** 2026-09-07. Kickoff 2026-09-10. `statSeasons()` = [2026, 2025]; 2026 weekly stats are legitimately empty until real games land.

---

## (a) BUGS

### 1. Season-boundary TTL logic burns upstream quota on an empty current season — and is the root cause of the known smoke failure

**Severity: Critical**
**Files:** `src/lib/sleeper.ts:87-90, 92-95, 173-187`; `scripts/smoke.ts:523-525`

`currentStatSeason()` (`sleeper.ts:87-90`) returns 2026 as soon as `getMonth() >= 8` — i.e. already on 2026-09-07, three days before kickoff. `statSeasons()` therefore returns `[2026, 2025]`, and `fetchWeeklyStats` picks the TTL via `season >= new Date().getFullYear()` (`sleeper.ts:177-178`): every one of the 18 weeks of the **empty** 2026 season is fetched under `LIVE_STATS_TTL` (6 h, `sleeper.ts:6`) instead of the long historical TTL. **Failing scenario:** 18 empty week files × 4 refreshes/day = 72 wasted Sleeper calls/day for zero data, from September through the process lifetime. Worse, the empty 2026 weeks get *cached as legitimate empty results*, so `aggregateSeason` produces no 2026 rows and the season is treated as "played and blank" rather than "not yet started". This is exactly what the smoke check trips on: `smoke.ts:523-525` asserts `week1Count > 100` against `seasons[0]` = 2026, but week 1 of 2026 is legitimately empty on 2026-09-07 — the check fails on a *correctly* empty dataset, and the pipeline has no notion of "season not started yet".

### 2. `corePromise` memo freezes all Sleeper core data for the entire process lifetime; a boot-time outage is baked in forever

**Severity: Critical**
**Files:** `src/lib/nfl-data.ts:34, 107-123`; `src/lib/sleeper.ts:189-203`; `src/lib/cache.ts:47-49`

Two distinct failure modes from the same root:

1. **Staleness by design.** `loadCoreData` (`nfl-data.ts:107-123`) memoizes with `corePromise ??=` and nothing in the repo ever resets it (grep-verified: only assignments are lines 34/108/122; `clearMemoryCache()` at `cache.ts:47-49` has **zero callers**). The 2 h background cycle (`nfl-data.ts:95-105`) calls `computeAllPlayers`, whose `computed_players_v3` cache (3 h TTL) expires and re-runs its loader — but that loader calls `loadCoreData()`, which returns the *same* settled `corePromise`. Player list, weekly stats, and trending counts are therefore loaded **once per process** and never refreshed. **Failing scenario:** a Docker container running for 6 weeks serves week-1 stats in week 7; the "2 h refresh" only genuinely refreshes news and ESPN league data.
2. **Outage baked in.** `fetchSeasonWeekly` swallows per-week fetch errors and resolves `{}` (`sleeper.ts:194-199`). That `{}` is *not* written to the file cache (the throw path bypasses the write), but it **is** the resolved value of `corePromise`. **Failing scenario:** app boots during a 5-minute Sleeper outage → every week of both seasons is `{}` → empty stat board, empty player values, until the process restarts — even after Sleeper recovers and every TTL expires, because no code path ever re-enters the `corePromise` body.

### 3. No single-flight in `getCached` — cache stampede on every cold key

**Severity: High**
**Files:** `src/lib/cache.ts:17-45` (dedup missing at :36); `src/lib/news.ts:194-199`; `src/lib/nfl-data.ts:126`

`getCached` deduplicates nothing between "check expired" and "write result"; N concurrent misses all invoke `loader()`. **Failing scenarios:** (1) `fetchNews` fans out to 11 loaders (7 RSS `news.ts:196`, ESPN API `:197`, 3 Google News `:198-199`) — a burst of first requests triggers 2–3× that many upstream fetches as each caller independently runs the whole fan-out. (2) `computeAllPlayers` re-derives the full ~3 000-player value board per concurrent caller (`nfl-data.ts:126`). (3) Combined with `prewarm.ts:14-23` firing ~7 warm functions at boot, the first user requests after deploy collide with the prewarm burst against Sleeper.

### 4. Background scheduler overlaps: HMR-unstable guard, no lock, and README-recommended double cycles

**Severity: High**
**Files:** `src/lib/nfl-data.ts:36, 84-88, 95-105`; `src/app/api/cron/route.ts:23`; `README.md:119-124`

`backgroundStarted` is module-local (`nfl-data.ts:36`) — unlike every other global in this codebase it is not parked on `globalThis`, so dev HMR module re-evaluation resets it and stacks duplicate `setInterval` chains. `startRefreshCycle` is fire-and-forget (`:84-88`) with no lock, and `/api/cron` invokes it too (`cron/route.ts:23`). **Failing scenario:** the README (`:119-124`) recommends an external cron hitting `/api/cron` with no documented flag to disable the internal 2 h timer → every external tick overlaps a timer cycle, doubling upstream load and racing `refresh_log` rows; with the 2 h vs 3 h TTL beat, cycles land mid-recompute and re-enter bug 3.

### 5. `sleeperFetch` is the only upstream client without a timeout

**Severity: High**
**File:** `src/lib/sleeper.ts:76-85`

ESPN fetches abort at 20 s (`espn.ts:194-195`), news at 10 s (`news.ts:98, 117`), scoreboard at 20 s (`schedule.ts:70`). `sleeperFetch` has no `AbortController`. **Failing scenario:** an unresponsive (not erroring) Sleeper endpoint hangs `loadCoreData` indefinitely; since all request paths share `corePromise` (bug 2), *every* page render hangs behind the same stuck promise, and `prewarm`'s `Promise.allSettled` never settles. The server reports healthy (`/api/health`) while fully wedged.

### 6. Scoreboard failures are cached as empty for 6 h; bye weeks are guessed from missing weeks and are wrong until ~week 5

**Severity: High**
**Files:** `src/lib/schedule.ts:5, 65-86, 88-117, 119-131, 133-137`

`fetchScoreboard`'s loader returns `[]` on `!res.ok` (`:77`) and on fetch/parse error (`:80-82`); that empty array is then cached for `SCOREBOARD_TTL` = 6 h. **Failing scenario (transient):** one 502 from ESPN blanks byes, matchups, and `getCurrentWeek` for 6 h. **Failing scenario (today, structural):** `fetchTeamByeWeeks` infers each team's bye as the first missing week in 5–14 (`:107-116`). Before any regular-season games exist (2026-09-07) every team's `played` set is empty → **every team's bye = week 5**, so `restOfSeasonGames` (`:133-137`) subtracts a phantom bye and `getPlayerDetail`'s `isBye` (`nfl-data.ts:484`) mislabels week 5 as a league-wide bye. The inference stays wrong until enough of weeks 5–14 have actually been played — byes are garbage precisely during early-season trading, the app's peak usage.

### 7. UTC-based "today" fragments value history and exiles undated news

**Severity: High**
**Files:** `src/lib/value-history.ts:3-5, 11-33, 35-55`; `src/lib/news.ts:89`

`today()` is the UTC date. **Failing scenario:** the daily value-snapshot guard (`value-history.ts:14-31`) flips at 8 pm ET, so late-evening refresh cycles write the *next* day's snapshot and fragment value history across UTC dates; `computeValueTrends`'s `MAX(date) < today` (`:38-42`) has the same skew, so "yesterday's value" comparisons are off by one day for a third of each evening. In `news.ts:89`, a missing `pubDate` becomes `new Date(0).toISOString()` = 1970-01-01 → that item is permanently excluded by `matchNewsForPlayer`'s recency cutoff; an *invalid* `pubDate` string makes `toISOString()` throw inside `toItems` — caught by `loadSource`'s try/catch (`news.ts:107-109`), so the **entire feed is silently dropped** for one malformed item. Same shape in `loadEspnApiNews` (`:152-153`).

### 8. ESPN session: no rotation for header users, cookie blob growth, no 401 backoff, and a false "ok" health signal

**Severity: Medium**
**Files:** `src/lib/espn.ts:209-227`; `src/lib/espn-session.ts:170-198`; `src/app/api/espn-league/[leagueId]/route.ts:88-89`; `src/lib/nfl-data.ts:58-66`

Cookie rotation only executes when `effectiveCreds.rawCookie` is set (`espn.ts:209-227`) — users who supplied `s2`/`swid` headers never get their session refreshed by Set-Cookie responses. `mergeSetCookies` (`espn-session.ts:170-198`) merges **every** Set-Cookie name including tracking cookies and deletions (empty values are kept, `:191-193` only compares value inequality), so the stored blob only ever grows. A dead session re-fails on every 2 h background cycle (`nfl-data.ts:58-66`) with no backoff or circuit breaker. Finally, the espn-league route calls `recordEspnSessionResult(true)` unconditionally after any success (`route.ts:88-89`) — even when success came from caller-supplied credentials — so `/ops` can report a healthy ESPN session while the persisted one is expired.

### 9. Error swallowing makes a dead news pipeline indistinguishable from a quiet one

**Severity: Medium**
**Files:** `src/lib/news.ts:105-112, 127, 152-154, 178, 189-191`; `src/lib/nfl-data.ts:65-66`; `src/lib/cache.ts:34, 42`

Every news loader catches to `[]`. **Failing scenario:** all 11 sources down (e.g. egress blocked in a new deploy) → `fetchNews` returns `[]` → `ingestNews` inserts nothing → `refresh_log` still shows `ok = 1` with `news = 0`; the only surface showing the problem is the ops dashboard's per-feed `feeds[].status` (`ops.ts`), which nobody sees unless they visit `/ops`. ESPN background errors are likewise silently dropped (`nfl-data.ts:65-66`). (The silent catches in `cache.ts` are acceptable for cache I/O.)

### 10. Unbounded memory growth: league cache, memory map, and quadratic array spreads

**Severity: Medium**
**Files:** `src/app/api/espn-league/[leagueId]/route.ts:15-17, 98`; `src/lib/cache.ts:9`; `src/lib/nfl-data.ts:155-180`; `src/lib/espn.ts:334-336`

`globalForLeagueCache` is a `Map` keyed by leagueId with no eviction (`route.ts:15-17`, set at `:98`); `cache.ts:9`'s memory map never evicts expired entries either — key count is unbounded once league-scoped keys exist. `applyPositionRanks` builds per-position arrays with `[...(get ?? []), entry]` per player (`nfl-data.ts:160`), and `buildSleeperIndexes` repeats the same spread-append pattern (`espn.ts:334-336`) — O(n²)-ish copying over ~3 000 players per recompute, per concurrent caller when bug 3 is in play.

### 11. `news_items` grows forever; cross-source duplicates persist

**Severity: Medium**
**File:** `src/lib/news-archive.ts` (ingest `:71-117`, dedupe key `:56-64`)

No retention `DELETE` exists anywhere in the repo. At ~300 items per cycle × 12 cycles/day, the table grows ~1.3 M rows/year; reads stay bounded (`getArchivedNews` LIMIT 500) but the DB file grows without limit. `dedupeKeyFor` (`:56-64`) slices the first 6 significant words *before* sorting and the row id is `source:title-slug`, so the same story syndicated across Google News publisher variants (different `source`, different word order) survives dedupe and appears multiple times in the archive feed.

### 12. SQLite: no `busy_timeout`

**Severity: Low**
**File:** `src/lib/db.ts:9-13`

WAL is on (`db.ts:13`), indexes are adequate, single-writer transactions are used correctly. But `busy_timeout` is never set: **failing scenario:** `tsx scripts/smoke.ts` while the server is mid-refresh → immediate `SQLITE_BUSY` instead of the few-ms wait that would make it succeed.

### 13. Credential injection via espn-league headers when auth is absent

**Severity: Low**
**Files:** `src/app/api/espn-league/[leagueId]/route.ts:46-55, 76-87`; `src/lib/nfl-data.ts:58-66`; `README.md:69`

The route accepts raw ESPN cookies via `x-espn-cookie`/`x-espn-s2`/`x-espn-swid` headers and persists them into the shared session store. **Failing scenario:** deployed without `AUTH_PASSWORD` (the README documents `AUTH_SECRET` falling back to it, `:69`): any visitor can inject their own — or a victim's stolen — ESPN credentials, which the background cycle then uses for all users. `CRON_SECRET` comparison is timing-safe (`cron/route.ts:17`) and `data/session.key` AES-256-GCM encryption is fine; `.gitignore:30` covers `/data`.

### 14. Prewarm double-warms and there is no way to disable the internal scheduler

**Severity: Low**
**Files:** `src/lib/prewarm.ts:2-3, 14-23`; `src/lib/nfl-data.ts:95-105`

`prewarm` both starts the scheduler (first cycle at +30 s) and immediately awaits the same functions (`prewarm.ts:14-23`). Mostly benign because the 3 h `computed_players_v3` TTL makes the +30 s cycle a cache hit — but the real gap is the missing `DISABLE_INTERNAL_SCHEDULER` env flag that would make the README's external-cron path non-overlapping (see bug 4).

---

## (b) EDGE CASES

1. **Three coexisting season-rollover conventions.** `espnSeasonYear` rolls in January (`espn.ts:141-143`), `scheduleSeason` in April (`schedule.ts:7-10`), `currentStatSeason` in September (`sleeper.ts:87-90`). April–August: the scoreboard serves 2026 preseason events while `statSeasons()` = [2025, 2024] — `getCurrentWeek` returns 0 for type-2 events and `restOfSeasonGames` uses a hard 18.
2. **`clearMemoryCache` is dead code** (`cache.ts:47-49`) — exported, zero callers. Also the mechanism a fix for bug 2 would want.
3. **Short titles break publisher stripping** — `news.ts:161`'s `separator > 20` guard means titles under ~23 chars containing " - " keep the publisher suffix in the matched title.
4. **Zero-total ESPN seasons dropped** — `espn.ts:398`'s `(stat.appliedTotal ?? 0) > 0` filter discards legitimate 0-point seasons (player on IR all year), so no ESPN season stat is shown for them.
5. **Fabricated game counts** — `extractEspnSeason` (`espn.ts:392-408`) derives `games = round(total/ppg)`, presenting a computed approximation as data.
6. **Sleeper team rows** — `sleeper.ts:145` filters `playerId !== "0"`; intended, noted for completeness.
7. **Header-injection defense present** — `espn-session.ts:89` strips `\r\n` from stored cookies before they're replayed in a `cookie` header. Good.
8. **Middleware matcher exemptions** (`middleware.ts:31-34`) — `api/auth`, `api/health`, `api/cron` are excluded from auth; `api/cron` is separately gated by `CRON_SECRET`. Correct as written.
9. **`espn-audit.ts:51`** — the conditional `ComputedPlayer | null` type resolves awkwardly but works; cosmetic only.
10. **2026 empty-season game log fallback works** — `getPlayerDetail` (`nfl-data.ts:480, 504`) falls back to 2025 aggregates via `agg.games > 0`, but the current-season log and posRank stay blank until real games land (expected given bug 1's mislabeling of the empty season).
11. **Corrupt cache files** are caught and treated as a miss (`cache.ts:34`) — fine; there is no stale-while-revalidate, a hard expiry always costs a full loader run.
12. **`computed_players_v3` TTL (3 h) vs cycle (2 h) beat** — cycles at 2 h and 4 h alternate between cache hits and recomputes; combined with bugs 2+3, each recompute is expensive and derived from frozen core data.

---

## (c) FEATURE IDEAS (ranked)

1. **Single-flight `getCached` + timeout on `sleeperFetch`.** Keep a per-key map of in-flight promises in `getCached` so concurrent misses share one loader; add `AbortSignal.timeout(20_000)`-style abort to `sleeperFetch` matching the ESPN/news/scoreboard clients. Fixes bugs 3 and 5, mitigates 2's outage mode. Smallest change, highest leverage.

2. **Refresh lock + `DISABLE_INTERNAL_SCHEDULER` flag.** A `refresh_log`-based lock (refuse to start when an unfinished row is younger than N minutes) plus an env flag that skips `startBackgroundRefresh`, making the README's external-cron guidance real and eliminating timer/cron/boot overlap. Also move `backgroundStarted` onto `globalThis` for HMR safety. Fixes bugs 4 and 14.

3. **Season-aware core data lifecycle.** (a) Skip current-season week fetches until `getCurrentWeek() >= 1` and cap the live-TTL fetch at `currentWeek + 1` weeks instead of all 18. (b) Distinguish fetch failure (rethrow, don't memoize) from true empty in `fetchSeasonWeekly`. (c) Age out `corePromise` (or reset it at the top of each successful refresh cycle) so a long-running process actually refreshes Sleeper data. Fixes bugs 1 and 2 — including the smoke failure, which then passes because 2026 weeks aren't fetched/checked until week 1 exists.

4. **News retention prune.** Add `DELETE FROM news_items WHERE first_seen < date('now', '-90 days')` to `executeRefreshCycle`, and widen `dedupeKeyFor` to sort words before slicing so syndicated variants collapse. Fixes bug 11.

5. **Explicit bye-week source.** Replace missing-week inference with a published bye grid (or the ESPN schedule API), refreshed weekly; fall back to inference only when the source is unavailable. Fixes bug 6's structural half; the cached-empty half is fixed by not caching failed loads.

6. **Upstream health: per-source failure counters with backoff.** Track consecutive failures per source (news feeds, Sleeper, ESPN scoreboard, ESPN league API), back off exponentially (circuit-break), and surface the counters on `/ops` so a dead pipeline is visible without digging into `feeds[].status`. Add 401-specific backoff for the ESPN session so an expired session stops re-failing every 2 h. Fixes bugs 8, 9.

---

*Review date: 2026-09-07 · Read-only review · Only artifact: this file.*
