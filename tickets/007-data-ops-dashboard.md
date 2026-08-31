# Ticket 007: Data ops dashboard

**Priority:** Medium
**Depends on:** Ticket 005 for auth gating if deployed publicly

## Goal

The data layer runs blind: no visibility into which feeds fail, how old caches are, or whether the background scheduler is healthy. Build an `/ops` page that shows it working.

## Tasks

- [ ] `GET /api/ops/health`: JSON report with last 10 `refresh_log` rows, per-source news counts from the archive grouped by `first_seen` day, `value_history` snapshot count and most recent date, SQLite DB file size, `.cache` file count and oldest/newest mtimes per cache key family (players, stats, news).
- [ ] `/ops` page (respects auth if enabled): render the report as cards and tables.
  - Refresh history table: started, finished, players recorded, news count, ok/fail badge
  - Feed health: source name, items in last 24h from archive, status inferred (healthy / quiet / dead)
  - Cache ages: players, weekly stats per season, news, byes, with humanized ages ("2h ago", "stale 26h")
  - Storage: DB size, cache size, snapshot coverage
- [ ] Failure visibility: when a refresh cycle fails, the ops page shows the error from the log row.
- [ ] Link `/ops` in the footer, not the main nav.

## Acceptance criteria

- The page answers in one glance: is the scheduler alive, are feeds fresh, when did values last snapshot
- No new background load beyond one existing-log read
- Works with no league connected
