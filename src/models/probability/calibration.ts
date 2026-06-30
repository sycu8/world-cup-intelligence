/** Tunable Poisson / Dixon-Coles parameters (fit via grid search on historical WC holdout). */
export type ProbabilityCalibration = {
  baseGoalRate: number;
  dixonColesRho: number;
  /** Post-matrix multiplier on draw probability mass (1 = unchanged). */
  drawInflation: number;
  /** Max attack-lambda boost per side when a team faces full group-stage points pressure. */
  groupPointsPressureMax: number;
  /** Draw-inflation reduction at full combined pressure on both sides. */
  groupPointsPressureDrawDampen: number;
};

/** wc-prob-v4 baseline (flat attack/defense product, fixed rho). */
export const CALIBRATION_V4: ProbabilityCalibration = {
  baseGoalRate: 1.35,
  dixonColesRho: -0.13,
  drawInflation: 1.0,
  groupPointsPressureMax: 0,
  groupPointsPressureDrawDampen: 0,
};

/** wc-prob-v5 — grid-search lock on WC 2018+2022 holdout (see calibrate-grid script). */
export const CALIBRATION: ProbabilityCalibration = {
  baseGoalRate: 1.35,
  dixonColesRho: -0.13,
  drawInflation: 0.97,
  groupPointsPressureMax: 0.05,
  groupPointsPressureDrawDampen: 0.035,
};

export type CalibrationOverrides = Partial<ProbabilityCalibration>;

export function mergeCalibration(overrides?: CalibrationOverrides): ProbabilityCalibration {
  if (!overrides) return { ...CALIBRATION };
  return { ...CALIBRATION, ...overrides };
}

export function mergeCalibrationV4(overrides?: CalibrationOverrides): ProbabilityCalibration {
  if (!overrides) return { ...CALIBRATION_V4 };
  return { ...CALIBRATION_V4, ...overrides };
}
