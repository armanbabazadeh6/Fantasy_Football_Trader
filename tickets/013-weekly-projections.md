# Ticket 013: Weekly projections with matchup context

**Priority:** High
**Depends on:** Nothing (ESPN session store from ticket 012 is live and working)
**Status:** Complete (weekly_projections table, extractor + matchup builder with WSH normalization, sync upserts weekly rows, player page Week N outlook row, analyzer AI prompt gains week_outlook. Live-verified: Bijan page shows Week 1 outlook 15.5 pts vs DEN (home) from the real ESPN payload; smoke + build pass)

## Goal

The 2026 season starts in about ten days. The app projects full seasons but
says nothing about the week that matters right now: who does my player face in
week 1, and what does ESPN project him for that game? This ticket adds weekly
projections with opponent context to player pages and the analyzer, using
data the ESPN league payload already carries.

The ESPN roster payload contains weekly projections at `statSourceId: 1,
statSplitTypeId: 1, seasonId: 2026, scoringPeriodId: N` with `appliedTotal`
(live-verified earlier: Bijan 2026 W1 projection 19.30). The scoreboard cache
already holds every 2026 game with both competitors, so the same fetch that
derives bye weeks can derive opponents and home/away.

## Tasks

- [ ] SQLite `weekly_projections` table (player_id, season, week, points,
  fetched_at, PK player+season+week).
- [ ] `EspnStatEntry` gains `scoringPeriodId`; pure exported
  `extractWeeklyProjections(stats, season)` returns `{ week, points }[]` for
  statSourceId 1, statSplitTypeId 1, valid weeks, positive totals.
- [ ] `saveLeagueProjections` upserts weekly rows alongside season rows.
- [ ] `schedule.ts`: pure exported `buildWeekMatchups(events, week)` plus
  `fetchWeekMatchups(week)` returning per-team `{ opponent, homeAway }` from
  the scoreboard, with the same WSH to WAS normalization the bye map uses.
- [ ] Player detail: a Week N profile row showing the projected points and
  opponent ("19.3 pts vs KC (home)") or BYE, driven by a `weekly` field on
  the detail payload computed in `getPlayerDetail`.
- [ ] Analyzer: `compactBundle` includes `week_projection` and
  `week_matchup` so the AI verdict sees the upcoming game, and the trade
  context carries the same strings.
- [ ] Smoke tests: extractor handles mixed stat arrays (actuals, season
  projections, other seasons, zero totals); matchup builder maps both
  directions, marks home/away, and skips other weeks.
- [ ] Live verification: run a projections sync with the stored session and
  confirm Bijan's week 1 row lands in the table and on his player page.

## Acceptance criteria

- A rostered player's page shows his next game: opponent, home or away, and
  projected points (or BYE)
- The analyzer AI prompt knows each player's weekly projection and opponent
- `npm run build` and `npm run smoke` pass with the new checks
