# Ticket 017: News page pagination

**Priority:** High
**Depends on:** Nothing
**Status:** Complete (server renders first 60 items with a count query, Load all button fetches the rest from /api/news/archive?limit=500, filters and search preserved. Measured: warm response ~250ms was ~850ms, HTML 142 KB was 641 KB)

## Findings (2026-08-31 production baseline)

- `/news` renders all 300 archived items server-side: 850ms warm response,
  641 KB HTML document. The archive API read itself costs 232ms of that; the
  rest is SSR of 300 cards the visitor has not scrolled to yet.
- The board had exactly this problem and fixed it with on-demand loading
  (ticket 006): 6 MB down to 141 KB.

## Tasks

- [ ] News page server-renders the first 60 items only.
- [ ] NewsBrowser shows "Showing 60 of N" with a Load all button that fetches
  the remaining items from the existing `/api/news/archive` route and appends
  them, preserving current filter and search behavior over whatever is loaded.
- [ ] Empty filter results continue to show the no-match message; after Load
  all, filtering covers the whole archive as before.
- [ ] Re-measure warm response time and HTML size.

## Acceptance criteria

- News HTML under 200 KB, warm response under 400ms
- Every archived item still reachable via Load all
- Filters and search behave over loaded items without regressions
