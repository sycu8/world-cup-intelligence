import type { LocalizedString } from './briefingText';

const BASE = '/api';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  health: () => get<{ status: string; dependencies?: Record<string, string> }>('/health'),
  dashboard: () =>
    get<{
      data: DashboardData;
    }>('/dashboard'),
  home: () => get<import('./homePrefetch').HomePayload>('/home'),
  /** Schedule is WC 2026 only; tournament param is ignored server-side */
  schedule: (tournament = 't-2026') =>
    get<{
      data: {
        byDate: Record<string, ScheduleMatch[]>;
        matches: ScheduleMatch[];
        tournamentId: string;
        total: number;
      };
      meta?: { expectedMatches: number; year: number };
    }>(`/schedule?tournament=${tournament}`),
  news: (opts?: { page?: number; pageSize?: number; hot?: number }) => {
    const page = opts?.page ?? 1;
    const pageSize = opts?.pageSize ?? 8;
    const hot = opts?.hot ?? 3;
    return get<{
      data: { hot: NewsArticle[]; articles: NewsArticle[] };
      meta: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
        hotCount: number;
        lastCrawl: string | null;
        crawlIntervalSec: number;
      };
    }>(`/news?page=${page}&pageSize=${pageSize}&hot=${hot}`);
  },
  newsArticle: (id: string) => get<{ data: NewsArticle }>(`/news/${id}`),
  tournaments: () => get<{ data: unknown[] }>('/tournaments'),
  matches: () => get<{ data: MatchSummary[] }>('/matches'),
  match: (id: string) => get<{ data: MatchSummary }>(`/matches/${id}`),
  matchProbability: (id: string) => get<{ data: ProbabilityData }>(`/matches/${id}/probability`),
  matchEvents: (id: string) => get<{ data: unknown[] }>(`/matches/${id}/events`),
  matchHistory: (id: string) =>
    get<{
      data: {
        history: HistoryMatch[];
        worldCupHistory: HistoryMatch[];
        summary: H2HSummary;
        worldCupSummary: H2HSummary;
        current: HistoryMatch;
      };
    }>(`/matches/${id}/history`),
  matchHints: (id: string) =>
    get<{ data: { hints: ProbabilityHint[] } }>(`/matches/${id}/hints`),
  matchBriefing: (id: string) => get<{ data: TacticalBriefing }>(`/matches/${id}/tactical-briefing`),
  matchPreview: (id: string) => get<{ data: MatchPreviewAnalysis }>(`/matches/${id}/preview`),
  matchLineups: (id: string) => get<{ data: MatchLineupsPayload }>(`/matches/${id}/lineups`),
  matchTeamSystem: (id: string) =>
    get<{ data: TeamSystemPayload; ai?: unknown }>(`/matches/${id}/team-system`),
  matchScenarios: (id: string) =>
    get<{ data: ScenariosPayload; ai?: unknown }>(`/matches/${id}/scenarios`),
  matchScenarioPredictions: (id: string) =>
    get<{ data: MatchScenarioSet }>(`/matches/${id}/scenario-predictions`),
  matchScenarioComparison: (id: string) =>
    get<{ data: unknown; ai?: unknown }>(`/matches/${id}/scenario-comparison`),
  matchMarketSignals: (id: string) =>
    get<{ data: MarketSignalsPayload }>(`/matches/${id}/market-signals`),
  matchModelVsMarket: (id: string) =>
    get<{ data: ModelVsMarketData | null; ai?: unknown }>(`/matches/${id}/model-vs-market`),
  matchProbabilityMovement: (id: string) =>
    get<{ data: ProbabilityMovementPayload }>(`/matches/${id}/probability-movement`),
  historicalTournaments: () => get<{ data: HistoricalTournament[] }>('/tournaments'),
  teams: () => get<{ data: TeamSummary[] }>('/teams'),
  team: (id: string) => get<{ data: TeamSummary }>(`/teams/${id}`),
  teamWcH2h: (id: string) =>
    get<{
      data: {
        teamId: string;
        totalMeetings: number;
        opponents: TeamWcOpponentRecord[];
      };
    }>(`/teams/${id}/wc-h2h`),
  players: () => get<{ data: PlayerSummary[] }>('/players'),
  player: (id: string) => get<{ data: PlayerSummary }>(`/players/${id}`),
  search: (q: string) => get<{ data: Record<string, unknown[]> }>(`/search?q=${encodeURIComponent(q)}`),
  matchAnalysis: (id: string) =>
    get<{ data: MultiVariableAnalysis | null; meta?: { gatewayConfigured?: boolean } }>(
      `/analysis/${id}`,
    ),
  aiConfig: () => get<{ data: { gatewayEnabled: boolean; routing: unknown[] } }>('/analysis/config'),
};

export type HistoryMatch = {
  id: string;
  home_team_id?: string;
  away_team_id?: string;
  kickoff_utc: string;
  stage: string | null;
  home_name: string;
  away_name: string;
  home_short?: string | null;
  away_short?: string | null;
  home_score: number;
  away_score: number;
  tournament_year?: number;
};

export type H2HSummary = {
  totalMatches: number;
  homeTeamWins: number;
  awayTeamWins: number;
  draws: number;
  avgGoalsHome: number;
  avgGoalsAway: number;
  recentFormHome: string;
  recentFormAway: string;
};

export type TeamWcOpponentRecord = {
  opponentId: string;
  opponentName: string;
  opponentShort: string | null;
  meetings: HistoryMatch[];
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
};

export type ProbabilityHint = {
  id: string;
  vi: string;
  en: string;
  type: string;
};

export type MultiVariableAnalysis = {
  executiveSummary: string;
  variableInsights: {
    variable: string;
    impact: string;
    direction: string;
    explanation: string;
  }[];
  tacticalRecommendations: string[];
  riskFactors: string[];
  confidence: number;
  modelsUsed?: string[];
};

export type DashboardData = {
  featuredMatch: (ScheduleMatch & { probability?: ProbabilityData | null }) | null;
  matchCount: number;
  lastDataRefresh: string | null;
  lastNewsCrawl: string | null;
  refreshIntervalSec: number;
  newsCrawlIntervalSec: number;
  tournamentStartUtc?: string;
  expectedMatches?: number;
  hostCountries?: string[];
  teamsCount?: number;
  groupCount?: number;
  statusCounts?: Record<string, number>;
};

export type ScheduleMatch = {
  id: string;
  slug?: string;
  kickoff_utc: string;
  status: string;
  stage?: string;
  group_code?: string;
  home_score: number;
  away_score: number;
  minute?: number;
  home_name: string;
  away_name: string;
  home_short?: string;
  away_short?: string;
  match_date?: string;
};

export type NewsArticle = {
  id: string;
  title: string;
  titleVi?: string;
  titleEn?: string;
  source_url: string;
  summary: string;
  summaryVi?: string;
  summaryEn?: string;
  published_at: string;
  reliability_score: number;
  source_name?: string;
  thumbnail_url?: string | null;
  hot_score?: number;
  translated?: boolean;
};

export type MatchSummary = {
  id: string;
  slug?: string;
  home_team_id: string;
  away_team_id: string;
  home_name?: string;
  away_name?: string;
  status: string;
  home_score: number;
  away_score: number;
  minute?: number;
  kickoff_utc?: string;
  stage?: string;
};

export type TeamSummary = {
  id: string;
  name: string;
  short_name?: string;
  fifa_ranking?: number;
  elo_rating?: number;
};

export type PlayerSummary = {
  id: string;
  name: string;
  position?: string;
  club?: string;
};

export type ProbabilityData = {
  homeWinProb: number;
  drawProb: number;
  awayWinProb: number;
  expectedHomeGoals: number;
  expectedAwayGoals: number;
  mostLikelyScore?: string;
  scorelineDistribution?: Record<string, number>;
  intervalDistribution?: Record<string, { homeWinProb: number; drawProb: number; awayWinProb: number }>;
  confidence?: number;
  modelVersion?: string;
};

export type LineupPlayerRow = {
  shirtNumber: number | null;
  name: string;
  position: string;
};

export type MatchLineupSide = {
  teamId: string;
  teamName: string;
  formation: string | null;
  players: string[];
  lineupPlayers?: LineupPlayerRow[];
  hasAccurateLineup?: boolean;
  source: string;
};

export type MatchLineupsPayload = {
  matchId: string;
  slug?: string;
  home: MatchLineupSide;
  away: MatchLineupSide;
  records?: unknown[];
};

export type MatchPreviewSidePreview = {
  teamId: string;
  teamName: string;
  shortName?: string | null;
  elo: number | null;
  fifaRanking: number | null;
  collectiveStrength: number | null;
  formation: string | null;
  lineupSource: string;
  hasAccurateLineup?: boolean;
  lineupPlayers?: LineupPlayerRow[];
  keyPlayers: string[];
  fullLineup: string[];
  recentForm: string;
  formMatches?: number;
};

export type MatchPreviewAnalysis = {
  matchId: string;
  generatedAt: string;
  matchLabel: LocalizedString;
  stage: string | null;
  groupCode: string | null;
  kickoffUtc: string;
  home: MatchPreviewSidePreview;
  away: MatchPreviewSidePreview;
  summary: LocalizedString;
  sections: {
    context: LocalizedString;
    strength: LocalizedString;
    lineup: LocalizedString;
    form: LocalizedString;
    tactical: LocalizedString;
  };
  insights: LocalizedString[];
  probabilityNote: LocalizedString | null;
  scorelineTop3: { score: string; prob: number }[];
  dataSources: string[];
  dataHash?: string;
};

export type TacticalBriefing = {
  summary: LocalizedString;
  probabilityExplanation: LocalizedString[];
  uncertaintyNotes: LocalizedString[];
  citations: { sourceName: string; title?: string }[];
  tacticalThemes?: {
    title: LocalizedString;
    detail: LocalizedString;
    confidence: number;
  }[];
};

export type TeamSystemSide = {
  teamId: string;
  tacticalIdentity: string;
  primaryFormation: string;
  collectiveStrengthScore: number;
  formationStabilityScore: number;
  pressingScore: number;
  defensiveCompactnessScore: number;
  transitionScore: number;
  setPieceScore: number;
  benchDepthScore: number;
  lineupCohesionScore: number;
  possessionControlScore: number;
  tempoScore: number;
  explanationFactors?: string[];
  confidence?: number;
  modelVersion?: string;
};

export type TeamSystemPayload = {
  matchId: string;
  home: TeamSystemSide | null;
  away: TeamSystemSide | null;
  disclaimer: string;
};

export type ScenarioItem = {
  scenarioType: string;
  probability: number;
  confidence: number;
  explanationFactors: string[];
  modelVersion?: string;
  createdAt?: string;
};

export type ScenariosPayload = {
  matchId: string;
  scenarios: ScenarioItem[];
  disclaimer: string;
};

export type MatchPredictionScenario = {
  id: string;
  matchId: string;
  scenarioType: string;
  scenarioName: string;
  scenarioRank: number;
  isBaseline: boolean;
  initialConditions: Array<{
    condition: string;
    value: string | number | boolean;
    confidence: number;
    source?: string;
  }>;
  triggerConditions: Array<{
    condition: string;
    threshold: string | number;
    currentValue?: string | number;
    status: 'not_triggered' | 'partially_triggered' | 'triggered';
  }>;
  invalidationConditions: Array<{
    condition: string;
    threshold: string | number;
    currentValue?: string | number;
    status: 'valid' | 'at_risk' | 'invalidated';
  }>;
  scenarioProbability: number;
  scenarioConfidence: number;
  homeWinProb: number;
  drawProb: number;
  awayWinProb: number;
  expectedHomeGoals: number;
  expectedAwayGoals: number;
  mostLikelyScore: string;
  scorelineDistribution: Record<string, number>;
  keyDrivers: string[];
  riskFactors: string[];
  modelVersion: string;
  inputHash: string;
  status: string;
  updatedAt: string;
};

export type MatchScenarioSet = {
  matchId: string;
  generatedAt: string;
  updatedAt: string;
  scenarios: MatchPredictionScenario[];
  comparison: {
    primaryScenarioId: string;
    alternativeScenarioId: string;
    probabilityGap: number;
    confidenceGap: number;
    summary: string;
    keyDifferences: string[];
    homeWinDelta: number;
    drawDelta: number;
    awayWinDelta: number;
    xgHomeDelta: number;
    xgAwayDelta: number;
  };
  sourceConfidence: {
    overall: number;
    notes: string[];
  };
};

export type ModelVsMarketData = {
  matchId: string;
  model: { home: number; draw: number; away: number };
  market: { home: number; draw: number; away: number };
  edge: { home: number; draw: number; away: number };
  volatilityScore: number;
  sourceId?: string;
  sourceName?: string;
  sourceReliability?: number;
  retrievedAt?: string | null;
  updatedAt?: string;
  disclaimer: string;
};

export type MarketSignalsPayload = {
  signals: ModelVsMarketData | null;
  oddsSnapshots: unknown[];
  disclaimer: string;
};

export type ProbabilityMovementPayload = {
  matchId: string;
  events: {
    label: string;
    timestamp: string;
    minute?: number;
    homeWinBefore: number;
    homeWinAfter: number;
    drawBefore: number;
    drawAfter: number;
    awayBefore: number;
    awayAfter: number;
    deltaHome: number;
    reasonCode: 'baseline' | 'live' | 'recalc';
  }[];
  modelVersion: string | null;
};

export type HistoricalTournament = {
  id: string;
  year: number;
  name: string;
  host_countries_json?: string | null;
  teams_count?: number | null;
  status?: string | null;
};
