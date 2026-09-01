# Ticket 018: Home page data diet

**Priority:** Medium
**Depends on:** Nothing
**Status:** Complete (ticker fetch limit 20, player count from the memoized summaries. Measured: warm home ~320-370ms was 435ms)

## Findings (2026-08-31 production baseline)

- The home page calls `getArchivedNews({ limit: 300 })` to display six ticker
  headlines. The 300-row archive read costs about 230ms of the 435ms warm
  response, and 294 of those rows are discarded.
- The player count stat calls `computeAllPlayers()` and takes `.size`; the
  summaries memo from ticket 015 already holds that count without a second
  compute pipeline.

## Tasks

- [ ] Ticker fetch drops to `limit: 20` (six displayed, headroom for
  freshness), removing the 300-row read from the home path.
- [ ] Player count reads from the memoized summaries instead of a separate
  compute call.
- [ ] Re-measure warm home response.

## Acceptance criteria

- Warm home response under 250ms with the same rendered content
- Ticker still shows six fresh headlines
