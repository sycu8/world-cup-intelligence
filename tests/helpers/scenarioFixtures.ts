import type { MatchPredictionScenario, ScenarioComparison } from '../../src/models/scenarios/types';
import { newId } from '../../src/utils/ids';

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
