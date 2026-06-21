import { describe, expect, it, vi } from 'vitest';
import { aggregateScenarioMetrics } from '../src/models/scenarios/backtesting/scenarioMetrics';
import {
  scenarioBrierScore,
  scenarioCalibrationError,
} from '../src/models/scenarios/backtesting/scenarioCalibration';
import { runScenarioBacktest } from '../src/models/scenarios/backtesting/scenarioBacktestRunner';
import { runBacktest } from '../src/models/backtesting/backtestRunner';
import { brierScore, logLoss } from '../src/models/backtesting/metrics';
import { buildScenarioExplanationFactors } from '../src/models/scenarios/scenarioExplanationFactors';
import { createMockDb, createMockEnv } from './helpers/mockEnv';
import { mockScenario } from './helpers/scenarioFixtures';

describe('scenarioMetrics', () => {
  it('aggregateScenarioMetrics averages samples', () => {
    const result = aggregateScenarioMetrics([
      { scenarioHitRate: 1, scenarioBrierScore: 0.2, scenarioCalibrationError: 0.1, scenarioRankAccuracy: 1 },
      { scenarioHitRate: 0, scenarioBrierScore: 0.4, scenarioCalibrationError: 0.2, scenarioRankAccuracy: 0 },
    ]);
    expect(result.scenarioHitRate).toBeCloseTo(0.5);
    expect(result.scenarioBrierScore).toBeCloseTo(0.3);
  });

  it('aggregateScenarioMetrics returns zeros for empty input', () => {
    expect(aggregateScenarioMetrics([])).toEqual({
      scenarioHitRate: 0,
      scenarioBrierScore: 0,
      scenarioCalibrationError: 0,
      scenarioRankAccuracy: 0,
    });
  });
});

describe('scenarioCalibration', () => {
  it('scenarioCalibrationError computes mean absolute error', () => {
    expect(scenarioCalibrationError([0.6, 0.3, 0.1], [1, 0, 0])).toBeCloseTo(0.267, 2);
  });

  it('scenarioCalibrationError returns 1 for mismatched lengths', () => {
    expect(scenarioCalibrationError([0.5], [1, 0])).toBe(1);
  });

  it('scenarioBrierScore squares the delta', () => {
    expect(scenarioBrierScore(0.7, 1)).toBeCloseTo(0.09);
  });
});

describe('backtesting metrics', () => {
  it('brierScore averages squared errors', () => {
    expect(brierScore([0.6, 0.25, 0.15], [1, 0, 0])).toBeCloseTo(0.082, 2);
  });

  it('logLoss penalizes low outcome probability', () => {
    expect(logLoss([0.1, 0.45, 0.45], 0)).toBeGreaterThan(2);
  });
});

describe('buildScenarioExplanationFactors', () => {
  it('includes drivers and formatted probabilities', () => {
    const scenario = mockScenario();
    const factors = buildScenarioExplanationFactors(scenario);
    expect(factors[0]).toBe('Home pressing edge');
    expect(factors.some((f) => f.includes('Scenario likelihood'))).toBe(true);
    expect(factors.some((f) => f.includes('Conditional W/D/L'))).toBe(true);
  });
});

describe('runScenarioBacktest', () => {
  it('aggregates completed matches and stores artifacts', async () => {
    const put = vi.fn(async () => undefined);
    const runCalls: string[] = [];
    const env = createMockEnv({
      DB: createMockDb({
        all: () => ({
          results: [
            {
              id: 'm-1',
              home_score: 2,
              away_score: 1,
              home_win_prob: 0.55,
              draw_prob: 0.25,
              away_win_prob: 0.2,
            },
            {
              id: 'm-2',
              home_score: 0,
              away_score: 0,
              home_win_prob: 0.3,
              draw_prob: 0.4,
              away_win_prob: 0.3,
            },
          ],
        }),
        run: (sql) => {
          runCalls.push(sql);
          return { success: true };
        },
      }),
      R2_ARTIFACTS: { put } as never,
    });

    const report = await runScenarioBacktest(env, 2026);

    expect(report.matchCount).toBe(2);
    expect(report.metrics.scenarioHitRate).toBeGreaterThan(0);
    expect(report.calibrationBuckets.length).toBeGreaterThan(0);
    expect(put).toHaveBeenCalled();
    expect(runCalls.some((sql) => sql.includes('INSERT INTO model_runs'))).toBe(true);
  });

  it('handles no completed matches', async () => {
    const env = createMockEnv({
      DB: createMockDb({ all: () => ({ results: [] }) }),
      R2_ARTIFACTS: { put: vi.fn(async () => undefined) } as never,
    });
    const report = await runScenarioBacktest(env, 2022);
    expect(report.matchCount).toBe(0);
    expect(report.metrics.scenarioBrierScore).toBe(0);
  });
});

describe('runBacktest', () => {
  it('computes historical metrics from snapshots', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        all: () => ({
          results: [{ id: 'm-h1', home_score: 1, away_score: 0, year: 2022 }],
        }),
        first: () => ({
          home_win_prob: 0.6,
          draw_prob: 0.22,
          away_win_prob: 0.18,
        }),
        run: () => ({ success: true }),
      }),
    });

    const metrics = await runBacktest(env.DB);
    expect(metrics.matchCount).toBe(1);
    expect(metrics.brierScore).toBeGreaterThan(0);
    expect(metrics.logLoss).toBeGreaterThan(0);
  });
});
