# Ticket 005: Deploy anywhere - auth, Docker, cron endpoint

**Priority:** Medium
**Depends on:** Nothing
**Status:** Complete (HMAC session cookie middleware, off by default; /login with 5/min IP rate limit; public /api/health; POST /api/cron with X-Cron-Secret returning the refresh row; multi-stage alpine Dockerfile with standalone output, non-root fft user, /data + /.cache volumes; compose file; README deployment section. Verified end-to-end in a real container: gate redirect, login roundtrip, cron trigger, SQLite written by uid 100)

## Goal

The app runs only on the user's desktop. Add a password gate, a container build, and an external-cron entrypoint so it can run on a small VPS and be used from a phone.

## Tasks

- [ ] Auth: `AUTH_PASSWORD` and `AUTH_SECRET` env vars. `middleware.ts` checks a signed HMAC cookie (`fft_session`) on every route except `/login`, static assets, and `/api/health`. When `AUTH_PASSWORD` is unset, all requests pass through (local development unchanged).
- [ ] `/login` page: single password field, sets the cookie on match, rate-limit naive attempts in memory (5 per minute per IP).
- [ ] `GET /api/health`: returns `{ ok, uptime, lastRefresh }` unauthenticated, for uptime checks.
- [ ] `POST /api/cron` guarded by `X-Cron-Secret` header (env `CRON_SECRET`): triggers one background refresh cycle and returns the refresh log row. Keep the in-process scheduler as fallback when no external cron is configured.
- [ ] `Dockerfile`: multi-stage, `node:22-alpine`, `output: "standalone"` in next.config, build tools stage for `better-sqlite3` native build, volumes for `/data` and `/.cache`, non-root user.
- [ ] `docker-compose.yml`: service with env-file, port mapping, volumes, restart policy.
- [ ] `.dockerignore`: node_modules, .next, .cache, data.
- [ ] README: deployment section (VPS + Docker Compose + external cron via curl or systemd timer, HTTPS note via reverse proxy).
- [ ] Test: with `AUTH_PASSWORD` set, all pages redirect to `/login`, correct password round-trips, wrong password is rejected and rate limited; without the env var everything stays open.

## Acceptance criteria

- `docker compose up` starts a working app with persistent SQLite
- Password gate works and is off by default locally
- `/api/health` responds unauthenticated
- `/api/cron` triggers a refresh with the right secret and rejects without it
