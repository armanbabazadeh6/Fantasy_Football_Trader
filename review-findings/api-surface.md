# API Surface Review — Fantasy Football Trader

Scope: all 19 `route.ts` under `src/app/api/` (analyze, analyses, auth/login, compare, cron, espn-league/[leagueId], espn-league/[leagueId]/transactions, espn-session, export/players, health, league/[leagueId], lineup, news, news/archive, ops/health, players, projections/sync, trending, watchlist) plus `src/lib/{rate-limit,session,db,watchlist,name-match}.ts`. Supporting libs (`espn.ts`, `espn-session.ts`, `nfl-data.ts`, `news-archive.ts`, `projections.ts`, `ops.ts`, `league-intel.ts`, `middleware.ts`) read for call-graph verification. Static review only.

Route-count note: the task brief lists `news/players` and `news/trending` routes; neither exists in this tree (glob confirms 19 files; player news filtering is client-side and player-trending lives at `/api/trending`). Everything else matched.

---

## (a) BUGS

### BUG-1 — ESPN league cache serves one user's private-league data to everyone (HIGH)
`src/app/api/espn-league/[leagueId]/route.ts:35-44, 98`
The in-memory cache is keyed by `leagueId` only, but the payload depends on which credentials produced it. Failing scenario: user A loads private league `12345` with valid `espn_s2`/`SWID` headers → success payload cached at line 98. Within the 60 s TTL, user B requests the same leagueId with **no** credentials; line 41-43 returns A's cached payload — private rosters, team names, unmatched player list — bypassing the private-league cookie gate entirely. The cache lookup (line 41) happens before credentials are even read (line 46). Fix: key the cache on `leagueId + hash(creds|none)` or only cache when no client credentials were supplied, and never cache credentialed private responses.

### BUG-2 — Any user can overwrite/clear the shared server-side ESPN session (HIGH)
`src/app/api/espn-league/[leagueId]/route.ts:76-87`; `src/app/api/espn-session/route.ts:15-18`; `src/app/api/espn-league/[leagueId]/route.ts:88`
`saveEspnSessionCookie()` writes the client-supplied `x-espn-cookie`/`x-espn-s2`/`x-espn-swid` into the single global `espn_session` row (encrypted, but one slot for the whole deployment), and `rememberEspnLeagueId()` (line 88) repoints the remembered league on every successful load. `DELETE /api/espn-session` wipes it. Failing scenario: in any multi-user deployment, user B submits their own (or garbage) cookie header → the owner's stored credential is replaced; the background refresh cycle (`nfl-data.ts:59-64`) and `espn-session` health checks then use B's cookie and B's league. Same single-tenant assumption for `/api/watchlist` and `/api/analyses` (no ownership column) — acceptable only while the app is strictly single-user; the ESPN session is the one piece of *credential* state being clobbered.

### BUG-3 — `rosterSlots` values never validated → CPU/memory DoS on /api/analyze and /api/lineup (MEDIUM)
`src/app/api/analyze/route.ts:65-68, 99`; `src/app/api/lineup/route.ts:37-40`; consumed at `src/lib/league-intel.ts:144-165`
Both routes cast `body.rosterSlots as Record<string, number>` with zero validation (keys or values). `optimalLineup` loops `for (let i = 0; i < count; i++)` and pushes a starter per iteration, scanning the pool each time. Failing scenario: `POST /api/lineup` with `{"players":["nfl/123"],"rosterSlots":{"QB":1e9}}` → ~1e9 iterations × pool scan → minutes of CPU and an array of 1e9 slot objects → OOM/hang per request. Non-number values (`"2"`, `null`) coerce or silently misbehave (`i < null` is false → slot count ignored; `Infinity` hangs forever). `analyze` additionally does not compare against a default; `lineup` falls back to `DEFAULT_SLOTS` only when the key is absent. Fix: validate values are safe integers 0..20 and keys ⊆ {QB,RB,WR,TE,FLEX,K,DEF}.

### BUG-4 — /api/analyze accepts unbounded, non-string player id arrays (MEDIUM)
`src/app/api/analyze/route.ts:56-64, 77-83`
Unlike `lineup` (`.slice(0, 40)` at `lineup/route.ts:28`), `analyze` has no cap on `give`/`get`/`myRoster`. Each `getPlayerBundles(ids)` call fans into `computeAllPlayers()` + `fetchNews()` + `fetchTeamByeWeeks()` and iterates every id (`nfl-data.ts:392`). Failing scenario: `POST /api/analyze` with 50,000 ids → unbounded loop and a response containing every matched bundle; repeated requests are a cheap DoS on a `maxDuration = 120` route. Non-string entries (`[123, {}]`) pass `Array.isArray` and the `as string[]` cast — they silently miss in `computed.get(id)` (no crash, but the API contract is a lie: TS says `string[]`, runtime accepts anything). Same gap in `analyses/route.ts:55-60` (arrays unvalidated/uncapped, `verdict`/`headline` uncapped strings — DB bloat vector).

### BUG-5 — Login rate limiter trusts client-controlled `x-forwarded-for` (MEDIUM)
`src/app/api/auth/login/route.ts:28-37`
The brute-force limiter (5/min) keys on `x-forwarded-for` first value, then `x-real-ip`, then `"local"` — both headers are trivially spoofable when the app is not behind a proxy that overwrites them (and even behind one, a proxy that appends rather than replaces keeps the spoof alive as element [0]). Failing scenario: `curl -H "x-forwarded-for: 1.2.3.N" POST /api/auth/login` with N=1,2,3… → a fresh bucket per attempt → unlimited password brute force at line speed; the 429 at line 33 never fires. Also note only `/api/auth/login` is rate-limited — heavy routes (`/api/analyze`, `/api/espn-league/...`, `/api/export/players`) have nothing.

### BUG-6 — Rate limiter Map never evicts → unbounded memory keyed by spoofable input (MEDIUM)
`src/lib/rate-limit.ts:9-24`
`attempts` stores a `number[]` per key and filters timestamps on each hit, but keys are never deleted when their window empties. Failing scenario: the spoofed-IP loop from BUG-5 (or just many NAT'd clients over days) grows the Map monotonically; each key also keeps up to `max` timestamps. Slow memory leak / cheap amplification of BUG-5. Fix: delete the key when `recent` is empty, or use an LRU.

### BUG-7 — Cross-user league-test can poison ESPN session status (LOW-MEDIUM)
`src/app/api/espn-session/route.ts:23, 41-53`
`POST /api/espn-session` prefers `?leagueId=` over the stored one, fetches with empty creds (falling back to the stored cookie inside `espnFetchJson`), and on a "private" error calls `recordEspnSessionResult(false)` (line 52) — marking the globally stored session **expired**. Failing scenario: session is healthy for remembered league A; any user calls `POST /api/espn-session?leagueId=999999999` (a random private league) → stored session flagged expired → UI prompts the owner to re-paste a perfectly valid cookie. The health signal conflates "cookie invalid" with "this league needs a cookie you don't have".

### BUG-8 — 404 catch-all masks real failures on /api/league/[leagueId] (LOW)
`src/app/api/league/[leagueId]/route.ts:90-95`
The single `catch` returns 404 "League not found" for *every* error — including better-sqlite3 disk failures, Sleeper 5xx, DNS timeouts, or `computeAllPlayers()` shape errors. Failing scenario: Sleeper API outage → client repeatedly tells the user their (valid) league ID is wrong. Same pattern direction in `espn-league` (502 for everything, including local data-shape errors like "ESPN returned no teams", `espn.ts:274`) and `espn-session` (500 vs 502 decided solely by whether the message contains "private", `route.ts:50`).

### BUG-9 — `analyses` GET: one corrupt row 500s the whole list (LOW)
`src/app/api/analyses/route.ts:22-38`
`JSON.parse(row.give_json)` / `JSON.parse(row.get_json)` (lines 32-33) run inside `rows.map` with no per-row guard. Any row written by an older schema, truncated by disk-full, or hand-edited throws → outer catch → 500, so 24 good analyses are undeliverable because row 25 is bad. Wrap per row and skip/filter.

### BUG-10 — cron route has no try/catch; DB failure produces default 500 (LOW)
`src/app/api/cron/route.ts:8-30`
Every other route returns the `{ok:false,error}` envelope; `cron` doesn't wrap `getDb()`/`.get()` (lines 24-28). If the prepared statement throws (locked DB, missing `data/` perms), Next's default 500 HTML comes back instead of the JSON envelope — a monitoring/cron caller parsing JSON breaks. Also `startRefreshCycle()` uses `void executeRefreshCycle(logId)` (`nfl-data.ts:86`); the internal try/catch covers the cycle, but the failure-path `UPDATE refresh_log` inside the catch (`nfl-data.ts:75-79`) can itself throw → floating unhandled rejection. Attach a `.catch()` and log.

### BUG-11 — CSV: unescaped cells and no formula neutralization (see also SEC-5) (LOW — structural half)
`src/app/api/export/players/route.ts:10-27`
Only `name` and `tier` cells are quote-wrapped/escaped (lines 13, 18). `position`, `team`, `injuryStatus` are upstream-controlled and written raw — a value containing a comma or quote (ESPN/Sleeper injury blurbs occasionally do) shifts every subsequent column and corrupts the file. `join(",")`/`join("\n")` also leaves a missing trailing newline and no `Cache-Control`. The security half (formula injection) is SEC-5.

### BUG-12 — zod-less validation drift is now observable per-route (LOW, maintenance)
No schema library anywhere (`package.json` has none). The same concepts are re-implemented differently on every route: leagueId regex duplicated 5× (`league/[leagueId]/route.ts:18`, `espn-league/[leagueId]/route.ts:28`, `transactions/route.ts:100`, `espn-session/route.ts:24`, `projections/sync/route.ts:11`); limit clamps differ (`news:1-200`, `players:1-100`, archive clamped only inside the lib at `news-archive.ts:152`, `players?ids` unbounded); array caps exist only in `lineup`; type-checks via `as` casts only. Every finding above is a symptom of this drift. See FEATURE-1.

### BUG-13 — name-match substring matching yields false-positive news attribution (LOW)
`src/lib/name-match.ts:9-14`
`haystack.includes(player)` after normalization has no token boundaries. `"ty hilton"` matches a headline containing `" fifty hilton"`-style collisions (real case: `"davis mills"` ⊂ any headline containing `"davis millsap"`; `"ty johnson"` inside `"monty johnson"`). `normalizeForMatch` strips punctuation but keeps spacing, so `includes` still spans spaces. This silently attaches wrong news to player bundles served by `/api/analyze` and `/api/lineup` via `matchNewsForPlayer` (`nfl-data.ts:398`). Compare on word-boundary token sequences instead of raw substring.

---

## (b) SECURITY FINDINGS

### SEC-1 (INFO — verified clean) — SQL injection: NOT present
`src/lib/db.ts` (all statements) and `src/lib/news-archive.ts:137-158`: every query uses `db.prepare(...)` with `?` placeholders, including the dynamically-assembled WHERE in `getArchivedNews` — the SQL string is built exclusively from hardcoded fragments (`"(title LIKE ? OR summary LIKE ?)"`, `"category = ?"`, `"first_seen > ?"`) with user values only in `params`. `LIMIT ?` uses a clamped integer parameter. No string concatenation of user input into SQL anywhere in the reviewed surface. (Minor: `%`/`_` inside `q` act as LIKE wildcards — a `?q=%` matches everything; not injection, just filter bypass.)

### SEC-2 (INFO — verified clean) — SSRF in ESPN league fetch: closed, with one defense-in-depth nit
All four league-id entry points enforce `/^\d{4,12}$/` before any fetch (`espn-league/[leagueId]/route.ts:28`, `transactions/route.ts:100`, `espn-session/route.ts:24`, `projections/sync/route.ts:11`), and the URL is assembled only as `${ESPN_FFL_BASE}/seasons/${season}/segments/0/leagues/${leagueId}?view=...` (`espn.ts:206`) — digits-only user input into a fixed host, so no host/path/query injection is possible. Cookie values only ever reach the `Cookie` header. Nit: the `rawCookie` path strips `\r\n` (`espn.ts:162-167`) but the `s2`/`swid` path (`espn.ts:173-176`) does not — currently safe only because Node's HTTP layer rejects CRLF in incoming header values; if those values ever arrive via a JSON body (as `projections/sync` body-evolution might do), that becomes header injection. Strip newlines in both paths.

### SEC-3 (MEDIUM) — `err.message` echoed to clients on 5 routes, incl. filesystem paths
- `src/app/api/ops/health/route.ts:10-17` — `getOpsReport()` does `fs` scans of the `data/` cache dir; an `ENOENT`/`EACCES` error message embeds the **absolute server path** (`C:\...\data\cache\...`). Auth-gated but still internal-structure disclosure.
- `src/app/api/espn-league/[leagueId]/route.ts:100-104` and `.../transactions/route.ts:150-154` — raw `err.message` from any fetch/network/parse failure (undici errors include host info: `fetch failed`, DNS names).
- `src/app/api/projections/sync/route.ts:26-29` and `src/app/api/espn-session/route.ts:54-64` — same pattern.
Fix: map errors to a small public enum server-side; log the detail with a request id.

### SEC-4 (MEDIUM) — Session tokens are deterministic, shared, and unrevocable; AUTH_SECRET falls back to the password
`src/lib/session.ts:39-58, 60-62`
1. `createSessionToken` = `${expires}.${HMAC(secret, "fft:"+expires)}` — no randomness, no identity. Every login in the same millisecond yields identical tokens; there is no session id, so "log out" is purely client-side cookie deletion and a leaked token stays valid for the full 30-day TTL (`SESSION_TTL_SECONDS`, line 2). No revocation list exists.
2. `authSecret()` falls back to `AUTH_PASSWORD` when `AUTH_SECRET` is unset. A captured token (`expires` + HMAC) then permits **offline dictionary attacks against the password** — an attacker computes `HMAC(guess, "fft:"+expires)` per candidate without touching the server. Require a generated `AUTH_SECRET` when `AUTH_PASSWORD` is set (fail closed at boot), and embed a random session id + issue time in the signed payload.
Mitigations already present and correct: HMAC-SHA256, hex signature shape check before compare (line 55), `httpOnly`/`sameSite:lax`/`secure-in-prod` cookie flags (`auth/login/route.ts:52-58`), expiry checked server-side.

### SEC-5 (MEDIUM) — CSV formula injection in /api/export/players
`src/app/api/export/players/route.ts:10-27`
Cells are sourced from upstream Sleeper/ESPN data (`player.name`, `injuryStatus`, `team`). Excel/Sheets interprets a leading `=`, `+`, `-`, or `@` as a formula; a poisoned or compromised upstream feed (or a league-influenced nickname) becomes `=WEBSERVICE(...)`/`=HYPERLINK(...)` executed on the analyst's machine. Quote-escaping does not neutralize this. Fix: prefix dangerous leading chars with `'` (or a tab) for every cell, not just `name`.

### SEC-6 (MEDIUM — pairs with BUG-1/BUG-2) — Middleware auth boundary: what is public vs gated
`src/middleware.ts:31-34` excludes `login`, `api/health`, `api/cron`, `api/auth*` (prefix match, so `api/healthz` would also be skipped — harmless today). Verified consistent: `/api/ops/health`, `/api/analyses`, `/api/watchlist`, `/api/export/players` are all gated when `AUTH_PASSWORD` is set; `/api/health` (public by design) exposes only uptime + last refresh row (`health/route.ts:13-23`) — acceptable, though `ok:true` is returned even when `lastRefresh.ok === 0`, so it is a liveness, not health, check; `/api/cron` is public but double-gated by constant-time `CRON_SECRET` (501 when unset — fail closed, correct). The real boundary problem is state, not routes: the ESPN credential store and league cache (BUG-1/BUG-2) are shared across all authenticated users.

### SEC-7 (LOW) — `timingSafeEqual` early-exits on length mismatch
`src/lib/session.ts:28-37`
The length check (line 29) returns before the comparison loop, leaking `AUTH_PASSWORD`/`CRON_SECRET` **length** via response timing. The loop itself is constant-time for equal lengths. Standard fix: hash both sides (e.g. SHA-256) then compare digests, keeping the function constant-time end-to-end. Practical impact is small; it is a named weakness in an explicitly security-oriented helper.

### SEC-8 (INFO) — Positive findings worth keeping
- All league/cookie headers are read but never reflected into HTML/JSON verbatim; `espn-session` state exposes only status/timestamps, never the cookie (`espn-session.ts:133-163`); the cookie is AES-256-GCM encrypted at rest with a 0600 key file (`espn-session.ts:39-66`).
- `/api/auth/login` fails closed on absent password (501), swallows JSON parse errors into 401, and the login page validates `next` against `//`-prefixed open redirects (`login/page.tsx:21-23`).
- `analyses` DELETE and `watchlist` PUT parameterize every user value.
- `watchlist.ts` (client lib) is localStorage-only, nothing security-relevant.

---

## (c) FEATURE IDEAS (ranked)

1. **Central request validation layer (zod or equivalent) + shared param schemas.** One `schemas/` module: `leagueId`, `playerIds(max)`, `rosterSlots` (safe-int 0..20, key whitelist), `limit` (unified 1..N), POST bodies for analyze/lineup/analyses. Directly kills BUG-3/4/12 and half of SEC-3's variance; makes the API contract match the TypeScript types it claims.
2. **Per-user session identity + revocation, mandatory AUTH_SECRET.** Random session id inside the signed token, server-side issued-at (enables "log out everywhere"), boot-time hard failure when `AUTH_PASSWORD` is set without a strong `AUTH_SECRET`, and hash-then-compare in `timingSafeEqual` (SEC-4/SEC-7). Also unblocks multi-user ownership for watchlist/analyses/ESPN-session (BUG-2).
3. **Scoped cache keys + private-response no-cache for the ESPN proxy.** Key `espn-league` cache by credential identity (or skip caching credentialed fetches), scope the stored ESPN cookie per user, and stop letting `rememberEspnLeagueId`/`espn-session` tests mutate global state from arbitrary league ids (BUG-1/2/7). This converts the ESPN surface from "shared singleton credential" to a real per-session proxy.
4. **Generalized rate limiting with trustworthy client IP + bounded memory.** Resolve the client IP once (honoring a `TRUST_PROXY` setting; rightmost-untrusted-hop strategy instead of `split(",")[0]`), apply the existing limiter to `/api/analyze`, `/api/lineup`, `/api/espn-league/*`, and `/api/export/players`, and add key eviction to `rate-limit.ts` (BUG-5/6).
5. **Uniform error envelope + correct status taxonomy.** `{ ok:false, error: code, requestId }` everywhere; 404 only for confirmed upstream "not found", 502 for upstream failures, 500 for local faults, 401/403 for credential problems (today `espn-league` returns 502 for private leagues and `league/[id]` returns 404 for outages — BUG-8, SEC-3). Log `err.message` server-side only.
6. **Response caching headers on hot GETs.** `/api/players`, `/api/trending`, `/api/news*` recompute filters over the full list every hit; short `Cache-Control: private, max-age=30` (or `s-maxage` + ETag when behind a CDN) plus `no-store` on `/api/export/players` would cut repeat load and fix the missing-header gap noted in BUG-11.
