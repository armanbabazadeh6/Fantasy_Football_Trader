# Ticket 010: Tap targets, input labels, metadata title fix

**Priority:** Medium
**Depends on:** Nothing
**Status:** Complete (footer links 36px rows, sort headers 32px, filter chips 30px, ticker anchors 33px, search inputs carry their own padding and hit 36px, aria-labels on every input, league cookie fields get htmlFor/id. Verified: audit reports zero tap targets under 24px and zero unlabeled inputs)

## Findings (2026-08-31 audit)

- Tap targets under the 24px WCAG 2.5.8 minimum: footer links (20px tall),
  table sort headers (16px), ticker anchors (17px), news filter chips.
- Search inputs hit-test at 20px tall: the padding lives on the container, not
  the input, so taps above and below the text miss.
- Every search input relies on placeholder only, with no aria-label: players,
  news, waiver, analyzer (x2), player search, league pages.
- The root layout metadata title contains a corrupted character: `Fantasy
  Football Trader <U+FFFD>` shows in the browser tab and link previews.

## Tasks

- [ ] Footer links get vertical padding to a 36px row height.
- [ ] Table sort headers get padding to at least 24px tall (players board,
  waiver board, ops tables).
- [ ] Ticker anchors get vertical padding to at least 28px.
- [ ] Search inputs carry their own padding so the input element itself is at
  least 36px tall, with the container slimmed to match.
- [ ] aria-label on every search input ("Search players", "Search headlines",
  and so on).
- [x] Fix the corrupted title separator in `src/app/layout.tsx`: verified false
  positive, the title carries a valid em dash (U+2014) and the "corruption" was
  a console display artifact, not file content.

## Acceptance criteria

- Audit reports zero tap targets under 24px except decorative elements
- Audit reports zero unlabeled inputs
- Browser tab title renders clean text
