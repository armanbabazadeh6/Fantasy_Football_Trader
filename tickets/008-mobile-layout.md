# Ticket 008: Mobile layout - nav drawer, no horizontal scroll anywhere

**Priority:** High
**Depends on:** Nothing
**Status:** Complete (hamburger drawer below sm with 44px rows, Escape + route-change close, aria-expanded/controls; player name row wraps with pinned star/Compare. Verified: zero horizontal scroll at 390px on all eight routes)

## Findings (2026-08-31 audit, 390px viewport)

- Every page scrolls horizontally: document 476px wide against a 390px viewport.
- Root cause: the site header renders five nav links, the 12-Team PPR badge, and
  the GitHub icon in one row with no mobile pattern. The nav alone is 360px and
  sits beside a 64px logo block and a 36px icon button.
- Secondary cause: the player detail header row (`h1` name + watch star +
  Compare button, no wrap) is 367px and breaks the viewport on names like
  "Bijan Robinson".

## Tasks

- [ ] Site header: below the sm breakpoint show a hamburger button (44px tap
  target) and a slide-down panel with all five nav links, the GitHub link, and
  the 12-Team PPR badge. Links stack full-width with 44px rows. aria-expanded on
  the button, aria-controls on the panel, Escape closes, route change closes.
- [ ] Desktop nav (sm and up) unchanged.
- [ ] Player detail: name row wraps on narrow screens, name can break across
  lines, watch star and Compare stay pinned right.
- [ ] Re-run the DOM audit at 390px: zero horizontal scroll on all routes,
  header nav tap targets at least 44px.

## Acceptance criteria

- No page scrolls sideways at 390px
- The full nav is reachable on a phone in one tap
- Player detail with a long name fits the viewport
