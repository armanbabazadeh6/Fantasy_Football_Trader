import type {
  NFLPlayer,
  PlayerBundle,
  PlayerSeasonAgg,
  PlayerValue,
  ValueBreakdown,
  Verdict,
} from "@/types";

const REPLACEMENT_PPG: Record<string, number> = {
  QB: 13,
  RB: 6,
  WR: 8,
  TE: 3.5,
  K: 6,
  DEF: 5,
};

const TIERS: { min: number; label: string }[] = [
  { min: 88, label: "League Winner" },
  { min: 78, label: "Elite Starter" },
  { min: 68, label: "Strong Starter" },
  { min: 55, label: "Solid Starter" },
  { min: 42, label: "Flex / Depth" },
  { min: 30, label: "Bench Piece" },
  { min: 0, label: "Lottery Ticket" },
];

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function estimateAge(player: NFLPlayer): number {
  if (typeof player.age === "number" && player.age > 0) return player.age;
  if (typeof player.yearsExp === "number" && player.yearsExp > 0) return 22 + player.yearsExp;
  return player.rookie ? 22 : 26;
}

/** Prior info for players with no played seasons (rookies / young players). */
export interface ProspectPrior {
  draftSlot: number | null;
}

function ageAdjustment(player: NFLPlayer): number {
  const age = estimateAge(player);
  const isQb = player.position === "QB";
  if (age <= 23) return 6;
  if (age <= 27) return 4;
  if (age <= 29) return 0;
  if (age === 30) return isQb ? -2 : -4;
  if (age === 31) return isQb ? -5 : -8;
  return isQb ? -10 : -14;
}

function injuryMultiplier(player: NFLPlayer): number {
  const status = (player.injuryStatus ?? "").toUpperCase();
  if (["IR", "OUT", "PUP", "NFI", "SUSPENSION", "SUSP"].some((s) => status.includes(s))) {
    return 0.55;
  }
  if (status === "Q" || status === "D") return 0.85;
  return 1;
}

/**
 * Prior ppg by NFL draft slot (12-team PPR baseline; a top draft slot is a
 * strong proxy for projected rookie-year production):
 *
 *   pick 1-6     -> 14.0  (top-6 overall: elite RB/WR/QB1 territory)
 *   pick 7-18    -> 12.0  (first round: high-end starters)
 *   pick 19-36   -> 10.5  (rounds 2-3: solid starters)
 *   pick 37-60   ->  9.0  (rounds 4-5: low-end starters / high-upside)
 *   pick 61-100  ->  7.5  (rounds 6-8: flex / boom-bust)
 *   pick 101-257 ->  6.0  (day 3: bench / lottery)
 *   undrafted    ->  4.5  (skill) / 3.0 (QB) / 3.0 (TE) rookie-default
 *
 * QB/TE position scaling: draft slot is position-agnostic, but a rookie QB or
 * TE taken at a given slot reaches that fantasy production less reliably than
 * a RB/WR (fewer league-winning rookie TEs, rookie QBs volatile as passers),
 * so their prior is scaled by 0.85 / 0.90 respectively. This keeps a pick-30
 * rookie TE (~10.5 * 0.9 = 9.45 ppg) below the veteran TE elite instead of
 * outrushing realistic rookie-season output.
 */
function priorPpgFromDraftSlot(draftSlot: number | null, position: string): number {
  if (draftSlot === null) {
    if (position === "QB" || position === "TE") return 3;
    return 4.5;
  }
  const base =
    draftSlot <= 6 ? 14 :
    draftSlot <= 18 ? 12 :
    draftSlot <= 36 ? 10.5 :
    draftSlot <= 60 ? 9 :
    draftSlot <= 100 ? 7.5 :
    draftSlot <= 257 ? 6 :
    4.5;
  const scale = position === "QB" ? 0.85 : position === "TE" ? 0.9 : 1;
  return base * scale;
}

export function computePlayerValue(
  player: NFLPlayer,
  aggs: PlayerSeasonAgg[],
  trendCount = 0,
  prospect?: ProspectPrior
): PlayerValue {
  const played = aggs.filter((a) => a.games > 0);
  if (played.length === 0) {
    const isProspect = player.rookie || estimateAge(player) <= 24;
    if (!isProspect) {
      // Unknown veteran (no stats in the loaded window): stays null; sideValue
      // counts nulls as 0. See the comment on sideValue below.
      return {
        score: null,
        tier: "Unknown",
        ppg: null,
        games: 0,
      };
    }

    // Prospect prior: value the player from their NFL draft slot instead of
    // pricing them at 0. Same formula path as veterans — core from prior ppg
    // vs replacement, age adjustment (young players get the +6), injury
    // multiplier and trend as usual. Consistency/boom are unknown for a
    // statless player, so they stay 0 (never fabricated). tePremium needs
    // posRank, which a statless player cannot earn — also 0.
    const draftSlot = prospect?.draftSlot ?? null;
    const source: "draft" | "rookie-default" = draftSlot !== null ? "draft" : "rookie-default";
    const priorPpg = priorPpgFromDraftSlot(draftSlot, player.position);
    const rep = REPLACEMENT_PPG[player.position] ?? 6;
    const core = clamp((priorPpg - rep + 5) / 20, 0, 1) * 80;

    const ageAdj = ageAdjustment(player);
    const injuryMult = injuryMultiplier(player);

    const trendAdj = round1(clamp(trendCount / 40, 0, 1) * 4);
    // A prospect never outranks established stars: hard cap at the Strong
    // Starter ceiling (74), lifted to 78 only for a real top-3 draft pick.
    const cap = draftSlot !== null && draftSlot <= 3 ? 78 : 74;
    const score = Math.round(
      clamp(clamp(clamp(core + ageAdj, 0, 100) * injuryMult + trendAdj, 0, 100), 0, cap)
    );

    return {
      score,
      tier: "Rookie / Prospect",
      ppg: round1(priorPpg),
      games: 0,
      breakdown: {
        core: round1(core),
        ageAdj: round1(ageAdj),
        consistencyAdj: 0,
        boomAdj: 0,
        tePremium: 0,
        injuryMult,
        trendAdj,
      },
      prospect: { draftSlot, priorPpg: round1(priorPpg), source },
    };
  }
  const latest = played[0];
  const prior = played[1];
  const rep = REPLACEMENT_PPG[player.position] ?? 6;
  const MIN_SAMPLE_GAMES = 8;
  const priorPpg = prior ? prior.ppg : rep;
  let latestPpg = latest.ppg;
  if (latest.games < MIN_SAMPLE_GAMES) {
    latestPpg = (latest.ppg * latest.games + priorPpg * (MIN_SAMPLE_GAMES - latest.games)) / MIN_SAMPLE_GAMES;
  }
  const ppg = prior ? round1(latestPpg * 0.7 + prior.ppg * 0.3) : round1(latestPpg);
  const core = clamp((ppg - rep + 5) / 20, 0, 1) * 80;

  const ageAdj = ageAdjustment(player);

  const ratio = latest.stdev / Math.max(ppg, 6);
  const consistencyAdj = (1 - clamp((ratio - 0.5), 0, 1)) * 6;
  const boomAdj = round1(latest.boomRate * 6);
  const tePremium =
    player.position === "TE" && typeof latest.posRank === "number" && latest.posRank <= 3
      ? 5
      : 0;

  const injuryMult = injuryMultiplier(player);

  const trendAdj = round1(clamp(trendCount / 40, 0, 1) * 4);
  const base = clamp(core + ageAdj + consistencyAdj + boomAdj + tePremium, 0, 100);
  const score = Math.round(clamp(base * injuryMult + trendAdj, 0, 100));
  const tier = TIERS.find((t) => score >= t.min)?.label ?? "Lottery Ticket";

  const breakdown: ValueBreakdown = {
    core: round1(core),
    ageAdj: round1(ageAdj),
    consistencyAdj: round1(consistencyAdj),
    boomAdj,
    tePremium,
    injuryMult,
    trendAdj,
  };

  return { score, tier, ppg, games: latest.games, breakdown };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// NOTE: null scores count as 0 here (filtered out before summing). Since the
// prospect-prior fix, nulls are rare — only unknown veterans with no stats in
// the loaded window. Rookies and young players now get real numeric scores.
export function sideValue(values: (number | null)[]): number {
  const nums = values
    .filter((v): v is number => v !== null)
    .sort((a, b) => b - a);
  const weights = [1, 0.97, 0.94, 0.91, 0.89];
  return Math.round(
    nums.reduce((sum, v, i) => sum + v * weights[Math.min(i, weights.length - 1)], 0)
  );
}

export function ruleVerdict(giveValue: number, getValue: number): Verdict {
  const diff = getValue - giveValue;
  if (diff >= 12) return "ACCEPT";
  if (diff >= 4) return "LEAN_ACCEPT";
  if (diff > -4) return "FAIR";
  if (diff > -12) return "LEAN_DECLINE";
  return "DECLINE";
}

export function computeNeeds(roster: PlayerBundle[]): string[] {
  if (roster.length === 0) return [];
  const needs: string[] = [];
  const byPos = new Map<string, PlayerBundle[]>();
  for (const p of roster) {
    byPos.set(p.position, [...(byPos.get(p.position) ?? []), p]);
  }
  for (const pos of ["QB", "RB", "WR", "TE"]) {
    const group = (byPos.get(pos) ?? []).sort(
      (a, b) => (b.value.score ?? 0) - (a.value.score ?? 0)
    );
    if (group.length === 0) {
      needs.push(`No ${pos} on roster`);
      continue;
    }
    const best = group[0];
    if ((best.value.score ?? 0) < 50) {
      needs.push(`Weak at ${pos} (best option: ${best.name})`);
    } else if (pos !== "QB" && group.length === 1) {
      needs.push(`Only one viable ${pos} (${best.name})`);
    } else if (pos !== "QB" && (group[1]?.value.score ?? 0) < 42) {
      needs.push(`Thin depth at ${pos} behind ${best.name}`);
    }
  }
  return needs;
}
