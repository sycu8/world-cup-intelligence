import type { LocaleKey } from './i18n/locales';

export function lineupSourceLocaleKey(source: string): LocaleKey {
  switch (source) {
    case 'official':
      return 'match.lineupOfficial';
    case 'squad':
      return 'match.lineupSquad';
    case 'projected':
      return 'match.lineupProjected';
    default:
      return 'match.lineupUnknown';
  }
}

export function lineupSourceBadgeClass(source: string): string {
  switch (source) {
    case 'official':
      return 'border-green/40 bg-green/10 text-green';
    case 'squad':
      return 'border-cyan/40 bg-cyan/10 text-cyan';
    case 'projected':
      return 'border-yellow/40 bg-yellow/10 text-yellow';
    default:
      return 'border-border/50 bg-panel2/40 text-muted';
  }
}
