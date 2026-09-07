# Value Engine & Trade Logic — Review Findings

**Scope:** `src/lib/value-engine.ts`, `src/lib/league-intel.ts`, `src/lib/fantasy.ts`, `src/lib/projections.ts`, `src/types/index.ts`, `src/app/api/analyze/route.ts`, with supporting context from `src/lib/sleeper.ts`, `src/lib/nfl-data.ts`, `src/lib/schedule.ts`, `src/lib/espn.ts`, `src/app/api/lineup/route.ts`, `scripts/smoke.ts`.

**Method:** static review only. No source files modified, no installs or builds run. Line numbers are current as of this worktree (2026-09-07, preseason: the 2026 regular season has not started, so `statSeasons()` = `[2026, 2025]` yields 2026 week stats empty and all values derive from 2025).

**Assumption:** 12-team PPR league on Sleeper stats, with optional ESPN league import.

## Summary

| # | Severity | One-liner |
|---|----------|-----------|
| 1 | Critical | Rookies / players with no 2025 games value as `null` → `sideValue` treats them as 0 → degenerate trade verdicts right now |
| 2 | Major | `tePremium` is dead code — `posRank` is assigned only after values are computed |
| 3 | Major | `sideValue` package inflation: eight bench pieces out-value a league winner |
| 4 | Major | Optimal lineup starts injured (OUT/IR) players |
| 5 | Major | Two-season stats window: players who missed all of 2025 come back as Unknown/0 |
| 6–14 | Minor | Preseason smoke false-fail; season-boundary drift across modules; silent stat/projection drops; injury-vocab matching; `computeNeeds` on rookies; ESPN slot-map conflation; `afterRoster` duplication; shrinkage prior falls back to replacement |

---

## A. Bugs

### 1. CRITICAL — Rookies and no-2025 players value as `null` → trade math treats them as 0

**Location:** `src/lib/value-engine.ts:44-52` (null return), `src/lib/value-engine.ts:113-121` (`sideValue` filters nulls), `src/app/api/analyze/route.ts:92-95`.

**What breaks:** `computePlayerValue` returns `score: null` when a player has zero games in the loaded seasons. `sideValue` drops nulls entirely (they contribute 0). The verdict is then computed from one-sided numbers.

**Failing scenario (live today):** Every 2026 rookie — and every veteran who missed all of 2025 — has `score: null`.
- Give 1 rookie, get 1 veteran with score 85 → `giveValue = 0`, `getValue = 85`, diff `+85` → **ACCEPT**. The analyzer endorses trading any rookie for any established veteran.
- Give 2 rookies, get 2 rookies → `0` vs `0` → **FAIR**. Zero information.
- The rookie side of every trade during the draft/preseason window — exactly when rookie trades peak — is unpriceable, and the UI presents the resulting verdicts as authoritative.

**Fix direction:** introduce a prospect prior — blend ESPN ROS projections (already persisted by the projections pipeline) and/or Sleeper ADP into the engine ppg with shrinkage when stats are missing, so a first-round rookie prices somewhere in the 55–75 band instead of 0. See Feature Idea 1.

### 2. MAJOR — `tePremium` is dead code

**Location:** `src/lib/value-engine.ts:78-81` reads `latest.posRank`; `posRank` is assigned by `applyPositionRanks` (`src/lib/nfl-data.ts:149, 155-180`) only **after** `computePlayerValue` already ran at `src/lib/nfl-data.ts:145`.

**What breaks:** `latest.posRank` is always `undefined` at valuation time, so `tePremium` is always 0 in production. `ValueBreakdown.tePremium` (`src/types/index.ts:70`) always reports 0 — misleading in any UI that shows the breakdown. No test covers it.

**Failing scenario:** Elite TE1 (e.g. `posRank` 1, would earn +5) and TE10 get identical treatment; the "tight-end premium" the breakdown promises never materializes.

**Fix direction:** move `applyPositionRanks` before the `computePlayerValue` loop in `computeAllPlayers`, or pass season totals into the valuation so rank can be computed inline.

### 3. MAJOR — `sideValue` package inflation: quantity beats quality

**Location:** `src/lib/value-engine.ts:117-120`; interacts with `ruleVerdict` thresholds at `src/lib/value-engine.ts:123-130`.

**What breaks:** Weights are nearly linear — `[1, 0.97, 0.94, 0.91, 0.89]`, with every player past index 4 clamped to 0.89. There is no roster-size cap, and the verdict thresholds (±4 / ±12) are absolute points, so side-size asymmetry drives the verdict.

**Failing scenario:** Trade one 90-score league winner for eight 20-score bench pieces:
- `sideValue([90])` = 90.
- `sideValue([20 × 8])` = 20 × (1 + 0.97 + 0.94 + 0.91 + 0.89×4) = 20 × 7.38 = 147.6 → 148.
- diff = +58 → **ACCEPT**. The engine recommends dismantling a contender for bench fodder.

**Secondary inconsistency:** `proposeTrades` balances packages on **raw score sums** (`src/lib/league-intel.ts:293-294, 301`), but the analyzer applies weighted `sideValue`. Two 50s for one 90 satisfies the generator's `|sum − target| ≤ 10` check, but the analyzer computes give = 50 + 48.5 = 99 vs get = 90 → diff −9 → **LEAN_DECLINE**. The engine proposes trades its own analyzer rejects.

**Fix direction:** steep decay past the number of startable slots (or cap contributing players at roster size), and/or make verdict thresholds relative (diff as a % of `giveValue`). Align `proposeTrades` with the same function. See Feature Idea 2.

### 4. MAJOR — Optimal lineup starts injured players

**Location:** `src/lib/league-intel.ts:134-178` (`optimalLineup`), `src/app/api/lineup/route.ts:62-64`.

**What breaks:** Only byes are zeroed. An OUT/IR player with a stale 2025 season ppg (or an ESPN weekly projection) keeps full projected points and sorts to the top of the pool.

**Failing scenario:** RB1 is listed OUT on the Friday injury report but averaged 18 ppg in 2025. `points = weekly ?? blend ?? season ?? 0` → 18 → the optimizer starts him over a healthy 12-ppg backup, and `computeTightCalls` reports a comfortable +6 margin that will not happen.

**Fix direction:** zero (or heavily discount) OUT/IR/SUSPENSION statuses in the lineup inputs for both the lineup route and the analyze route's `lineupImpact`. See Feature Idea 5.

### 5. MAJOR — Two-season stats window: returning players have no prior

**Location:** `src/lib/sleeper.ts:87-95` (`statSeasons()` returns only 2 seasons), `src/lib/nfl-data.ts:128-140` (season loop).

**What breaks:** The window is `[2026, 2025]`. In the 2026 preseason `aggs = [2025]` only, so `prior` is `undefined` and both the 0.7/0.3 two-season blend and the <8-game shrinkage never engage. A player who missed all of 2025 (injury, holdout, hold-in) has **no** aggregate at all → `score: null`, tier "Unknown" → worth 0 in trades (same mechanism as Bug 1), despite potentially strong 2024 value sitting one season outside the window.

**Failing scenario:** A top-12 WR who tore an ACL in 2025 training camp prices as "Unknown" / 0 in every trade evaluation until he plays a 2026 game.

**Fix direction:** widen the fetch window to 3 seasons (or lazily fetch an extra season for players whose latest two are empty).

### 6. MINOR — Smoke test hard-fails by design in preseason

**Location:** `scripts/smoke.ts:523-525`.

**What breaks:** The check asserts `week1Count > 100` for week-1 stats of `statSeasons()[0]`, which is 2026 before kickoff → 0 rows → FAIL, every preseason run.

**Fix direction:** gate the check on the season having started (skip when `getCurrentWeek() === 0`).

### 7. MINOR — Inconsistent season-boundary rules across modules

**Location:** `src/lib/sleeper.ts:87-90` (month ≥ 8), `src/lib/espn.ts:141-143` (month ≠ 0), `src/lib/schedule.ts:7-10` (month ≥ 3).

**What breaks:** Three different definitions of "current season". From February through August, `espnSeasonYear()` points at a year ESPN has no data for yet (projections table stays empty — graceful, but silently engine-only), and the schedule flips to the new season in April while player stats lag to September.

**Fix direction:** centralize one `currentSeason()` helper consumed by all three modules.

### 8. MINOR — `extractPPR` silently drops games with uncovered point keys

**Location:** `src/lib/fantasy.ts:12-16`.

**What breaks:** `KEEP_STATS` persists all three formats (`pts_ppr`, `pts_std`, `pts_half_ppr` — `src/lib/sleeper.ts:14-17`), but the extraction probe doesn't cover every key: a week whose row only carries a non-probed points key returns `null` and the game vanishes from aggregates. Low likelihood (Sleeper normally populates `pts_ppr`) but completely silent when it happens.

**Fix direction:** probe all three keys with a defined precedence (full → half → std).

### 9. MINOR — `extractWeeklyProjections` drops points ≤ 0

**Location:** `src/lib/projections.ts:39`.

**What breaks:** A legitimately 0.0-projected week is indistinguishable from a missing one. `getWeeklyProjection` (ORDER BY week ASC, week ≥ fromWeek) then returns a **later** week's projection and `week_outlook` mislabels it as the requested week's.

**Fix direction:** store a presence flag or sentinel instead of filtering on `points > 0`.

### 10. MINOR — Injury status matching is brittle

**Location:** `src/lib/value-engine.ts:83-89`.

**What breaks:** `"Q"`/`"D"` are exact-match only — a full word like `"QUESTIONABLE"` gets no discount — while the `"IR"` check is a loose substring match. Works for today's Sleeper vocabulary; silently degrades if the vocabulary drifts.

**Fix direction:** normalize to a canonical set (prefix/word-boundary match on QUESTIONABLE, DOUBTFUL, OUT, IR, PUP, NFI, SUSPENSION).

### 11. MINOR — `computeNeeds` mislabels rookie-best positions

**Location:** `src/lib/value-engine.ts:132-156`.

**What breaks:** `null` score coerces to 0, so a roster whose best RB is a first-round rookie reports "Weak at RB (best option: …)" — directionally fine, but the message is wrong for elite prospects. K/DEF are never assessed (by design; worth a comment).

**Fix direction:** re-check after Bug 1's prospect prior lands; until then, suppress the "weak at" message when the best option's score is null rather than 0.

### 12. MINOR — ESPN slot map conflates partial flexes and drops OP/superflex

**Location:** `src/lib/espn.ts:77-88` (`ESPN_SLOT_MAP`), applied at `src/lib/espn.ts:253-257`; consumed by `src/lib/league-intel.ts:144, 201-204`; rendered on the league page at `src/app/league/page.tsx:668, 1014`.

**What breaks (user-visible):**
- Slot 3 (RB/WR) and slot 5 (WR/TE) both map to generic `"FLEX"`, and `eligibleForSlot` treats FLEX as RB/WR/TE — so a WR/TE-only slot wrongly admits RBs, and an RB/WR slot wrongly admits TEs. The "optimal lineup" can field an illegal starter.
- Slot ids absent from the map (TQB 1, the OP/utility slot 8, defensive specialist slots) are dropped entirely, so those starting slots don't exist in `optimalLineup` — projected totals under-count in superflex/OP leagues. `slotOrder` (`league-intel.ts:144`) is hard-coded to QB/RB/WR/TE/FLEX/K/DEF, so any unmapped key would be ignored downstream anyway.

**Fix direction:** extend `ESPN_SLOT_MAP` to distinct slot kinds (FLEX_RB_WR, FLEX_WR_TE, OP/SUPER_FLEX) and extend `eligibleForSlot`/`slotOrder` to handle them; QBs must be eligible for OP/superflex slots.

### 13. MINOR — `afterRoster` duplication in `lineupImpact`

**Location:** `src/app/api/analyze/route.ts:106-109`.

**What breaks:** If a `get` player is already on `myRoster`, they appear twice in `afterRoster` (once from the roster filter, once from `...get`), inflating the post-trade lineup's options. The UI normally prevents selecting your own players; the API doesn't guard it.

**Fix direction:** filter `get` against `myRosterIds` when building `afterRoster`.

### 14. MINOR — Shrinkage prior falls back to replacement PPG; age estimate defaults generous

**Location:** `src/lib/value-engine.ts:55-61` (prior = `rep` when no prior season), `src/lib/value-engine.ts:33-37` (`estimateAge`).

**What breaks:** A player with <8 games and no prior season gets pulled toward replacement-level ppg even if the small sample is elite (a 25-ppg 4-game flash is shrunk to ~15). Separately, `estimateAge` defaults missing age/exp to 26 — which earns a +4 age adjustment — slightly flattering players with sparse metadata.

**Fix direction:** shrink toward a position-mean of comparable players rather than flat replacement; default missing age to a neutral band (e.g. 27–28, adj 0) unless `rookie` is set.

---

## B. Edge Cases

- **Preseason window (Sept 1 → week 1 kickoff):** `getCurrentWeek()` returns 0 until a 2026 type-2 event completes (`schedule.ts:119-131`), so `nextWeek = max(1, 0+1) = 1` in both the analyze route (`route.ts:118-119`) and lineup route (`route.ts:53`). The 2026 weekly fetches return empty — 18 wasted Sleeper calls per cold refresh (mitigated by 6h caching) — and all values derive from 2025. Smoke check 6 (above) fails by design in this window.
- **Rookies:** no stats ever → `score: null`, tier "Rookie / Prospect", `ppg: null`. In lineup context `blendProjection` yields ppg **0** (not null — `projections.ts:49-66`), so `projectedTotal` underestimates but doesn't crash; `optimalLineup` only starts a rookie when no alternative exists (null ppg sorts last, and the FLEX filter excludes null-ppg players entirely — `league-intel.ts:149-155`).
- **Week 0 handling:** `nextWeek = 1`, `rosGames = 18 − bye`; week-1 matchups and byes resolve correctly because `fetchTeamByeWeeks` / `fetchWeekMatchups` (`schedule.ts:88-117`) derive from the full-season, status-agnostic scoreboard.
- **Partial 2026 data once the season starts:** latest = 2026, prior = 2025; shrinkage (<8 games) and the 0.7/0.3 blend engage as designed.
- **Players who missed all of 2025:** Unknown / 0 (Bug 5) — the same roster can contain a top-2024 player priced as a throw-in.
- **K/DEF:** the boom threshold (20 pts) is rarely met for kickers and kicker `core` caps in the ~40s given `REPLACEMENT_PPG.K = 6` — intended, but the baselines are hardcoded and ignore league format (scoring settings are fetched but unused by the value engine).
- **`ruleVerdict` never returns `"COUNTER"`** although the `Verdict` type defines it (`types/index.ts:138-144`) — dead enum member; any UI branch on it never triggers.
- **Absolute thresholds:** ±4/±12 means very different things for a 30-point side and a 300-point package side (compounds Bug 3).

---

## C. Feature Ideas (ranked by value)

1. **Rookie/prospect prior.** Blend ESPN ROS projections (already persisted by the projections pipeline, and `espnSeason` already rides on `PlayerSummary` for ESPN-imported leagues — `espn.ts:456-457`) and/or Sleeper ADP into engine ppg with shrinkage when stats are missing. Eliminates the degenerate preseason/rookie verdicts (fixes Bug 1) during the exact window when rookie trades peak.
2. **Roster-aware `sideValue`.** Steep decay past the number of startable slots (or cap contributing players at roster size) and/or relative verdict thresholds (diff as % of side value). Kills the 8-for-1 ACCEPT pathology and aligns `proposeTrades` with the analyzer (fixes Bug 3).
3. **Dynasty vs redraft mode toggle.** Make the age-curve weight and rookie-prior weight configurable; the current `ageAdj` (−14..+6 on a 100 scale) barely moves verdicts in either format.
4. **Positional scarcity from live data.** Use `posRank` (already computed in `applyPositionRanks`) as a scarcity multiplier — revives the dead `tePremium` (Bug 2) and replaces hardcoded `REPLACEMENT_PPG` with baselines derived from actual loaded-league rosters (starters vs bench at each position).
5. **Injury-aware lineup optimizer.** Zero/exclude OUT/IR/SUSPENSION players from `optimalLineup` inputs in both the lineup route and the analyze route's `lineupImpact` (fixes Bug 4).
6. **Surface `valueTrend`.** The value-history snapshots (recorded every refresh via `recordDailyScores`) already exist — expose momentum as an adjustment in trade verdicts and the UI.

---

*Static review; no files were modified other than this report. All line numbers verified against the current worktree contents.*
