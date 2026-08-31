# Ticket 001: Full UI Design Refresh (impeccable pass)

**Status:** Complete (design pass shipped: focus rings, placeholder contrast, play-flow how-it-works, player page skeletons, row hover cleanup; detector clean)
**Priority:** High
**Scope:** All user-facing pages
**Skill:** Load `impeccable` before starting this ticket

## Goal

Give every page a deliberate design pass. The app has grown feature by feature; this ticket unifies visual hierarchy, spacing, motion, and polish so it feels like one designed product instead of an accumulation of screens.

## Audit areas

Run a full critique of each surface, then fix what the critique surfaces:

- [ ] Home (hero, ticker, stat chips, trending, news, how-it-works, CTA)
- [ ] Analyzer (trade builder panels, balance bar, verdict banner, results cards, saved list)
- [ ] Player detail (header card, value breakdown tiles, chart, game log, news)
- [ ] Players value board (table density, sorting affordances, trend arrows)
- [ ] Waiver wire (table, need badges, empty states)
- [ ] League (tabs, standings, trades, power rankings, partners, lineups)
- [ ] Compare (dual panels, chart, stat table)
- [ ] News (browser, cards, source chips)
- [ ] Global: header/nav, footer, empty states, loading states, error states

## Specific concerns to address

- [ ] Consistent card radii, borders, and hover treatments across all surfaces
- [ ] Typography scale audit: display headings, section headings, body, microcopy
- [ ] Color usage discipline: volt reserved for primary actions/highlights only
- [ ] Mobile review: every page at 375px width, no horizontal scroll, tables degrade gracefully
- [ ] Motion audit: every animation should have purpose; kill anything that feels gratuitous; verify `prefers-reduced-motion` coverage
- [ ] Loading skeletons for slow surfaces (player pages, league loads) instead of blank frames
- [ ] Focus states for keyboard navigation on all interactive elements
- [ ] Empty-state illustrations or guidance copy for: no watchlist, no league loaded, no saved analyses, no trade history

## Acceptance criteria

- `npm run build` passes with zero warnings
- All pages verified at mobile + desktop widths
- No console errors on any page
- Screenshots captured before/after for the README

## Do not do

- No new features in this ticket — design only
- Do not restructure routes or APIs
