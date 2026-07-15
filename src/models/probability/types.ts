import type { LiveMatchStatsInput } from './liveMatchStatsModifier';
import type { H2hFeatures } from './h2hModifier';
import type { GroupPointsPressureSnapshot } from './groupPointsPressure';

export type IntervalProbability = {
  homeWinProb: number;
  drawProb: number;
  awayWinProb: number;
  expectedHomeGoals: number;
  expectedAwayGoals: number;
};

export type ExplanationFactor = {
  key: string;
  label: string;
  direction: 'home' | 'away' | 'draw' | 'neutral';
  impact: number;
  confidence: number;
  evidenceType: 'statistical' | 'official' | 'news' | 'live_event' | 'tactical_signal';
};

export type SourceSummary = {
  sourceId: string;
  sourceName: string;
  reliabilityScore: number;
};

export type TeamFeatures = {
  teamId: string;
  eloRating: number;
  fifaRanking: number;
  recentForm: number;
  goalDifference: number;
  xgDifference: number;
  xgFor: number;
  xgAgainst: number;
  possessionProfile: number;
  fieldTilt: number;
  ppda: number;
  highTurnovers: number;
  transitionThreat: number;
  setPieceXg: number;
  setPieceXga: number;
  defensiveCompactness: number;
  formationStability: number;
  benchDepth: number;
  goalkeeperStrength: number;
  restDays: number;
};

export type LineupFeatures = {
  formation: string;
  strengthModifier: number;
  missingKeyRoles: string[];
};

export type CoachFeatures = {
  coachId: string;
  name: string;
  wcAppearances: number;
  tenureYears: number;
  tacticalRating: number;
  disciplineIndex: number;
  homeNationMatch: boolean;
};

export type RefereeFeatures = {
  name: string;
  strictness: number;
  avgYellowCards: number;
  avgRedCards: number;
};

export type MatchFeatureInput = {
  matchId: string;
  tournamentYear: number;
  stage: string;
  minute: number;
  second: number;
  homeTeam: TeamFeatures;
  awayTeam: TeamFeatures;
  homeLineup?: LineupFeatures;
  awayLineup?: LineupFeatures;
  homeCoach?: CoachFeatures;
  awayCoach?: CoachFeatures;
  referee?: RefereeFeatures;
  currentScore: { home: number; away: number };
  sourceConfidence: number;
  /** In-match stats from FIFA/ESPN — used for live probability shifts */
  liveMatchStats?: LiveMatchStatsInput;
  /** WC2026 co-host playing at home */
  isHomeHost?: boolean;
  homeCountryCode?: string;
  awayCountryCode?: string;
  /** Completed matches in current tournament form window. */
  homeFormMatchesPlayed?: number;
  awayFormMatchesPlayed?: number;
  /** Historical WC head-to-head summary for this fixture orientation. */
  h2h?: H2hFeatures;
  /** Group-stage table context — boosts attack lambda as points pressure rises. */
  groupPointsPressure?: GroupPointsPressureSnapshot;
};

export type IntervalKey = '15' | '30' | '45' | '60' | '75' | '90';

export type ProbabilityResult = {
  matchId: string;
  timestamp: string;
  minute: number;
  second: number;
  modelVersion: string;
  inputHash: string;
  homeWinProb: number;
  drawProb: number;
  awayWinProb: number;
  expectedHomeGoals: number;
  expectedAwayGoals: number;
  mostLikelyScore: string;
  /** Rounded λ hint when it differs from mostLikelyScore (not used as primary prediction). */
  expectedScore?: string | null;
  scorelineDistribution: Record<string, number>;
  intervalDistribution: Record<IntervalKey, IntervalProbability>;
  confidence: number;
  topPositiveFactors: ExplanationFactor[];
  topNegativeFactors: ExplanationFactor[];
  sourceSummary: SourceSummary[];
  explanation: string;
};
