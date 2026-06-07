/** Client-side fallback when API names are not loaded yet. */
export const TEAM_DISPLAY_NAMES: Record<string, string> = {
  'team-arg': 'Argentina',
  'team-fra': 'France',
  'team-usa': 'United States',
  'team-mex': 'Mexico',
  'team-bra': 'Brazil',
  'team-eng': 'England',
};

export function resolveTeamDisplayName(teamId: string | undefined, dbName?: string | null): string {
  if (dbName?.trim()) return dbName.trim();
  if (teamId && TEAM_DISPLAY_NAMES[teamId]) return TEAM_DISPLAY_NAMES[teamId];
  return teamId ?? '';
}

export function formatMatchVersus(
  homeTeamId: string | undefined,
  awayTeamId: string | undefined,
  homeName?: string | null,
  awayName?: string | null,
  separator = ' vs ',
): string {
  const home = resolveTeamDisplayName(homeTeamId, homeName);
  const away = resolveTeamDisplayName(awayTeamId, awayName);
  if (!home && !away) return '';
  if (!home) return away;
  if (!away) return home;
  return `${home}${separator}${away}`;
}

/** Shorter label for tight probability cards on mobile (full name in title/tooltip). */
const TEAM_COMPACT_LABELS: Record<string, string> = {
  'United States': 'USA',
  'South Korea': 'Hàn Quốc',
  'Saudi Arabia': 'Ả Rập',
  'Costa Rica': 'Costa Rica',
  Netherlands: 'Hà Lan',
  Switzerland: 'Thụy Sĩ',
};

export function compactTeamLabel(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  if (TEAM_COMPACT_LABELS[trimmed]) return TEAM_COMPACT_LABELS[trimmed];
  if (trimmed.length <= 11) return trimmed;
  const words = trimmed.split(/\s+/);
  if (words.length > 1 && words[0].length <= 10) return words[0];
  return trimmed.slice(0, 10);
}
