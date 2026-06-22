/** Tunable Poisson / Dixon-Coles parameters (fit via grid search on historical WC holdout). */
export type ProbabilityCalibration = {
  baseGoalRate: number;
  dixonColesRho: number;
  /** Post-matrix multiplier on draw probability mass (1 = unchanged). */
  drawInflation: number;
};

export const CALIBRATION: ProbabilityCalibration = {
  baseGoalRate: 1.32,
  dixonColesRho: -0.15,
  drawInflation: 1.04,
};

export type CalibrationOverrides = Partial<ProbabilityCalibration>;

export function mergeCalibration(overrides?: CalibrationOverrides): ProbabilityCalibration {
  if (!overrides) return { ...CALIBRATION };
  return { ...CALIBRATION, ...overrides };
}
