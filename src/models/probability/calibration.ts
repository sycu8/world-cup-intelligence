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
  /** Max attack-lambda boost per side at full knockout competitive spirit. */
  knockoutSpiritMax: number;
  /** Draw-inflation reduction when both sides play to win (not settle for a draw). */
  knockoutSpiritDrawDampen: number;
};

export const CALIBRATION: ProbabilityCalibration = {
  baseGoalRate: 1.32,
  dixonColesRho: -0.15,
  drawInflation: 1.04,
  groupPointsPressureMax: 0.07,
  groupPointsPressureDrawDampen: 0.035,
  knockoutSpiritMax: 0.13,
  knockoutSpiritDrawDampen: 0.15,
};

export type CalibrationOverrides = Partial<ProbabilityCalibration>;

export function mergeCalibration(overrides?: CalibrationOverrides): ProbabilityCalibration {
  if (!overrides) return { ...CALIBRATION };
  return { ...CALIBRATION, ...overrides };
}
