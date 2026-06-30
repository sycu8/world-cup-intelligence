import type {
  MatchPredictionScenario,
  MatchScenarioContext,
  ScenarioComparison,
} from '../../src/models/scenarios/types';
import { buildTeamSystemProfile } from '../../src/models/probability/teamSystemStrength';
import { newId } from '../../src/utils/ids';

export function mockScenarioContext(overrides: Partial<MatchScenarioContext> = {}): MatchScenarioContext {
  const homeTeam = {
    teamId: 'team-usa',
    eloRating: 1780,
    fifaRanking: 12,
    recentForm: 0.3,
    goalDifference: 2,
    xgDifference: 0.4,
    xgFor: 1.6,
    xgAgainst: 1.2,
    possessionProfile: 0.55,
    fieldTilt: 0.52,
    ppda: 8,
    highTurnovers: 0.6,
    transitionThreat: 0.55,
    setPieceXg: 0.25,
    setPieceXga: 0.2,
    defensiveCompactness: 0.6,
    formationStability: 0.7,
    benchDepth: 0.65,
    goalkeeperStrength: 0.7,
    restDays: 4,
  };
  const awayTeam = { ...homeTeam, teamId: 'team-mex', recentForm: 0.2 };
  const homeSystem = buildTeamSystemProfile(homeTeam, '4-3-3');
  const awaySystem = buildTeamSystemProfile(awayTeam, '4-4-2');
  const probability = {
    matchId: 'm-1',
    modelVersion: 'wc-prob-v2',
    inputHash: 'hash',
    timestamp: new Date().toISOString(),
    homeWinProb: 0.4,
    drawProb: 0.28,
    awayWinProb: 0.32,
    expectedHomeGoals: 1.5,
    expectedAwayGoals: 1.3,
    mostLikelyScore: '1-1',
    scorelineDistribution: { '1-1': 0.12, '2-1': 0.1, '1-2': 0.09 },
    intervalDistribution: {},
    scenarioLikelihoods: [],
    teamSystemFactors: { home: homeSystem, away: awaySystem },
    topPositiveFactors: [],
    topNegativeFactors: [],
    confidence: 0.82,
  };

  return {
    matchId: 'm-1',
    tournamentYear: 2026,
    stage: 'Group',
    minute: 0,
    homeScore: 0,
    awayScore: 0,
    status: 'scheduled',
    homeTeamName: 'United States',
    awayTeamName: 'Mexico',
    features: {
      matchId: 'm-1',
      tournamentYear: 2026,
      stage: 'Group',
      minute: 0,
      second: 0,
      homeTeam,
      awayTeam,
      currentScore: { home: 0, away: 0 },
      sourceConfidence: 0.85,
    },
    probability,
    homeSystem,
    awaySystem,
    homeLineupSource: 'projected',
    awayLineupSource: 'projected',
    marketImplied: null,
    ...overrides,
  };
}

export function mockScenario(overrides: Partial<MatchPredictionScenario> = {}): MatchPredictionScenario {
  return {
    id: newId('mps'),
    matchId: 'm-1',
    scenarioType: 'baseline_expected_flow',
    scenarioName: 'Baseline expected flow',
    scenarioRank: 1,
    isBaseline: true,
    initialConditions: [{ condition: 'kickoff', value: 'scheduled', confidence: 0.9 }],
    triggerConditions: [],
    invalidationConditions: [],
    scenarioProbability: 0.35,
    scenarioConfidence: 0.82,
    homeWinProb: 0.42,
    drawProb: 0.28,
    awayWinProb: 0.3,
    expectedHomeGoals: 1.5,
    expectedAwayGoals: 1.2,
    mostLikelyScore: '1-1',
    scorelineDistribution: { '1-1': 0.12 },
    intervalDistribution: {
      '15': { homeWinProb: 0.1, drawProb: 0.8, awayWinProb: 0.1, topScorelines: [] },
      '30': { homeWinProb: 0.2, drawProb: 0.6, awayWinProb: 0.2, topScorelines: [] },
      '45': { homeWinProb: 0.3, drawProb: 0.4, awayWinProb: 0.3, topScorelines: [] },
      '60': { homeWinProb: 0.35, drawProb: 0.3, awayWinProb: 0.35, topScorelines: [] },
      '75': { homeWinProb: 0.4, drawProb: 0.25, awayWinProb: 0.35, topScorelines: [] },
      '90': { homeWinProb: 0.42, drawProb: 0.28, awayWinProb: 0.3, topScorelines: [] },
    },
    keyDrivers: ['Home pressing edge', 'Away transition threat'],
    riskFactors: ['Lineup uncertainty'],
    featureSelection: {
      scenarioType: 'baseline_expected_flow',
      selectedFeatureGroups: ['team_system'],
      requiredInputs: ['elo'],
      optionalInputs: ['market_signal'],
      missingInputs: [],
      inputQualityScore: 0.85,
      confidencePenalty: 0,
      reason: ['Baseline path'],
    },
    modelVersion: 'scenario-v1',
    inputHash: 'hash-1',
    featureSnapshotR2Key: 'scenarios/m-1/test.json',
    status: 'active',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

export function mockComparison(overrides: Partial<ScenarioComparison> = {}): ScenarioComparison {
  return {
    primaryScenarioId: 'mps-a',
    alternativeScenarioId: 'mps-b',
    probabilityGap: 0.08,
    confidenceGap: 0.05,
    summary: 'Baseline remains primary but transition path is competitive.',
    keyDifferences: ['Higher xG under transition scenario'],
    homeWinDelta: 0.04,
    drawDelta: -0.02,
    awayWinDelta: -0.02,
    xgHomeDelta: 0.15,
    xgAwayDelta: -0.05,
    ...overrides,
  };
}
