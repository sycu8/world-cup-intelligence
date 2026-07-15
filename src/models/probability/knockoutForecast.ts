/** Knockout-stage extra-time / penalty forecast derived from pre-match draw probability. */

export const KNOCKOUT_ET_DISPLAY_MIN = 0.12;
export const KNOCKOUT_PEN_DISPLAY_MIN = 0.08;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function isKnockoutMatchStage(stage: string | null | undefined): boolean {
  if (!stage || stage === 'Group') return false;
  return /Round|Final|Quarter|Semi|Third/i.test(stage);
}

export function knockoutExtraTimeProbability(
  drawProb: number,
  stage: string | null | undefined,
): number | undefined {
  if (!isKnockoutMatchStage(stage)) return undefined;
  return clamp01(drawProb * 0.85);
}

export function knockoutPenaltyProbability(
  drawProb: number,
  stage: string | null | undefined,
): number | undefined {
  if (!isKnockoutMatchStage(stage)) return undefined;
  return clamp01(drawProb * 0.35);
}
