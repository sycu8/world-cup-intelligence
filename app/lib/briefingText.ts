import type { DisplayMode } from './i18n/I18nContext';

export type LocalizedString = string | { vi: string; en: string };

export function normalizeLocalized(value: LocalizedString, fallbackEn?: string): { vi: string; en: string } {
  if (typeof value === 'string') {
    return { vi: value, en: fallbackEn ?? value };
  }
  return { vi: value.vi, en: value.en };
}

/** English lead sentence of the statistical draft in `fallbackBriefing`. */
export const STATISTICAL_DRAFT_SUMMARY_PREFIX = 'Tactical analysis from the statistical model';

export function isStatisticalDraftSummary(value: LocalizedString): boolean {
  return normalizeLocalized(value).en.startsWith(STATISTICAL_DRAFT_SUMMARY_PREFIX);
}

export function pickLocalized(
  value: LocalizedString,
  mode: DisplayMode,
  fallbackEn?: string,
): string {
  const { vi, en } = normalizeLocalized(value, fallbackEn);
  if (mode === 'en') return en.trim() ? en : vi;
  return vi.trim() ? vi : en;
}

/** Display lines with a blank preferred side filled from the other side, empties dropped. */
export function visibleBriefingLines(values: LocalizedString[], mode: DisplayMode): string[] {
  return values.map((value) => pickLocalized(value, mode).trim()).filter((line) => line.length > 0);
}
