# Frontend & UX Review — Fantasy Football Trader

Scope: static read-only review of `src/app/**` (all routes), `src/components/**` (all 25 components), `src/lib/{utils,watchlist,share-card,nfl-data}.ts`, `src/middleware.ts`, and public assets. Stack: Next.js 15 App Router, React 19, Tailwind 4, recharts (lazy-loaded). No source files were modified; no build/install was run.

Severity scale: **Critical** (data loss / broken core flow) · **High** (incorrect behavior or exclusion of users on a main flow) · **Medium** (incorrect behavior on an edge/secondary flow, or silent failure) · **Low** (polish / latent).

Previously fixed items (mobile nav drawer existence, contrast AA floor, tap targets, input labels, news pagination, lazy recharts, boot prewarm, league auto-connect; server-paged value board with infinite scroll is by design) are **not** re-reported; only residual defects beyond that scope are listed.

---

## (a) BUGS

### 1. Compare hydration can load the wrong players into each side — **High**
`src/app/compare/page.tsx:38-39` (with `src/app/api/players/route.ts:14-18`)

The page assigns API results by **position**, not by id:
```ts
if (aId && data.players[0]) setA(data.players[0]);
if (bId && data.players[1]) setB(data.players[1]);
```
But `GET /api/players?ids=a,b` filters the **globally value-sorted** summary list (`getPlayerSummaries()` output, sorted by value score in `nfl-data.ts:243-247`), so response order follows value rank, not the caller's `ids` order.

Failing scenario: open `/compare?a=<rank 40 WR>&b=<rank 5 RB>`. The API returns the RB first, so the WR lands on side B and the RB on side A — sides silently swapped relative to the URL. Secondary failure: a URL with only `?b=` set fetches `ids=[bId]`, and `data.players[1]` is `undefined`, so nothing loads at all. Fix: map by `p.id === aId` / `p.id === bId`.

### 2. Watchlist panel fully unmounts and remounts every 30 seconds — **High**
`src/components/watchlist-panel.tsx:30-31, 61, 68`

The 30 s poll's `load()` begins with `setPlayers(null); setWatched(false)` on **every** tick, and the render guard `if (!watched || !players) return null` (line 68) tears the whole section down until both fetches (`/api/watchlist` then `/api/players?ids=…`, sequential) resolve. The panel below the hero disappears and reappears every 30 s for any user with a watchlist — layout jump, lost hover/scroll position, and visible flicker on the home page. Fix: keep previous players while refetching (only clear on explicit un-watch), and skip the second fetch when the id list is unchanged.

### 3. `WatchStar` button rendered inside `<Link>` (button-in-anchor) — **High**
`src/components/players-table.tsx:301-302`, `src/components/watchlist-panel.tsx:104`

`<Link href={/player/…}>` wraps a `<button>` (`WatchStar`). Nested interactive elements are non-conforming HTML; the DOM auto-corrects unpredictably across browsers, screen readers may announce the star as part of the link (or not at all), and keyboard activation order is ambiguous. `preventDefault/stopPropagation` (watch-star.tsx:28-30) papers over the click but not the semantics. Fix: restructure the row so the star button is a sibling of the link (as `player-card.tsx` already does correctly via separate elements).

### 4. Players table: load-more page calculation and in-flight race can append wrong page — **Medium**
`src/components/players-table.tsx:106-121` (page calc at 112), filter-refetch effect at `65-88`

Two defects:
- `buildParams(Math.ceil(players.length / PAGE_SIZE))` derives the next page from **loaded row count**. Any state where `players.length` is not an exact multiple of `PAGE_SIZE` (a short page returned mid-stream, a filter reset that lands between render and observer fire) computes a page that skips or duplicates rows.
- `loadMore`'s guard `if (loading || !hasMore)` shares the `loading` flag set by the filter-refetch effect (line 71). If the sentinel fires while a filter/search refetch is in flight (or in the render gap before the observer callback is re-registered with the updated closure), the stale `loadMore` appends page N of the **old** filter set on top of the new filtered list.

Failing scenario: with the full board loaded several pages deep, type a search; during the debounced refetch the 400 px-early sentinel triggers `loadMore`, appending unfiltered players to the filtered result (duplicate rows, wrong "Showing X of Y"). Fix: track the current page in state, reset it in the filter effect, and key both fetches with a request seq that a late response must match.

### 5. Share-verdict card fails silently — **Medium**
`src/components/share-verdict-button.tsx:34-47`

On a null blob, clipboard rejection, or thrown exception, the button resets to idle with **no error state or message**. Failing scenario: Safari/Firefox without clipboard-write permission, or canvas tainted/blob failure — the user clicks "Share verdict", the button briefly spins, then nothing happens, with no explanation and no fallback path. Fix: surface an inline error and offer copy-text-of-verdict as the fallback.

### 6. Saved analyses: server save can fail invisibly, and saved list is localStorage-only — **Medium**
`src/app/analyzer/page.tsx:120-153` (fire-and-forget POST at 138-151; load path 57-65)

`saveAnalysis` writes localStorage (good) but `POST /api/analyses` failures are swallowed (`.catch(() => {})`), and the saved list is **never read back** from the server — the API's `GET /api/analyses` exists (`src/app/api/analyses/route.ts:19`) but is unused by the UI. Failing scenario: user saves a verdict, clears browser data or switches devices → all "saved" analyses gone even though a server copy was POSTed; conversely a permanently failing POST never surfaces, so the user believes the analysis is durably saved. Fix: load saved list from the API with localStorage as offline cache, and show a "saved locally only" state on POST failure.

### 7. Player detail page double-fetches the full detail pipeline per request — **Medium**
`src/app/player/[id]/page.tsx:24` (`generateMetadata`) and `:77` (`PlayerContent`)

Both call `getPlayerDetail(id)`, which (unlike `getPlayerSummaries`, which has a 5-minute in-process memo at `nfl-data.ts:198-221`) has **no request memoization** — each call awaits `computeAllPlayers()` + archived news + byes + core data + projections + matchups (`nfl-data.ts:460-507`). With `dynamic = "force-dynamic"` there is no fetch-level request dedupe for this work, so every player page request pays the pipeline twice (the 3 h `computed_players_v3` file cache softens but does not remove this — news matching, projection attachment, matchup fetch still run twice). Fix: wrap `getPlayerDetail` in `react cache` (or extend the existing global memo pattern) so metadata and page share one result.

### 8. News archive "load all" swallows failures — **Medium**
`src/components/news-browser.tsx:25-38`

`loadAll`'s catch is empty: if `GET /api/news/archive?limit=500` fails, the button re-enables with no message and the list stays at its initial page, indistinguishable from "archive has only this many items". Fix: set an error state and offer retry.

### 9. League auto-connect can use stale platform/credentials — **Medium**
`src/app/league/page.tsx:149-150` (ref assigned during render), consumed at `:162`

`loadLeagueRef.current` is captured from the first render's `loadLeague`, which closes over `platform`, `s2`, `swid`. The ESPN-session auto-connect path invokes it after an async `/api/espn-session` fetch resolves. Failing scenario: user loads the page on the Sleeper tab, switches platform to ESPN and pastes cookies while the session probe is in flight → auto-connect runs with `platform="sleeper"` (first-render closure) and connects the wrong platform or fails confusingly. Fix: keep the mutable inputs in refs (or pass them as arguments) rather than snapshotting the whole function.

### 10. Platform switch leaves stale trades data — **Low**
`src/app/league/page.tsx:187-221` (effect), reset gap: `setTrades(null)` only in `loadLeague` success (~:250)

Switching platform clears `data` but not `trades`. The trades tab is gated on `data`, masking it in practice, but any future tab reorder or refetch path can surface the previous platform's trade proposals. Low now, cheap to fix (reset `trades` alongside `data`).

### 11. `CountUp` freezes at its first animated value if `value` changes — **Low (latent)**
`src/components/count-up.tsx:14-39`

`started.current` is never reset and the IntersectionObserver is disconnected after first start (line 32), so once visible, a changed `value` prop re-runs the effect but neither observes nor animates — the display stays at the old number until remount. Currently latent (home-page stats are static per render), but any live-refresh use of `CountUp` will show stale counts. Fix: on `value` change with `started.current === true`, animate from current display to the new value without an observer.

### 12. Unguarded timers fire after unmount — **Low**
`src/app/analyzer/page.tsx:110-112` (150 ms `scrollIntoView` after analysis), `src/app/league/page.tsx:344` (`setTimeout(() => setCopiedProposal(null), 2500)`)

Navigating away inside the window triggers DOM/state updates on an unmounted tree. Harmless today (React 18+ no longer warns) but these are the classic seeds of future "setState on unmounted" logic bugs; clear timers in effect cleanup or guard via ref.

### 13. Lineup board fetch is not cancellable — **Low**
`src/components/lineup-board.tsx:61-87`

Single mount effect, no `cancelled` flag: a slow `/api/lineup` response landing after route change still sets state. Same class as #12; one flag fixes it.

---

## (b) Accessibility & UX gaps

### A11y

- **A1 — Verdict result is never announced to screen readers (High).** `src/app/analyzer/page.tsx:327-329` / `VerdictBanner` `643-668`: the verdict banner, AI summary, and value ledger render with no `aria-live` region and no focus management. A screen-reader user clicks "Analyze Trade" and hears nothing until they manually navigate. Wrap the banner in `role="status"` / `aria-live="polite"` (or move focus to `#results` after load, which would also replace the fragile `scrollIntoView` timer at 110-112).
- **A2 — Mobile drawer: no focus trap, focus not moved in, collapsed links stay tab-reachable (High).** `src/components/site-header.tsx:137-181`: the drawer is hidden with `max-h-0 overflow-hidden` only — visually gone but still in the tab order and readable by assistive tech; on open, focus stays behind the drawer; Escape closes (36-38) but focus is not returned to the menu button; no `role="dialog"`/`aria-modal`. Keyboard users can tab into invisible content and get lost behind the overlay.
- **A3 — Player search combobox has no combobox semantics (High).** `src/components/player-search.tsx:110-165`: results popup lacks `role="listbox"`, options lack `role="option"`, the input lacks `role="combobox"`/`aria-expanded`/`aria-controls`/`aria-activedescendant`. Arrow/Enter handling exists (70-89) but the highlight is visual-only — screen readers can't perceive the selected suggestion. Same pattern is reused on the analyzer and compare pages, so fixing the component fixes all three.
- **A4 — League standings rows are mouse-only (High).** `src/app/league/page.tsx:620-627`: team rows are clickable via `onClick` on `<tr>` with `cursor-pointer` — no `tabIndex`, no `role="button"`, no Enter/Space handling, and expanded rows have no `aria-expanded`. Keyboard and SR users cannot open a team's roster/lineup card at all.
- **A5 — Sortable tables don't expose sort state (Medium).** `src/components/players-table.tsx:207-234` headers + `SortButton:391-420`: no `aria-sort` on `<th>`, so SR users can't tell which column is sorted or in which direction; the direction is conveyed only by a rotated chevron. Position filter buttons (180-194) lack `aria-pressed`.
- **A6 — Nested interactive elements** — see Bug #3 (players table, watchlist panel).
- **A7 — News ticker: animated focusable links, no SR story (Medium).** `src/components/news-ticker.tsx:16,29`: content is duplicated for the seamless loop (fine) but the moving track is not `aria-hidden` for the duplicate, links inside a continuously animated container are hard or impossible to activate for motor-impaired users, and there is no pause control or static alternative listing. The `prefers-reduced-motion` kill-switch in `globals.css:330-337` is respected (good) — the gap is the keyboard/SR experience while it runs.
- **A8 — Analyzer error not announced (Medium).** `src/app/analyzer/page.tsx:315-318`: the analysis-failure paragraph has no `role="alert"`, so a failed analyze is silent for SR users. (`login-form.tsx:66-70` gets this right with `role="alert"` — reuse that pattern; additionally link the error to the input via `aria-describedby` there.)
- **A9 — Table semantics/density (Low).** No `<caption>` or `scope="col"` on the players/standings/compare/lineup tables; abbreviated headers ("Gms", "Rank", "Proj", "Boom%") have no expansion. Add visually-hidden captions and `abbr`/`title` on cryptic headers.
- **A10 — Compare chart line identity is color-plus-legend-prose only (Low).** `src/components/compare-chart.tsx:33-34`: volt vs rose lines with names only in a legend sentence (`compare/page.tsx:227`). For deuteranopia the two greens/reds blur; consider per-series markers (already `dot` — differentiate shape) and direct labeling.

### UX workflow gaps

- **U1 — Share failure has no fallback** (Bug #5): add "copy verdict as text" secondary path.
- **U2 — Compare state is not shareable after load.** `src/app/compare/page.tsx:27-44` reads `?a=&b=` once on mount but never writes the URL back; there is also no swap-sides button and no way to clear one side except overwriting via search. Users who build a comparison cannot link it to a league-mate.
- **U3 — Lineup page has no retry or refresh.** `src/components/lineup-board.tsx:61-87`: fetch once on mount; the error state shows text but no action; there's also no week selector. A transient API hiccup bricks the page until full reload.
- **U4 — Trades tab disabled for Sleeper with no explanation.** `src/app/league/page.tsx:553-558`: ESPN-only feature shows a plain disabled control; users don't know why or what would enable it. Related fragility: success detection for the credential test is string matching `.includes("alive")` (~:442).
- **U5 — "12-Team PPR" chip is hardcoded and can be wrong.** `src/app/analyzer/page.tsx:177-179`, `src/components/site-header.tsx:112-114` and `:167-169`, and baked into every share card (`src/lib/share-card.ts:124`). The league context feature proves real leagues vary (Sleeper/ESPN, other formats); a connected user in a 10-team half-PPR league is shown — and *shares* — a false claim.
- **U6 — No route-level error/not-found/loading boundaries.** `src/app/` contains no `error.tsx`, `not-found.tsx`, or `loading.tsx` (only per-component Suspense on player detail). An unexpected server error yields the default Next crash page; deep-links to deleted players rely on `notFound()` without a branded boundary.
- **U7 — Server-rendered relative timestamps freeze at request time.** `relativeTime()` (`src/lib/utils.ts:17-29`) runs during SSR in server components (`news-card.tsx:38`, `news-ticker.tsx:29`, watchlist links). With `force-dynamic` pages this is request-time fresh, but any move to caching/ISR (see U9) makes "2h ago" stale by cache age; and client components showing it (analyzer saved list, league session) never tick. A tiny client `<TimeAgo>` for long-lived views would fix both.
- **U8 — `/favicon.ico` 404s.** `middleware.ts:33` excludes `favicon.ico` from auth expecting it to exist, but `public/` contains only `banner.svg` (the app icon is `src/app/icon.svg`, which covers modern browsers). Legacy agents requesting `/favicon.ico` get a 404 (or, worse, the redirect when auth is on, since the matcher exclusion is what keeps it clean). Drop a generated `.ico` in `public/`.
- **U9 — Every route is `force-dynamic`.** All pages opt out of caching; players/lineup/waiver/news are prime ISR or stale-while-revalidate candidates (data already changes on a scheduler cadence — see the ops page). This is the single biggest TTFB lever and is also what makes U7 matter. Low severity today (single-user), High leverage at scale.
- **U10 — SEO surface is underbuilt.** Root `layout.tsx:18-25` has a title template and description (good); `player/[id]` has dynamic titles via `generateMetadata` but no description despite being the organic-search surface (real player names + values); `compare`, `analyzer`, `league`, `waiver` export no metadata at all. No `opengraph-image`/twitter card anywhere (share-card SVG builder already exists and could be adapted), no `robots.txt`/`sitemap.ts`. Add per-route descriptions and a sitemap of player pages.

---

## (c) FEATURE IDEAS (ranked by user value)

1. **Persistent, shareable trade sessions.** The analyzer's in-progress deal lives only in component state — a refresh or accidental Reset (analyzer/page.tsx:84-89) destroys it. Persist both sides to localStorage/URL (`/analyzer?give=…&get=…`), add a one-click **swap sides** toggle (negotiating the counterparty's perspective is the most common re-entry), and an **undo last add/remove**. Directly addresses the highest-value workflow in the product; small surface area (state already centralized in `AnalyzerPage`).
2. **Watchlist value alerts.** The panel already polls every 30 s and the data model already carries `valueTrend`, snapshots (`valueHistory`), and a `fft.lastVisit` timestamp (watchlist-panel.tsx:22, new-badge logic). Surface a delta badge ("▲ 4 since your last visit") and an optional notification when a watched player moves more than N points — turns the passive list into the retention hook the product wants. Highest value-to-effort ratio in the codebase.
3. **Shareable comparison links + swap.** Extend the existing `?a=&b=` hydration (compare/page.tsx:27-44) to write state back on selection, add a swap button, and fix Bug #1 while in there. Trades get argued in group chats; a link is the argument.
4. **League-aware waiver targets.** `waiver-board.tsx` already computes positional needs (`25-43`) and the league page knows the user's roster. Merge them into a ranked "add targets for your roster" rail on the waiver page (need × value × trend), making the waiver page actionable rather than a generic list.
5. **Player page → analyzer deep link.** Every player page (`player/[id]`) should have "Add to trade" CTAs (send/receive) that push onto the analyzer's persisted session from idea 1. Today the user must re-search the player manually in the analyzer — the funnel between the two biggest pages is broken by default.
6. **Per-route SEO/OG package.** Descriptions per route, `opengraph-image` for player pages (the `buildCardSvg` machinery in `src/lib/share-card.ts` is 80% of an OG renderer), `sitemap.ts` over players, plus `favicon.ico` and `robots.txt` (U8/U10). Compounding traffic value for near-zero runtime cost.
