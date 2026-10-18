import { describe, expect, it } from 'vitest';
import { evaluateAcceptanceGates } from '../src/models/backtesting/acceptanceGates';
import type { OfflineBacktestReport } from '../src/models/backtesting/offlineBacktest';

function stubReport(overrides: Partial<OfflineBacktestReport>): OfflineBacktestReport {
  return {
    modelVersion: 'test',
    evaluatedAt: '',
    years: [2022],
    matchCount: 10,
    favoriteHitRate: 0.5,
    scorelineTop1Rate: 0.1,
    scorelineTop3Rate: 0.25,
    avgBrier: 0.45,
    avgActualScoreProb: 0.1,
    avgLogLoss: 0.8,
    calibrationBuckets: [],
    samples: [],
    ...overrides,
  };
}

describe('acceptanceGates', () => {
  it('passes when v5 improves top-3 without regressing Brier or favorite rate', () => {
    const v4 = stubReport({
      favoriteHitRate: 0.52,
      scorelineTop3Rate: 0.28,
      avgBrier: 0.44,
    });
    const v5 = stubReport({
      favoriteHitRate: 0.54,
      scorelineTop3Rate: 0.32,
      avgBrier: 0.43,
    });
    const result = evaluateAcceptanceGates(v4, v5);
    expect(result.passed).toBe(true);
    expect(result.gates.every((g) => g.passed)).toBe(true);
  });

  it('fails when v5 top-3 does not beat v4', () => {
    const v4 = stubReport({ scorelineTop3Rate: 0.3 });
    const v5 = stubReport({ scorelineTop3Rate: 0.28 });
    const result = evaluateAcceptanceGates(v4, v5);
    expect(result.passed).toBe(false);
    expect(result.gates.find((g) => g.name === 'scorelineTop3Rate')?.passed).toBe(false);
  });
});
