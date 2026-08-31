# Ticket 004: News intelligence - archive, dedup, classification, new-since-visit

**Priority:** High
**Depends on:** Nothing (SQLite layer exists)
**Status:** Complete (news_items table with category/dedupe indexes, cross-outlet dedupe on first-6-significant-words, 6-way classifier, /api/news/archive with q/category/since/limit, category chips, NEW badges via fft.lastVisit, watchlist N-new counts, player detail reads archive; ~292 items ingested, 8 dupes skipped, smoke + build pass)

## Goal

News is currently a 300-item cache that evaporates every 8 minutes. Turn it into a persistent research layer: every item archived on first sight, duplicate stories collapsed across outlets, each item classified, and watched players showing what changed since the user's last visit.

## Tasks

- [ ] SQLite schema: `news_items (id TEXT PRIMARY KEY, title, link, source, published_at, first_seen, summary, category TEXT)` plus `news_seen (player_id, last_seen)` if needed for per-player tracking. Add index on `published_at` and `category`.
- [ ] Ingestion in the background refresh cycle: pull `fetchNews()`, dedupe against archive. Cross-outlet duplicate detection: normalize titles (lowercase, strip punctuation, first 8 significant words) and compare against items from the last 72 hours; prefer the earliest-published source, link the others as alternates (optional `duplicate_of` column).
- [ ] Rule-based classifier, single module with a keyword table:
  - injury: knee, ankle, hamstring, IR, out, questionable, doubtful, surgery, practice report
  - depth: depth chart, named starter, will start, bench(ed)
  - transaction: traded, trade, sign(ed), release(d), waived, claim
  - suspension: suspend(ed), PED, arrest
  - performance: breakout, sleeper, riser, bust, stud
  - fallback: general
- [ ] `GET /api/news/archive?q=&category=&since=&limit=` reading from SQLite; keep the existing live route for fallback.
- [ ] News page: category filter chips powered by the archive; keep source filters.
- [ ] "NEW" badges: store `fft.lastVisit` in localStorage on page load; watchlist panel and player pages badge items with `first_seen > lastVisit` and show a count.
- [ ] Player detail news section reads from the archive so older context survives beyond the 8-minute cache.
- [ ] Backfill script: one-time import of the current live cache into the archive so day one is not empty.
- [ ] Smoke tests: classifier (one sample title per category), dedupe key normalization, archive roundtrip.

## Acceptance criteria

- Refreshing the news cache no longer loses history; the archive grows monotonically
- The same injury story from ESPN, CBS, and Yahoo appears once
- Every archived item carries a category
- Watchlist panel shows "N new" for items since the last visit
- `npm run build` and `npm run smoke` pass
