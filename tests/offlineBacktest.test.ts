import { describe, expect, it } from 'vitest';
import { computeProbability } from '../src/models/probability/engine';
import { CALIBRATION } from '../src/models/probability/calibration';
import {
  aggregateOfflineBacktest,
  type OfflineBacktestSample,
} from '../src/models/backtesting/offlineBacktest';
import {
  buildCalibrationGrid,
  calibrationObjective,
  pickBestCalibration,
  scoreCalibrationCandidate,
} from '../src/models/probability/calibrateGrid';
import type { MatchFeatureInput, TeamFeatures } from '../src/models/probability/types';

function miniTeam(id: string, strength: number): TeamFeatures {
  return {
    teamId: id,
    eloRating: 1500 + strength * 400,
    fifaRanking: 40,
    recentForm: strength,
    goalDifference: 0,
    xgDifference: 0,
    xgFor: 1.1 + strength * 0.4,
    xgAgainst: 1.2 - strength * 0.3,
    possessionProfile: 0.5,
    fieldTilt: 0.5,
    ppda: 9,
    highTurnovers: 0.5,
    transitionThreat: 0.5,
    setPieceXg: 0.2,
    setPieceXga: 0.18,
    defensiveCompactness: strength,
    formationStability: strength,
    benchDepth: strength,
    goalkeeperStrength: strength,
    restDays: 4,
  };
}

function miniInput(homeStrength: number, awayStrength: number): MatchFeatureInput {
  return {
    matchId: 'm-test',
    tournamentYear: 2026,
    stage: 'Group',
    minute: 0,
    second: 0,
    homeTeam: miniTeam('h', homeStrength),
    awayTeam: miniTeam('a', awayStrength),
    currentScore: { home: 0, away: 0 },
    sourceConfidence: 0.85,
    homeFormMatchesPlayed: 4,
    awayFormMatchesPlayed: 4,
  };
}

describe('offlineBacktest aggregation', () => {
  it('aggregates scoreline and favorite metrics', () => {
    const samples: OfflineBacktestSample[] = [
      {
        matchId: 'm1',
        tournamentYear: 2018,
        actualScore: '2-0',
        mostLikelyScore: '2-0',
        favoriteHit: true,
        scorelineTop1Hit: true,
        scorelineTop3Hit: true,
        actualScoreProb: 0.14,
        brierScore: 0.2,
        logLoss: 0.4,
        modelVersion: 'wc-prob-v5',
        favoriteProb: 0.62,
      },
      {
        matchId: 'm2',
        tournamentYear: 2018,
        actualScore: '1-1',
        mostLikelyScore: '2-0',
        favoriteHit: false,
        scorelineTop1Hit: false,
        scorelineTop3Hit: true,
        actualScoreProb: 0.09,
        brierScore: 0.5,
        logLoss: 0.8,
        modelVersion: 'wc-prob-v5',
        favoriteProb: 0.58,
      },
    ];

    const report = aggregateOfflineBacktest(samples, [2018]);
    expect(report.matchCount).toBe(2);
    expect(report.favoriteHitRate).toBe(0.5);
    expect(report.scorelineTop1Rate).toBe(0.5);
    expect(report.scorelineTop3Rate).toBe(1);
    expect(report.calibrationBuckets.length).toBeGreaterThan(0);
  });
});

describe('calibrateGrid', () => {
  it('scores lower when top-3 rate is higher at same brier', () => {
    const better = calibrationObjective({
      modelVersion: 'wc-prob-v5',
      evaluatedAt: '',
      years: [2022],
      matchCount: 10,
      favoriteHitRate: 0.55,
      scorelineTop1Rate: 0.1,
      scorelineTop3Rate: 0.35,
      avgBrier: 0.4,
      avgActualScoreProb: 0.1,
      avgLogLoss: 0.8,
      calibrationBuckets: [],
      samples: [],
    });
    const worse = calibrationObjective({
      modelVersion: 'wc-prob-v5',
      evaluatedAt: '',
      years: [2022],
      matchCount: 10,
      favoriteHitRate: 0.55,
      scorelineTop1Rate: 0.1,
      scorelineTop3Rate: 0.2,
      avgBrier: 0.4,
      avgActualScoreProb: 0.08,
      avgLogLoss: 0.8,
      calibrationBuckets: [],
      samples: [],
    });
    expect(better).toBeLessThan(worse);
  });

  it('builds a non-empty calibration grid', () => {
    expect(buildCalibrationGrid().length).toBeGreaterThan(10);
  });

  it('picks best candidate by objective score', () => {
    const a = scoreCalibrationCandidate(CALIBRATION, {
      modelVersion: 'wc-prob-v5',
      evaluatedAt: '',
      years: [2022],
      matchCount: 5,
      favoriteHitRate: 0.5,
      scorelineTop1Rate: 0.1,
      scorelineTop3Rate: 0.3,
      avgBrier: 0.45,
      avgActualScoreProb: 0.1,
      avgLogLoss: 0.7,
      calibrationBuckets: [],
      samples: [],
    });
    const b = scoreCalibrationCandidate(
      { ...CALIBRATION, drawInflation: 1.2 },
      {
        modelVersion: 'wc-prob-v5',
        evaluatedAt: '',
        years: [2022],
        matchCount: 5,
        favoriteHitRate: 0.4,
        scorelineTop1Rate: 0.05,
        scorelineTop3Rate: 0.15,
        avgBrier: 0.55,
        avgActualScoreProb: 0.06,
        avgLogLoss: 0.9,
        calibrationBuckets: [],
        samples: [],
      },
    );
    expect(pickBestCalibration([b, a])?.drawInflation).toBe(CALIBRATION.drawInflation);
  });
});

describe('computeProbability calibration overrides', () => {
  it('accepts calibration overrides without throwing', async () => {
    const base = await computeProbability(miniInput(0.8, 0.5));
    const tuned = await computeProbability(miniInput(0.8, 0.5), {
      baseGoalRate: 1.25,
      dixonColesRho: -0.18,
    });
    expect(base.modelVersion).toBe('wc-prob-v5');
    expect(tuned.drawProb).not.toBeNaN();
  });
});
