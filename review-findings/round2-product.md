# Product Review — Round 2 (2026-09-07, kickoff in 3 days)

## 1. Existing feature inventory

| Surface | What exists today |
|---|---|
| `/` home | Hero + stats, news ticker, watchlist panel (value/injury/bye/news/valueTrend badges, 30 s poll), trending-8 grid, latest-6 news, how-it-works |
| `/analyzer` | Two-sided builder, live side-value bar + rule verdict, roster quick-add from stored league, `?give=&get=` URL hydration + swap + copy-link, AI/rule verdict banner, key factors/risks/news impact/counter ideas, value ledger, ROS projected points, lineup impact Δpts/wk, save + reload saved analyses |
| `/players` | Server-paged value board, search + position filter, 7 sort keys (score/ppg/proj/games/posRank/age/name), infinite scroll + load-more, CSV export, watch stars |
| `/player/[id]` | Value + tier + full breakdown tiles, value history sparkline, weekly chart, game log, meta chips incl. bye/injury, week outlook (ESPN weekly projection + matchup), compare + analyzer deep links, watch star |
| `/compare` | `?a=&b=` hydration (correctly id-mapped), overlaid weekly scoring, 12-metric winner table |
| `/waiver` | Trending adds ranked by value, search/pos filters, "fills your X need" badges from stored roster |
| `/lineup` | Optimal lineup for stored roster, starters/bench, projected total, tight calls, ESPN-proj badges, bye highlighting |
| `/league` | ESPN + Sleeper connect (auto-connect via stored session), standings w/ expandable rosters + per-team optimal lineup, graded trade history (ESPN), power rankings (55/25/20 blend + ESPN projected rank), auto-proposed deals w/ copy-text, surplus-match partners, "use my team" → localStorage |
| `/news` | Archived browser: search, source chips, category filter, load-all |
| `/ops` | Pipeline health dashboard (refresh log, feed statuses, cache stats) |
| Data assets | Value engine scores + breakdowns + prospect priors (draft slot); `value_history` daily snapshots + `valueTrend`; ESPN season **and weekly** projections tables; news archive w/ category/firstSeen/dedupe; full-season scoreboard → per-week matchups, byes, `getCurrentWeek`, `restOfSeasonGames`; ESPN draft picks; Sleeper trending; graded league trades; `computeNeeds`, `optimalLineup`, `computeTightCalls`, `powerRankings`, `findTradePartners`, `proposeTrades` |

## 2. Dedupe vs review-findings/*.md

Already proposed there (not re-proposed): persistent analyzer sessions (shipped), watchlist value badge (shipped), player→analyzer deep link (shipped), league-aware waiver targets (partially shipped as fit badges; richer version below is the delta), compare share/swap (still open — Q4), SEO/OG package (open, not product-critical), all infra items (validation, single-flight, scheduler, session, sideValue roster-cap, injury-aware optimizer, dynasty toggle, positional scarcity). Everything below is **new** relative to those documents.

## 3. Ranked recommendations

### Quick wins (<1 day each)

**Q1. Movers board (valueTrend sort + risers/fallers view).** *As a trader I want to see who's rising/falling before offering/accepting.* Data: `valueTrend` already on every `PlayerSummary`; add `"trend"` to `PLAYER_SORT_KEYS` (`nfl-data.ts:308`) + a Trend column + "Top risers/fallers" rails on `/` or `/players`. ~0.5 day. Momentum is the cheapest real edge in a 12-team league; currently visible only on watchlist and player page.

**Q2. Rookie/prospect board.** *Draft just happened — one table of this rookie class with draft slot, prior ppg, capped value, to price rookie trades.* Data: `PlayerValue.prospect` (draftSlot/priorPpg/source), `rookie`/`rookieYear`, ESPN draft picks already fetched. ~0.5 day (filter + draft-slot column). Rookie-for-veteran trades peak in the next 3 weeks; today the prior is visible only per player page.

**Q3. Bye-week collision planner.** *Show me which weeks my starters share a bye, so I trade/waiver for coverage before it bites.* Data: `byeWeek` on every summary + stored `fft.league` roster. ~0.5 day (group roster by byeWeek, flag weeks with ≥2 starters out; place on `/lineup`). Converts the lineup page into a season-planning tool; zero new upstream calls.

**Q4. Compare: swap + URL write-back + projection rows.** *Flip sides, share the link in league chat, see ROS projections not just last-season stats.* Data: all present (`compare/page.tsx:27-44` reads `?a=&b=`; `PlayerSummary.projection` already carried). ~0.5 day (mirror analyzer's swap/replaceState pattern at `analyzer/page.tsx:130-141`; add proj rows to `compare/page.tsx:83-107`). Closes the last open frontend-ux U2 item; makes compare the shareable "argument" surface in group chats.

**Q5. Analyzer: "who owns him in my league" chip.** *When I add a player to the receive side, tell me which league-mate owns him and whether they have surplus.* Data: all teams are in the `LeagueResponse`; currently only your own roster is saved (`analyzer/page.tsx:57-59`). ~0.5-1 day (extend `selectTeamForAnalyzer` in `league/page.tsx:~680` to store `{teamName, players}` per rosterId; render owner chip + surplus note from the same logic as `findTradePartners`). Kills the most common mid-analysis question without leaving the analyzer.

**Q6. Lineup page: retry + refresh + manual override.** *A transient API error or injury designation shouldn't brick my lineup page; let me retry and swap a starter myself.* ~0.5 day (retry button on the error state at `lineup-board.tsx:96-107`). Still open from frontend-ux U3.

### Medium (1-3 days each)

**M1. League positional power matrix ("position strength grid").** *Per position, every team's starter-quality (via optimalLineup) so I can see I'm WR1-strong league-wide and RB-weakest — the honest basis for trade targets.* Data: `optimalLineup` already runs per team on the standings tab. ~1-2 days (aggregate into a 12×(QB,RB,WR,TE,FLEX) grid of projected points, rank cells, color-grade). Positional scarcity from **your actual league** is what makes a 78-score RB worth more than an 82-score WR.

**M2. Waiver "already rostered" flags + need-ranked ordering.** *Rank trending adds by how badly my roster needs them, grey out ones league-mates already own.* Data: trending list + `computeNeeds` + full league rosters (from Q5 storage). ~1 day. In a 12-team league 70%+ of trending adds are owned — knowing which are actually gettable via trade vs waiver is the actionable split.

**M3. Trade-target finder ("acquire board").** *For each of my weak positions, one ranked list of every league player I could realistically get — owner, their surplus, upgrade margin over my starter, one-click into the analyzer.* Data: `findTradePartners` logic (`league-intel.ts:68-120`) already computes surplus/blockedBy; extend to full lists, reuse analyzer deep link `?get=`. ~1-2 days. From "badges" to the primary acquisition workflow: the question is never "is he good" but "who has him and would deal him".

**M4. Manager trade-fairness profile.** *Before negotiating, show which league-mates historically overpay/undersell, using our own graded trade history.* Data: `LeagueTrade[]` with per-team `netValue` and winner already returned by the ESPN transactions route. ~1-2 days (client aggregation + panel on league page partners tab). Negotiation intel no external site has.

**M5. Watchlist news digest page.** *One morning view: every archived news item matching any watched player, newest first, with value movement next to it.* Data: `getArchivedNews` + `matchNewsForPlayer` + `valueTrend` — all existing. ~1 day. Today watchlist news is capped by the 6-item home news slice (`watchlist-panel.tsx:82-84`); kickoff week is exactly when you want the full firehose filtered to your 10 guys.

### Flagship (build next)

**F1. Championship Schedule — rest-of-season & playoff-week SOS per player.** *Before I trade for a WR, show his remaining opponents and — critically — his weeks 15-17 slate difficulty, so I'm not acquiring a regular-season hero with a playoff graveyard.* Data source: 100% in-repo — `fetchScoreboard()` caches the full season, `fetchWeekMatchups(week)` gives every remaining matchup, and opponent defensive strength vs position is derivable by aggregating `weeklyBySeason` points allowed to each position per defense. `restOfSeasonGames` already encodes remaining-games logic. ~2-3 days. The single biggest gap vs paid advice sites: trades made in weeks 8-12 are really purchases of a weeks-15-17 schedule, and every current surface treats all remaining games as equal.

**F2. League War Room — one page that answers "what should I do this week?".** *Open one page on Tuesday: my lineup's weak slots and tight calls, bye collisions ahead, waiver adds that fit, top 5 trade targets with owner/surplus — each one-click.* Pure composition of existing assets (optimalLineup + tightCalls, Q3 bye planner, waiver needs, M1 grid, M3 acquire board, Q1 movers). ~3 days once the pieces exist. Today the product is five good pages with no narrative between them; a war room makes the tool a weekly habit for 17 straight weeks — when trade-analyzer usage peaks.

**F3. Trade-impact simulator on the player page.** *From any player page, one click: "what happens to my projected lineup if I swap him for player X?"* Data source: `/api/analyze` already computes before/after optimal lineups (`analyze/route.ts:102-115`); player page already deep-links `?give=`. ~2 days (client section reusing the analyze response + stored `fft.league`). `lineupImpact` is the most decision-relevant number the engine produces (a trade that loses 8 value points but gains 2 pts/wk at your weak RB2 slot is a *good* trade) and it's currently buried at the end of an analysis you only run after assembling both sides.

## 4. Page-by-page refinements (summary)

- **Analyzer**: owner chips (Q5), positional scarcity note (M1), playoff-schedule flag on week outlook (F1); saved-list should load from `GET /api/analyses` (server copy exists, unused — still open from frontend-ux #6).
- **Players board**: Trend and Rookie filters/sorts (Q1/Q2); tier filter chip (data present as `value.tier`); otherwise solid.
- **Player page**: "similar-value alternatives at position" rail (same position, |Δscore| ≤ 5 — ~0.5 day, directly supports sell-high decisions); playoff-week schedule (F1); swap simulator (F3).
- **Compare**: swap/write-back/projection rows (Q4); valueTrend column.
- **Waiver**: need-ranked ordering + rostered flags (M2).
- **Lineup**: retry/refresh/override (Q6), bye planner (Q3), week selector (nothing new needed — `getWeeklyProjection(id, week)` already takes a week).
- **Home**: movers rail (Q1), watchlist digest link (M5).

## 5. Sequencing for kickoff in 3 days

Ship Q1, Q2, Q4, Q6 before Thursday (all <0.5 day, all reuse computed data, zero upstream risk). Q3/Q5 next. Post-kickoff, when real 2026 weekly data starts flowing and league-mates begin making moves: M1→M3 (the acquisition workflow), then F1 (playoff SOS — most valuable by week 8), then F2/F3.

*Review date: 2026-09-07 · Read-only review · No files modified.*
