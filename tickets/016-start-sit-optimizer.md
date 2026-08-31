# Ticket 016: Start-sit optimizer at /lineup

**Priority:** High
**Depends on:** Ticket 013 (weekly projections and matchups)
**Status:** Complete (/api/lineup with weekly-points override (blend/season fallback, byes zeroed), tight-calls with per-slot best eligible backup, /lineup page with slot grid + bench + tight calls + empty state, Lineup in nav. Live-verified with a real roster: Josh Allen 19.3 vs HOU, Gibbs 21.5 vs NO, tight call JSN over Amon-Ra by 0.1; Playwright clean on desktop + mobile; smoke + build pass)

## Goal

The season starts in about ten days and the app answers every question except
the one asked most on Sunday morning: who do I start? The league page has an
optimal-lineup view per team, but there is no gameday surface for the user's
own roster that combines weekly projections, matchups, and byes into a single
start-sit recommendation with reasoning.

The pieces already exist: the league page stores the user's roster and slot
counts in localStorage (`fft.league`), `optimalLineup` in league-intel solves
slot assignment, and weekly projections plus matchups power the Week N outlook
on player pages.

## Tasks

- [ ] `POST /api/lineup` with player ids and roster slots: builds bundles,
  overrides each player's effective points with the weekly projection (blend
  ppg fallback), runs the optimizer, and returns starters, bench, and the
  week context (opponent, home or away, bye flag) for every player.
- [ ] Tight calls: for each starting slot, the best benched player eligible
  for that slot and the projected margin, so the page can say "start Gibbs
  over Jacobs by 3.1" where the decision is close.
- [ ] `/lineup` page: reads the stored roster from localStorage, renders the
  starting lineup as a slot grid with week outlook per starter, the bench
  with projections, and a tight-calls panel sorted by thinnest margin.
- [ ] Empty state when no roster is stored, pointing at the league page.
- [ ] Lineup link in the header nav (desktop and mobile drawer).
- [ ] Smoke: lineup optimizer picks weekly points over season points when
  both exist, respects slot eligibility, and margins are non-negative.
- [ ] Playwright: page renders from a seeded localStorage roster with no
  console errors, and the API round-trips against real weekly projections.

## Acceptance criteria

- One page answers the full start-sit question for the user's roster
  including flex reasoning and byes
- Works for any roster selected on the league page, ESPN or Sleeper
- `npm run build`, `npm run smoke`, and a live Playwright pass
