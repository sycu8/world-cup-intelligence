import type { CalibrationOverrides, ProbabilityCalibration } from '../probability/calibration';
import type { OfflineBacktestReport } from '../backtesting/offlineBacktest';

export type GridSearchCandidate = ProbabilityCalibration & {
  score: number;
  report: Pick<
    OfflineBacktestReport,
    | 'favoriteHitRate'
    | 'scorelineTop1Rate'
    | 'scorelineTop3Rate'
    | 'avgBrier'
    | 'avgActualScoreProb'
    | 'matchCount'
  >;
};

/** Lower is better — balances Brier with top-3 scoreline accuracy. */
export function calibrationObjective(report: OfflineBacktestReport): number {
  const brier = report.avgBrier ?? 1;
  const top3 = report.scorelineTop3Rate ?? 0;
  const favorite = report.favoriteHitRate ?? 0;
  return brier - top3 * 0.35 - favorite * 0.1;
}

export function scoreCalibrationCandidate(
  calibration: ProbabilityCalibration,
  report: OfflineBacktestReport,
): GridSearchCandidate {
  return {
    ...calibration,
    score: calibrationObjective(report),
    report: {
      matchCount: report.matchCount,
      favoriteHitRate: report.favoriteHitRate,
      scorelineTop1Rate: report.scorelineTop1Rate,
      scorelineTop3Rate: report.scorelineTop3Rate,
      avgBrier: report.avgBrier,
      avgActualScoreProb: report.avgActualScoreProb,
    },
  };
}

export function buildCalibrationGrid(): CalibrationOverrides[] {
  const baseRates = [1.22, 1.28, 1.32, 1.35, 1.38];
  const rhos = [-0.18, -0.15, -0.13, -0.1];
  const drawInflations = [1.0, 1.03, 1.05, 1.08];
  const grid: CalibrationOverrides[] = [];
  for (const baseGoalRate of baseRates) {
    for (const dixonColesRho of rhos) {
      for (const drawInflation of drawInflations) {
        grid.push({ baseGoalRate, dixonColesRho, drawInflation });
      }
    }
  }
  return grid;
}

export function pickBestCalibration(candidates: GridSearchCandidate[]): GridSearchCandidate | null {
  if (!candidates.length) return null;
  return [...candidates].sort((a, b) => a.score - b.score)[0] ?? null;
}
