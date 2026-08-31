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

export interface GameLogRow {
  week: number;
  pts: number;
  passYd?: number;
  passTd?: number;
  passInt?: number;
  rushYd?: number;
  rushTd?: number;
  rec?: number;
  recYd?: number;
  recTd?: number;
  targets?: number;
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

export interface EspnSeasonStat {
  season: number;
  total: number;
  ppg: number;
  games: number;
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
  espnSeason?: EspnSeasonStat;
  valueTrend?: number;
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
  projectedRank?: number;
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
    rosterSlots?: Record<string, number>;
  };
  teams: LeagueTeam[];
  unmatched?: string[];
}

export interface TradeSidePlayer {
  name: string;
  position: string;
  team: string | null;
  valueScore: number | null;
}

export interface LeagueTradeTeam {
  teamId: number;
  teamName: string;
  incoming: TradeSidePlayer[];
  outgoing: TradeSidePlayer[];
  netValue: number;
}

export interface LeagueTrade {
  id: number;
  date: string;
  status: string;
  teams: LeagueTradeTeam[];
  winnerTeamId: number | null;
  maxNet: number;
}

export interface TradesResponse {
  ok: boolean;
  error?: string;
  trades: LeagueTrade[];
}

export interface PowerRank {
  rosterId: number;
  teamName: string;
  record: string;
  totalValue: number;
  topPlayers: string[];
  powerScore: number;
  rank: number;
  standingRank: number;
  movement: number;
  espnProjectedRank?: number;
}

export interface TradePartnerTarget {
  position: string;
  targetName: string;
  targetScore: number;
  blockedBy: string;
}

export interface TradePartner {
  rosterId: number;
  teamName: string;
  theirNeeds: string[];
  targets: TradePartnerTarget[];
}

export interface TradeProposal {
  partnerRosterId: number;
  partnerTeam: string;
  youGive: PlayerSummary[];
  youGet: PlayerSummary[];
  giveValue: number;
  getValue: number;
  rationale: string;
}

export interface LineupSlot {
  slot: string;
  player: PlayerSummary | null;
  ppg: number | null;
}

export interface OptimalLineup {
  starters: LineupSlot[];
  bench: PlayerSummary[];
  projectedTotal: number;
}

export interface EspnRawPlayer {
  id?: number;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  positionId?: number;
  defaultPositionId?: number;
  proTeam?: string;
  proTeamId?: number;
  injuryStatus?: string;
  stats?: unknown[];
}

export interface EspnRawTeam {
  id?: number;
  name?: string;
  location?: string;
  nickname?: string;
  abbrev?: string;
  currentProjectedRank?: number;
  record?: {
    overall?: {
      wins?: number;
      losses?: number;
      ties?: number;
      pointsFor?: number;
    };
  };
  roster?: {
    entries?: {
      playerPoolEntry?: {
        player?: EspnRawPlayer;
      };
    }[];
  };
}
