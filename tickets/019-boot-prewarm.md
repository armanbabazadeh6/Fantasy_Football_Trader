# Ticket 019: Boot prewarm via instrumentation

**Priority:** Medium
**Depends on:** Nothing
**Status:** Complete (instrumentation.ts with node-only prewarm module via runtime-gated import, scheduler starts at process boot, caches warm before first request, plus a delayed self-request route warmup since first-route module loading only triggers on a served request. Measured: cold first request 371ms was 1321ms)

## Findings (2026-08-31 production baseline)

- First request after a cold server boot pays 1.3s: parsing the 1.4 MB
  computed players cache, the 4 MB scoreboard JSON, the archive read, and the
  projections table, all inline with the user's click.
- `startBackgroundRefresh` is invoked lazily by the first data request
  (`loadCoreData`), so on a freshly booted server the first visitor also
  triggers the scheduler setup.
- Next.js supports `instrumentation.ts` with a `register()` hook that runs
  once per server process at boot: the natural place to warm every cache
  before the first request arrives.

## Tasks

- [ ] `src/instrumentation.ts` with `register()` that, on the nodejs runtime,
  kicks off: compute prewarm (computeAllPlayers), summary memo build,
  scoreboard parse (fetchTeamByeWeeks), week matchups, news archive read,
  trending, and the ESPN projections table read. All fire-and-forget with
  error guards; register() must never throw or block boot.
- [ ] Move `startBackgroundRefresh()` invocation from `loadCoreData` into
  register() so the scheduler starts with the process, not the first click.
- [ ] Re-measure the first request after a cold boot.

## Acceptance criteria

- First request after boot under 400ms (near-warm), instead of 1.3s
- Server boot remains fast and non-blocking
- Background scheduler starts exactly once per process
