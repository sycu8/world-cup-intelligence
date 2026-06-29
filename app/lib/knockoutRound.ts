import type { ScheduleMatch } from './api';
import { KNOCKOUT_STAGE_ORDER } from './i18n/stageLabels';

export type KnockoutStage = (typeof KNOCKOUT_STAGE_ORDER)[number];

export function isMatchFinished(status: string): boolean {
  return status === 'completed' || status === 'finished';
}

export function matchesForKnockoutStage(
  matches: ScheduleMatch[],
  stage: KnockoutStage,
): ScheduleMatch[] {
  return matches.filter((m) => m.stage === stage);
}

export function isKnockoutRoundComplete(matches: ScheduleMatch[], stage: KnockoutStage): boolean {
  const roundMatches = matchesForKnockoutStage(matches, stage);
  return roundMatches.length > 0 && roundMatches.every((m) => isMatchFinished(m.status));
}

export function knockoutRoundProgress(
  matches: ScheduleMatch[],
  stage: KnockoutStage,
): { done: number; total: number; live: number } {
  const roundMatches = matchesForKnockoutStage(matches, stage);
  const done = roundMatches.filter((m) => isMatchFinished(m.status)).length;
  const live = roundMatches.filter((m) => m.status === 'live').length;
  return { done, total: roundMatches.length, live };
}

/** Pick the round the tournament is currently in (live > upcoming > last completed). */
export function inferActiveKnockoutStage(
  matches: ScheduleMatch[],
  stageOrder: readonly KnockoutStage[] = KNOCKOUT_STAGE_ORDER,
): KnockoutStage | null {
  const presentStages = stageOrder.filter((stage) =>
    matches.some((m) => m.stage === stage),
  );
  if (presentStages.length === 0) return null;

  for (const stage of presentStages) {
    const roundMatches = matchesForKnockoutStage(matches, stage);
    if (roundMatches.some((m) => m.status === 'live')) return stage;
  }

  for (const stage of presentStages) {
    const roundMatches = matchesForKnockoutStage(matches, stage);
    if (roundMatches.some((m) => !isMatchFinished(m.status))) return stage;
  }

  return presentStages[presentStages.length - 1] ?? null;
}

export function areAllGroupsComplete(
  groups: Record<string, { complete: boolean }> | undefined,
  groupCodes: readonly string[],
): boolean {
  if (!groups) return false;
  return groupCodes.every((code) => groups[code]?.complete);
}
