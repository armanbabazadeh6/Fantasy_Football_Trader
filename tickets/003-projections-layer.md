# Ticket 003: Projections layer with rest-of-season trade simulation

**Priority:** High
**Depends on:** Nothing

## Goal

The app currently judges players on past production only. Add ESPN projections, blend them with our two-season PPG, and use the result everywhere it matters: player pages, the value board, the analyzer, and a new rest-of-season simulator that answers "if I make this trade, how many points does my lineup gain?"

## Reconnaissance already done

The ESPN league roster payload (with cookies) contains per-player `stats` arrays:
- `statSourceId: 1, statSplitTypeId: 1, seasonId: 2026, scoringPeriodId: N` = weekly **projection** (appliedTotal)
- `statSourceId: 1, statSplitTypeId: 0, seasonId: 2025` = 2025 season projection
- `statSourceId: 0` = actuals (already used)

Verified live: Bijan 2026 W1 projection 19.30 pts, 2025 season projection 339.37.

## Tasks

- [ ] `src/lib/projections.ts`: fetch projections for all rostered players from the ESPN league payload (extend `fetchEspnLeague` or a focused view call); for non-rostered players, fall back to a weighted-PPR baseline computed from our own stats. Investigate `kona_playercard` view for arbitrary players without a league context; document the result in this ticket.
- [ ] Blend formula in one place: `blendedProjection = 0.55 * espnProjection + 0.45 * enginePpg`, tunable constants. When only one source exists, use it directly and flag the provenance.
- [ ] Store projections in SQLite (`projections` table: player_id, season, week, points, source, fetched_at) refreshed by the background cycle; 6-hour TTL.
- [ ] Player pages: show projected ppg next to actual ppg with source label ("ESPN proj" vs "engine baseline").
- [ ] Value board: add `Proj` column using the blend.
- [ ] Analyzer: new "Rest of season" panel in results: sum of blended projections for each side's players, remaining-games awareness (18 weeks minus current week, bye-week subtraction per player).
- [ ] Analyzer: lineup impact simulation: rebuild optimal lineup with projections for the receiving side and report the projected weekly lineup delta ("this trade adds ~4.2 projected pts/week to your starting lineup").
- [ ] AI prompt: add `projected_ppg` and `rest_of_season_projection` to the player context.
- [ ] Smoke tests: blend formula, remaining-games math, bye subtraction.

## Acceptance criteria

- Every player on the connected league's rosters shows a projection with a real ESPN number behind it
- The analyzer reports rest-of-season point swing for both sides and lineup impact for the user
- Background refresh keeps projections no older than 6 hours
- `npm run build` and `npm run smoke` pass
