import { describe, expect, it } from 'vitest';
import {
  legacyFactorLabel,
  localizeScenarioSet,
  translateComparisonDifference,
  translateComparisonSummary,
  translateScenarioDriver,
} from '../app/lib/i18n/scenarioPredictionLabels';
import type { MatchScenarioSet } from '../app/lib/api';

describe('scenarioPredictionLabels VI', () => {
  it('translates Scenario likelihood explanation lines', () => {
    expect(
      translateScenarioDriver('Scenario likelihood 42.5% with model confidence 71%.', 'vi'),
    ).toBe('Xác suất kịch bản 42.5% · độ tin cậy mô hình 71%.');
    expect(translateScenarioDriver('Conditional W/D/L: 45/28/27.', 'vi')).toBe(
      'W/D/L có điều kiện: 45/28/27.',
    );
  });

  it('translates legacy collective strength via legacyFactorLabel', () => {
    expect(legacyFactorLabel('Argentina collective strength 88%', 'vi')).toBe(
      'Sức mạnh tập thể Argentina: 88%',
    );
  });

  it('translates comparison summary and gap lines', () => {
    const scenarios = [
      {
        id: 'a',
        scenarioType: 'baseline_expected_flow',
        scenarioName: 'Controlled possession match',
        isBaseline: true,
      },
      {
        id: 'b',
        scenarioType: 'early_goal_swing',
        scenarioName: 'Early transition swing',
        isBaseline: false,
      },
    ] as MatchScenarioSet['scenarios'];

    expect(
      translateComparisonSummary(
        'Scenario likelihood is tightly balanced between controlled possession match and early transition swing.',
        scenarios,
        'vi',
        'Argentina',
        'France',
      ),
    ).toContain('Xác suất kịch bản cân bằng');

    expect(
      translateComparisonDifference('Scenario likelihood gap: 3.2 percentage points', 'vi', 'Argentina', 'France'),
    ).toBe('Chênh xác suất kịch bản: 3.2 điểm %');
  });

  it('localizes scenario set key drivers in VI mode', () => {
    const data: MatchScenarioSet = {
      matchId: 'm-1',
      generatedAt: '2026-06-01T00:00:00Z',
      updatedAt: '2026-06-01T00:00:00Z',
      scenarios: [
        {
          id: 's1',
          matchId: 'm-1',
          scenarioType: 'baseline_expected_flow',
          scenarioName: 'Controlled possession match',
          isBaseline: true,
          scenarioProbability: 0.5,
          scenarioConfidence: 0.7,
          homeWinProb: 0.4,
          drawProb: 0.3,
          awayWinProb: 0.3,
          expectedHomeGoals: 1.2,
          expectedAwayGoals: 1.0,
          mostLikelyScore: '1-1',
          initialConditions: [],
          triggerConditions: [],
          invalidationConditions: [],
          keyDrivers: ['Argentina collective strength 88%'],
          riskFactors: [],
          featureSelection: { missingInputs: [] },
          modelVersion: 'v1',
          inputHash: 'h1',
          status: 'active',
          updatedAt: '2026-06-01T00:00:00Z',
        },
      ],
      comparison: {
        primaryScenarioId: 's1',
        alternativeScenarioId: 's1',
        probabilityGap: 0,
        confidenceGap: 0,
        summary: 'Scenario likelihood is tightly balanced between a and b.',
        keyDifferences: ['Scenario likelihood gap: 0.0 percentage points'],
        homeWinDelta: 0,
        drawDelta: 0,
        awayWinDelta: 0,
        xgHomeDelta: 0,
        xgAwayDelta: 0,
      },
      sourceConfidence: { overall: 0.8, notes: [] },
    };

    const localized = localizeScenarioSet(data, 'vi', 'Argentina', 'France');
    expect(localized.scenarios[0].keyDrivers[0]).toBe('Sức mạnh tập thể Argentina: 88%');
  });
});
