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

export function computePlayerValue(
  player: NFLPlayer,
  aggs: PlayerSeasonAgg[],
  trendCount = 0
): PlayerValue {
  const played = aggs.filter((a) => a.games > 0);
  if (played.length === 0) {
    return {
      score: null,
      tier: player.rookie ? "Rookie / Prospect" : "Unknown",
      ppg: null,
      games: 0,
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

  const age = estimateAge(player);
  const isQb = player.position === "QB";
  let ageAdj = 0;
  if (age <= 23) ageAdj = 6;
  else if (age <= 27) ageAdj = 4;
  else if (age <= 29) ageAdj = 0;
  else if (age === 30) ageAdj = isQb ? -2 : -4;
  else if (age === 31) ageAdj = isQb ? -5 : -8;
  else ageAdj = isQb ? -10 : -14;

  const ratio = latest.stdev / Math.max(ppg, 6);
  const consistencyAdj = (1 - clamp((ratio - 0.5), 0, 1)) * 6;
  const boomAdj = round1(latest.boomRate * 6);
  const tePremium =
    player.position === "TE" && typeof latest.posRank === "number" && latest.posRank <= 3
      ? 5
      : 0;

  const status = (player.injuryStatus ?? "").toUpperCase();
  let injuryMult = 1;
  if (["IR", "OUT", "PUP", "NFI", "SUSPENSION", "SUSP"].some((s) => status.includes(s))) {
    injuryMult = 0.55;
  } else if (status === "Q" || status === "D") {
    injuryMult = 0.85;
  }

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
