import { FIFA_TEAM_NAME_ALIASES } from './constants';

export type FifaLocalized = { Locale?: string; Description?: string };

export function fifaLocalizedName(names?: FifaLocalized[] | null): string {
  if (!names?.length) return '';
  const en =
    names.find((n) => n.Locale?.toLowerCase().startsWith('en'))?.Description ??
    names[0]?.Description ??
    '';
  return en.trim();
}

export function normalizeTeamName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function fifaCountryToTeamName(countryCode: string | null | undefined, fallback: string): string {
  if (countryCode && FIFA_TEAM_NAME_ALIASES[countryCode]) return FIFA_TEAM_NAME_ALIASES[countryCode];
  return fallback;
}

/** Parse FIFA MatchTime strings like "67'", "90'+2'", "98'". */
export function parseFifaMinute(matchTime: string | null | undefined): number {
  if (!matchTime) return 0;
  const cleaned = matchTime.replace(/'/g, '').trim();
  const plus = cleaned.indexOf('+');
  if (plus >= 0) {
    const base = Number.parseInt(cleaned.slice(0, plus), 10);
    const extra = Number.parseInt(cleaned.slice(plus + 1), 10);
    if (Number.isFinite(base) && Number.isFinite(extra)) return base + extra;
  }
  const n = Number.parseInt(cleaned, 10);
  return Number.isFinite(n) ? n : 0;
}

export type FifaMatchStatusInput = {
  MatchStatus?: number | null;
  Period?: number | null;
  MatchTime?: string | null;
};

/** Map FIFA live payload to platform match status. */
export function resolveFifaPlatformStatus(input: FifaMatchStatusInput): 'scheduled' | 'live' | 'completed' {
  const minute = parseFifaMinute(input.MatchTime);
  const period = input.Period ?? 0;
  const ms = input.MatchStatus ?? 1;

  if (period >= 10 || (ms === 0 && minute >= 90)) return 'completed';
  if (minute > 0 || (ms > 1 && ms < 8)) return 'live';
  return 'scheduled';
}

export function periodLabel(period: number | null | undefined): string {
  if (period === 3) return '1H';
  if (period === 4) return 'HT';
  if (period === 5) return '2H';
  if (period === 6) return 'ET1';
  if (period === 7) return 'ET2';
  if (period === 8) return 'PEN';
  if (period === 10) return 'FT';
  return minutePeriod(parseFifaMinute(null));
}

function minutePeriod(minute: number): string {
  if (minute <= 45) return '1H';
  if (minute <= 90) return '2H';
  return 'ET';
}

/** @internal exported for unit tests */
export { minutePeriod };
