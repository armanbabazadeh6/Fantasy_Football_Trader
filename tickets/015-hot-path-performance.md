# Ticket 015: Hot path performance - summary memo and daily-write gate

**Priority:** High
**Depends on:** Nothing
**Status:** Complete (globalThis memo with 5-minute TTL + failure-safe rejection handling + background-cycle invalidation; recordDailyScores gated to once per process-day, eliminating ~3,000 SQLite writes per request. Production-server measurements: board API p95 90ms (was 125-520ms with variance), home 460ms, player detail 345ms, waiver 165ms. Note: dev numbers stay slower by design, and dev wipes the production build since both share .next)

## Findings (2026-08-31 baseline, warm dev server)

- Home: ~1.3s. Board API: 125-520ms with high variance. Player detail: ~1.2s.
- `getPlayerSummaries` runs on every board, waiver, player search, and export
  request, and each run executes `recordDailyScores`: roughly 3,000 SQLite
  INSERT OR IGNORE statements per request, all no-ops after the first call of
  the day. It then re-sorts 3,025 players and recomputes trend deltas from the
  same unchanged inputs.
- The work is deterministic between background refreshes; nothing changes
  between requests except wasted CPU and disk churn.

## Tasks

- [ ] Memoize `getPlayerSummaries` in-process on globalThis (survives dev HMR
  module swaps like the db handle does) with a 5 minute TTL, and expose
  `invalidatePlayerSummaries()` for the background cycle to call when a fresh
  compute lands.
- [ ] Gate `recordDailyScores` to once per process per calendar day; later
  calls in the same day return the recorded count without touching SQLite.
- [ ] Background refresh cycle invalidates the summary memo after it finishes
  so new data surfaces immediately at the next request.
- [ ] Re-measure home, board API, player detail, and waiver after the change.

## Acceptance criteria

- Board API p95 under 100ms warm, home under 600ms warm
- SQLite no longer performs 3,000 writes per page view
- Fresh data still appears within one request after a background refresh
- `npm run build` and `npm run smoke` pass
