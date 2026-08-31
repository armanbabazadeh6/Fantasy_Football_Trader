# Ticket 012: ESPN session persistence, rotation capture, and health

**Priority:** High
**Depends on:** Nothing
**Status:** Complete (AES-256-GCM encrypted session store with generated data/session.key, central stored-cookie fallback in espnFetchJson, Set-Cookie rotation capture, /api/espn-session with GET status + POST test + DELETE, league page status chip + Test connection + expired banner, ops session row + 2h background check. Verified live against the real league: cookie-only-load works from any browser with empty localStorage. Bonus finding: the "expired" cookie was alive, ESPN 401s non-browser user agents, so raw curl tests need the app's UA)

## Problem

The ESPN cookie lives only in the browser's localStorage. When ESPN expires or
rotates it, every device loses access at once, nothing tells the user until a
page fails, and the fix is a blind re-paste. The expired-cookie test session
(401 on 2026-08-31) makes this concrete.

ESPN will never let us keep a session alive forever: tokens are rotated on
purpose, and automating a username/password login would mean storing the
user's ESPN password and violating their terms. What we can do is make the
cookie a server-managed asset: stored once, shared by every browser, extended
automatically when ESPN's own responses rotate it, and monitored so the user
hears about expiry the moment it happens instead of when a page breaks.

## Tasks

- [ ] SQLite `espn_session` singleton table: encrypted cookie blob, league_id,
  updated_at, last_ok_at, last_fail_at, status.
- [ ] `src/lib/espn-session.ts`: AES-256-GCM encryption with a generated
  `data/session.key` (gitignored, auto-created), save/get/record helpers, and
  a pure `mergeSetCookies` that folds `Set-Cookie` response headers into the
  stored cookie string (replace same-name pairs, append new names, return null
  when nothing changed).
- [ ] `espnFetchJson` central fallback: when a request carries no cookie, use
  the stored session. After every ESPN call, record ok/fail; capture
  `Set-Cookie` rotations and persist them (log when a rotation happens).
- [ ] `/api/espn-league/[id]`: on success with a client-supplied cookie,
  persist it and remember the league id. On auth failure with a stored
  session, return `sessionExpired: true` so the UI can react.
- [ ] New `/api/espn-session` route: GET status (never returns the cookie
  value), DELETE clears the stored session, POST tests the stored cookie
  against the remembered league.
- [ ] League page: ESPN session status chip (OK with age, missing, or expired),
  Test connection button, and an expired banner that surfaces the existing
  cookie refresh guide in place.
- [ ] Ops: session health row in the report (status, updated, last ok/fail)
  and a background check in the refresh cycle when a session + league id
  exist, so expiry is caught within two hours, not on next page load.
- [ ] Smoke tests: encryption roundtrip (ciphertext differs from plaintext),
  Set-Cookie merge (replace, append, no-op), status transitions.

## Acceptance criteria

- Pasting the cookie once on any browser makes every ESPN feature work
  everywhere the server runs, including a fresh browser with empty localStorage
- A Set-Cookie rotation from ESPN updates the stored session without user
  action and is visible in the server log
- When the session dies, the league page and /ops say so immediately and the
  refresh guide is one click away; the background cycle flips the status
  within two hours
- The cookie value never appears in any API response or the ops report
