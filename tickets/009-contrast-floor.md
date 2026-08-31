# Ticket 009: Contrast debt - text below the AA floor

**Priority:** High
**Depends on:** Nothing
**Status:** Complete (all informational text now slate-400 or brighter: 22 slate-600 and 76 slate-500 instances replaced, placeholders to slate-400, ticker separator to slate-700 aria-hidden. Verified: audit reports zero sub-4.5:1 findings on informational text across all routes)

## Findings (2026-08-31 audit, computed oklch contrast on slate-950)

- `text-slate-600` carries informational text at 2.66:1 (ticker timestamps,
  analyzer empty state, news category counts, rank numbers). The AA floor is
  4.5:1 for body text.
- `text-slate-500` carries 10-14px informational text at 4.23:1: table column
  headers, player page meta labels, stat card labels, footer prose, breadcrumbs.
  A near miss is still a miss.
- Ticker separator dot uses `text-slate-800` at 1.38:1, which reads as a broken
  glyph rather than a separator.
- Hierarchy currently leans on color depth (400 vs 500 vs 600). After the fix it
  must lean on size, weight, and uppercase tracking instead.

## Tasks

- [ ] Every text-bearing `text-slate-600` becomes `text-slate-400`.
- [ ] Every `text-slate-500` on informational text under 18px becomes
  `text-slate-400`. Large (18px+) or bold display text may keep slate-500.
  Decorative icons may keep slate-500 (graphics floor is 3:1).
- [ ] Placeholders move to `placeholder:text-slate-400`.
- [ ] Ticker separator moves to `text-slate-700`.
- [ ] Re-run the audit: no informational text below 4.5:1 on any route.

## Acceptance criteria

- Audit reports zero sub-4.5:1 findings on informational text
- Visual hierarchy survives via size and weight, not murk
