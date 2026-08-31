# Ticket 011: League and compare surface audit

**Priority:** Medium
**Depends on:** Nothing

## Context

The 2026-08-31 critique pass (tickets 008-010) audited eight routes but never
exercised `/league` beyond its empty state and never visited `/compare`, because
both need client state: the league UI renders from an ESPN or Sleeper API
response, and compare needs two player IDs. This ticket finishes the sweep.

The ESPN cookie in the test environment is expired, so the audit mocks the
league API at the network layer (Playwright route interception) with a
realistic 6-team ESPN payload, seeds the connect flow, and audits every tab:
standings, trade history, power rankings, trade partners, and the expanded
team roster view. Compare runs against the real compare API with two players.

## Findings (2026-08-31 seeded audit, 390px and 1440px)

- Disabled tab labels (pre-load state: Standings, Trade History, Power
  Rankings, Trade Partners) rendered at 1.95:1 via text-slate-700. Disabled
  controls are WCAG-exempt, but labels that explain what loading a league
  unlocks should still be perceivable.
- Everything else came back clean: no horizontal scroll, no overflow outside
  scroll containers, no sub-24px tap targets, no unlabeled inputs, no heading
  skips, no contrast failures on informational text, across all six league
  states and the compare page at both viewports.

## Tasks

- [x] Disabled tab labels move from text-slate-700 to text-slate-500 (4.23:1),
  still clearly inactive next to the volt active tab.
- [x] Seeded audit covers: league standings, trade history, power rankings,
  trade partners, expanded team roster, and /compare?a=&b=, at 390px and
  1440px.

## Acceptance criteria

- All six league states plus compare report zero audit findings at both
  viewports (the only exception allowed: disabled controls, which are
  WCAG-exempt)
- The audit harness waits for React hydration before interacting, so clicks
  cannot race event handlers
