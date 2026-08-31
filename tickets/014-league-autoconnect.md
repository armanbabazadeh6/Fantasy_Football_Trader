# Ticket 014: League page auto-connect

**Priority:** Medium
**Depends on:** Ticket 012 (stored ESPN session with remembered league id)
**Status:** Complete (auto-load fires once on mount when the stored session is healthy, uses session league id in fresh browsers with empty localStorage, no retry after failure, manual form untouched. Playwright-verified live on desktop and mobile: /league renders Thug Life standings with zero clicks; build + smoke pass)

## Goal

The league page still greets a returning user with an empty board and a
Connect button, even though the server already holds a healthy ESPN session
and the league id. One click every visit is one click too many for a tool
that lives in a phone tab on gameday.

## Tasks

- [ ] On mount, when no league is loaded and the stored session has a
  remembered league id with a non-expired status, trigger one automatic
  league load. Do not retry after a failure in the same visit.
- [ ] The auto-load must respect the platform toggle the user picks
  afterward: manual interaction still wins over the auto behavior.
- [ ] Show a subtle loading state while auto-connecting so the page does not
  look idle.
- [ ] Playwright verification against the real stored session: visiting
  /league renders the Thug Life standings with no clicks.

## Acceptance criteria

- Visiting /league with a healthy stored session loads standings, trades,
  power rankings, and partners without any interaction
- A failed auto-load falls back to the manual form with the session banner
  guidance, never a retry loop
