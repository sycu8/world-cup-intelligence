import type { DisplayMode } from './I18nContext';
import type { LocaleKey } from './locales';

/** Knockout round order — keep in sync with src/services/bracketPayload.ts */
export const KNOCKOUT_STAGE_ORDER = [
  'Round of 32',
  'Round of 16',
  'Quarter-final',
  'Semi-final',
  'Third place',
  'Final',
] as const;

const STAGE_KEYS: Record<string, LocaleKey> = {
  Group: 'common.groupStage',
  'Round of 32': 'history.stageR32',
  'Round of 16': 'history.stageR16',
  'Quarter-final': 'history.stageQf',
  'Semi-final': 'history.stageSf',
  'Third place': 'history.stageThird',
  Final: 'history.stageFinal',
  R16: 'history.stageR16',
  R32: 'history.stageR32',
  QF: 'history.stageQf',
  SF: 'history.stageSf',
};

/** Localize match stage from D1/API values (Round of 32, Group, …). */
export function matchStageLabel(
  stage: string | null | undefined,
  t: (key: LocaleKey) => string,
): string {
  if (!stage) return t('history.matchStage');
  const key = STAGE_KEYS[stage];
  return key ? t(key) : stage;
}

/** Group stage label: "Bảng A" / "Group A". */
export function groupStageLabel(groupCode: string, t: (key: LocaleKey) => string): string {
  return `${t('calendar.groupLabel')} ${groupCode}`;
}

export function matchVersusSeparator(mode: DisplayMode): string {
  return mode === 'vi' ? ' gặp ' : ' vs ';
}

export function formatLocalizedVersus(home: string, away: string, mode: DisplayMode): string {
  if (!home && !away) return '';
  if (!home) return away;
  if (!away) return home;
  return `${home}${matchVersusSeparator(mode)}${away}`;
}
