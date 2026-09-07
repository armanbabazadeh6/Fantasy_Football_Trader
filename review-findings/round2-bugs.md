# Bug Hunt — Round 2 (2026-09-07)

All findings deduped against `review-findings/{data-pipeline,api-surface,frontend-ux,value-engine}.md` (read in full). Line anchors verified against current source this session. Severity reflects a single-user personal deployment.

---

## New Findings

### N1. [MED] ESPN session status silently resets to "untested" after any credentialed fetch with Set-Cookie rotation
**src/lib/espn.ts:284-299** + **src/lib/espn-session.ts:99-110**

In `espnFetchJson`, when ESPN rotates its cookie the response Set-Cookie is merged and saved via `saveEspnSessionCookie(merged)`. That upsert sets `status='untested'` **unconditionally** — even when the session was just proven working by the very request that triggered rotation. The health signal `recordEspnSessionResult(true)` only fires when `usedStoredSession` was true, so a caller-credentialed fetch (e.g. `/api/espn-league/[id]` with `x-espn-s2` headers, or the transactions route) that rotates the cookie downgrades the stored status.

**Scenario:** user pastes s2/swid on the league page, load succeeds (session demonstrably alive), ESPN rotates the cookie → the league page session badge flips from green "healthy" to amber "not tested yet"; the test prompt reappears for a session that is fine.

**Fix:** add a `preserveStatus` param (or only set `status` on INSERT, not UPDATE) for rotation saves in `saveEspnSessionCookie`.

### N2. [MED] Sleeper league import never captures rosterSlots — wrong lineup defaults + analyzer lineupImpact silently skipped
**src/app/api/league/[leagueId]/route.ts:88-97** → **src/app/league/page.tsx:262-284** → **src/app/api/lineup/route.ts:69**

The Sleeper route builds `LeagueResponse.league` without `rosterSlots` (only the ESPN path sets it). `selectTeamForAnalyzer` stores `rosterSlots: data?.league.rosterSlots` = undefined in `fft.league` localStorage. Consequences: (a) `/api/lineup` falls back to `DEFAULT_SLOTS` (QB1/RB2/WR2/TE1/FLEX1/K1/DEF1 — no 2QB/SF), so a 2QB or superflex Sleeper league benches its second QB and `projectedTotal` is wrong; (b) `/api/analyze` gets `rosterSlots: undefined` → null → the lineupImpact block never runs, so Sleeper users get no lineup-impact line in verdicts with no indication why.

**Scenario:** 2QB Sleeper league user opens `/lineup` → second QB benched, projected total understated ~15 ppg. Same user analyzes a QB-for-WR trade → no "Lineup impact" output at all.

**Fix:** derive slot counts from Sleeper `roster.starters` positions (modal starter configuration across rosters, ~15 lines in the league route) or Sleeper league settings, include in the league response; or store them in `fft.league` at select time.

### N3. [MED] parseRosterSlots rejects SUPERFLEX — SF/2QB ESPN leagues lose lineupImpact entirely
**src/app/api/analyze/route.ts:53-71** (`SLOT_POSITIONS` whitelist); same pattern in `/api/lineup`

`SLOT_POSITIONS` accepts QB/RB/WR/TE/FLEX/K/DEF only. Any key outside the whitelist makes `parseRosterSlots` return null and the **entire** slots map is discarded (all-or-nothing validation). A superflex slot surfaced as `SUPERFLEX` therefore kills lineupImpact silently.

**Scenario:** SF-league user selects their team on the ESPN league page → `rosterSlots` = `{QB:1, RB:2, WR:2, TE:1, SUPERFLEX:1, ...}` → analyze POST → parseRosterSlots → null → lineupImpact never computed. No error, no hint.

**Fix:** map SUPERFLEX→a QB-eligible flexible slot (or count it as an extra FLEX), and consider per-key leniency (drop unknown keys, keep known ones) instead of all-or-nothing rejection.

### N4. [LOW-MED] Weekly outlook can serve stale/misaligned ESPN weekly projections
**src/lib/projections.ts:152-164** (`getWeeklyProjection`) + **src/app/api/analyze/route.ts:152-167** + **src/app/api/lineup/route.ts:87**

`getWeeklyProjection(id, fromWeek)` returns the earliest row with `week >= fromWeek`, ignoring `fetched_at`. Sync only runs when the user visits `/league` (`syncProjections`), so if days pass without a visit the weekly rows are frozen at the last sync; the route labels them as the current week's outlook while news/injuries have moved on. Also compounds with the ≤0-week drop (confirmation 4): a filtered-out week makes the query skip to the *following* week's row while the response still labels it as the requested week.

**Scenario:** Week 5, last sync Tuesday of week 4. User analyzes a trade Wednesday — `week_outlook.projected_points` shows week-5 points frozen at week-4-Tuesday values; the `week`/`matchup` fields can even disagree with the row actually returned.

**Fix:** include `fetched_at` in the returned row; when older than ~24h fall back to the ESPN-season blend instead of the frozen weekly row (or surface a stale flag).

### N5. [LOW-MED] loadMore page arithmetic desyncs when list length isn't an exact page multiple
**src/components/players-table.tsx:100-115**

`loadMore` computes the next page as `Math.ceil(players.length / PAGE_SIZE)` instead of tracking an explicit page counter. Any divergence of `players.length` from `page * PAGE_SIZE` — short server page, a player appearing/disappearing between fetches (3h cache refresh mid-scroll re-ranks the list), duplicate suppressed — makes the computed page skip or repeat rows. Appending has no id-dedupe, so cross-page re-ranking can render the same player twice.

**Scenario:** user scrolls the full board while a cache refresh lands between page 3 and 4 fetches; player X (previously page 3) re-ranks into page 4's window → X appears twice; if the refresh shrank the total, a page is skipped.

**Fix:** track `page` in state (reset to 0 in the filter effect alongside `setPlayers`), increment on success; dedupe by id on append.

### N6. [LOW] `/api/players?ids=` has no count cap
**src/app/api/players/route.ts:12-25**

The `ids` param is used unbounded (watchlist panel and analyzer hydration both call it). Prior api-surface review mentioned it in passing under BUG-12's umbrella but it was never fixed.

**Scenario:** `GET /api/players?ids=` with 10k comma ids → multi-MB JSON + full in-memory scan, trivially repeatable.

**Fix:** `.slice(0, 50)` after split (analyzer hydration already caps at 15/side; watchlists are small).

### N7. [LOW] POST /api/analyses accepts unbounded arrays and strings
**src/app/api/analyses/route.ts:39-70**

Unlike `/api/analyze` (caps arrays at 30 via `toStringIds`), the save route validates presence but not length: give/get arrays and verdict/headline strings stored as-is. Auth-gated, so LOW.

**Scenario:** crafted POST with 10k-entry arrays and a 1MB headline → unbounded `saved_analyses` row growth; GET then ships 25 rows × that payload to every analyzer load.

**Fix:** cap arrays at 30, strings ~500 chars, numbers via `Number.isFinite`.

### N8. [LOW] ESPN transactions route: undated trades sort to top and can collide on React keys
**src/app/api/espn-league/[leagueId]/transactions/route.ts:86-89**

`transaction.date` non-number falls back to `new Date().toISOString()` (*now*) instead of unknown, so a trade with a missing/garbled date renders as the most recent. `id: transaction.id ?? Date.now()` — multiple undated trades in the same millisecond share a key.

**Scenario:** ESPN returns an old trade whose `date` is a string (format change) → it appears at the top of history as if just completed, misleading trade context.

**Fix:** fall back to epoch-0/null for date (sort last, render "date unknown"); `id: \`${transaction.id ?? index}\`` for the key.

### N9. [LOW] nextWeek overflows to 19 during week 18
**src/app/api/lineup/route.ts:82** + **src/app/api/analyze/route.ts:145-146**

`nextWeek = Math.max(1, currentWeek + 1)` — during week 18 (all games complete → currentWeek=18) nextWeek=19: matchups empty, weekly rows absent → every player shows "no matchup"/null projection and the lineup board degrades exactly during fantasy championship week. `restOfSeasonGames` clamps correctly; the weekly-outlook paths don't.

**Scenario:** week 18, user opens `/lineup` before finals conclude → all players project from season blend, matchup column empty.

**Fix:** `const nextWeek = Math.min(18, Math.max(1, currentWeek + 1))`.

### N10. [LOW] Boot prewarm never checks projectionsNeedSync
**src/lib/prewarm.ts:1-14**

Prewarm warms summaries, byes, and current week but not projections. The first credentialed `/league` load after boot pays the full ESPN league fetch inside `saveLeagueProjections` on the user's critical path. `projectionsNeedSync()` is a cheap SQLite query and both the stored league id and session cookie are already persisted.

**Scenario:** server restarts; user opens the app → first ESPN league load takes an extra 3-8s while sync runs inline via `syncProjections`.

**Fix:** in `runPrewarm`, if `projectionsNeedSync()` and a stored league id + session cookie exist, kick `saveLeagueProjections` fire-and-forget.

---

## Previously Reported — Still Present

1. **GET /api/analyses unguarded `JSON.parse`** — `src/app/api/analyses/route.ts:32-33` (api-surface BUG-9). One bad row 500s the saved-list endpoint.
2. **value-history `today()` uses UTC** — `src/lib/value-history.ts:3-5` (data-pipeline bug 7). US-evening refreshes write tomorrow's date; trends compare the wrong prior day.
3. **Injured (OUT/IR) players keep full projections in lineup** — `src/app/api/lineup/route.ts:87-91`: `weekly ?? blend ?? season ?? 0` with no injuryStatus zeroing (value-engine bug 4). Injury is displayed as a badge but never factored into points/eligibility.
4. **extractWeeklyProjections drops ≤0-point weeks** — `src/lib/projections.ts:38-41`. A projected-0.0 week is filtered out; `getWeeklyProjection` then skips to the following week and mislabels it (compounds with N4).
5. **Bye inference edge** — `src/lib/schedule.ts:104-116`: preseason guard was added, but a postponed/cancelled regular-season game still infers a phantom bye (absent team treated as bye).
6. **Export CSV unescaped cells** — `src/app/api/export/players/route.ts:13-18` (api-surface BUG-11): cells with commas/quotes/newlines unquoted; CSV columns break. Flag for quick confirmation during the fix pass.

---

## Quick wins / priority order

1. **N2 Sleeper rosterSlots** — highest user-facing value; fixes lineup correctness AND lineupImpact for the likely-primary Sleeper path (~15 lines).
2. **N1 session status preservation** — small param; removes recurring "untested" badge noise.
3. **N3 SUPERFLEX slot mapping** — one whitelist change; restores lineupImpact for SF leagues.
4. **N5 page counter + append dedupe** — cheap; removes the only known scroll-corruption path.
5. **N6/N7/N8 caps and fallbacks** — one-liners each.
6. Confirmations 1-4 are all small, well-understood fixes from prior waves — bundle them into the same pass.

*Review date: 2026-09-07 · Read-only review · No files modified.*
