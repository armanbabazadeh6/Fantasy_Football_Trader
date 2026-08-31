# Ticket 006: Value board performance

**Priority:** Medium
**Depends on:** Nothing
**Status:** Complete (/api/players paged mode with server-side sort/filter; page shell renders 50 rows server-side, infinite scroll + Load more; URL params synced via replaceState; measured 6.02MB/8.2s cold before vs 141KB/~600ms warm after; smoke + build pass)

## Goal

The players page embeds all ~3,000 player summaries in the RSC payload, producing a 2.5MB HTML document. Serve the board through a paginated API and render rows on demand so the page loads in well under a second.

## Tasks

- [ ] Extend `GET /api/players` with `page`, `pageSize`, `sort`, `dir` params implemented server-side against the already-sorted summaries; keep the existing `q`, `pos`, `ids` params working with pagination.
- [ ] Players page: server component renders only the shell, filter bar, and the first page of rows; the client table fetches subsequent pages on demand ("Load more" button or infinite scroll via IntersectionObserver).
- [ ] Keep URL params in sync (`?pos=WR&sort=ppg&q=...`) so filtered views are shareable and survive refresh.
- [ ] Sort handling: move client-side sorting for the current page to server-side sort params so ordering is correct across pages.
- [ ] Trend arrows, bye weeks, value bars continue to render per row.
- [ ] Measure before and after: initial HTML size, time to first row, time to full board.

## Acceptance criteria

- Initial HTML under 200KB
- All rows reachable via pagination with working filters and sorting
- Deep-linked filter URLs restore the exact view
- `npm run build` passes with no warnings
