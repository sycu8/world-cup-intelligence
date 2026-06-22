export type H2hFeatures = {
  totalMatches: number;
  avgGoalsHome: number;
  avgGoalsAway: number;
};

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Nudge lambdas toward historical scoring pattern when teams have met before. */
export function h2hLambdaModifier(
  h2h: H2hFeatures | undefined,
  baseGoalRate: number,
): { home: number; away: number } {
  if (!h2h || h2h.totalMatches < 2) return { home: 1, away: 1 };

  const homeDelta = h2h.avgGoalsHome / baseGoalRate - 1;
  const awayDelta = h2h.avgGoalsAway / baseGoalRate - 1;
  const weight = Math.min(0.05, 0.02 + h2h.totalMatches * 0.005);

  return {
    home: 1 + clamp(homeDelta * weight, -0.05, 0.05),
    away: 1 + clamp(awayDelta * weight, -0.05, 0.05),
  };
}
