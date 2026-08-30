export interface NFLPlayer {
  id: string;
  name: string;
  position: string;
  team: string | null;
  status: string;
  injuryStatus?: string;
  injuryBodyPart?: string;
  age?: number;
  yearsExp?: number;
  rookie: boolean;
  fantasyPositions?: string[];
}

export interface StatRow {
  pts_ppr?: number;
  pass_yd?: number;
  pass_td?: number;
  pass_int?: number;
  rush_att?: number;
  rush_yd?: number;
  rush_td?: number;
  targets?: number;
  rec?: number;
  rec_yd?: number;
  rec_td?: number;
  fum_lost?: number;
  off_snp?: number;
  [key: string]: number | undefined;
}

export interface WeekPoints {
  week: number;
  pts: number;
}

export interface PlayerSeasonAgg {
  season: number;
  games: number;
  total: number;
  ppg: number;
  best: number;
  worst: number;
  stdev: number;
  boomRate: number;
  bustRate: number;
  posRank?: number;
  weeks: WeekPoints[];
}

export interface ValueBreakdown {
  core: number;
  ageAdj: number;
  consistencyAdj: number;
  boomAdj: number;
  tePremium: number;
  injuryMult: number;
  trendAdj: number;
}

export interface PlayerValue {
  score: number | null;
  tier: string | null;
  ppg: number | null;
  games: number;
  breakdown?: ValueBreakdown;
}

export interface TrendingEntry {
  playerId: string;
  count: number;
}

export interface NewsItem {
  id: string;
  title: string;
  link: string;
  source: string;
  publishedAt: string;
  summary: string;
}

export interface PlayerSummary {
  id: string;
  name: string;
  position: string;
  team: string | null;
  status: string;
  injuryStatus?: string;
  age?: number;
  rookie: boolean;
  value: PlayerValue;
  posRank?: number;
  trendCount?: number;
  byeWeek?: number;
}

export interface PlayerBundle extends PlayerSummary {
  seasons: PlayerSeasonAgg[];
  news: NewsItem[];
}

export type Verdict =
  | "ACCEPT"
  | "LEAN_ACCEPT"
  | "FAIR"
  | "COUNTER"
  | "LEAN_DECLINE"
  | "DECLINE";

export interface AITradeAnalysis {
  verdict: Verdict;
  confidence: number;
  headline: string;
  summary: string;
  key_factors: string[];
  risks: string[];
  news_impact: string[];
  counter_ideas: string[];
  final_word: string;
}

export interface EngineResult {
  giveValue: number;
  getValue: number;
  diff: number;
  verdict: Verdict;
  needs: string[];
}

export interface AnalyzeResponse {
  ok: boolean;
  give: PlayerBundle[];
  get: PlayerBundle[];
  engine: EngineResult;
  ai: AITradeAnalysis | null;
  aiConfigured: boolean;
  model?: string;
  generatedAt: string;
}

export interface LeagueTeam {
  rosterId: number;
  teamName: string;
  displayName: string;
  wins: number;
  losses: number;
  ties: number;
  fpts: number;
  players: PlayerSummary[];
  starters: string[];
  totalValue: number;
}

export interface LeagueResponse {
  ok: boolean;
  platform: "SLEEPER" | "ESPN";
  league: {
    id: string;
    name: string;
    season: string;
    totalRosters: number;
    scoringLabel: string;
  };
  teams: LeagueTeam[];
  unmatched?: string[];
}
