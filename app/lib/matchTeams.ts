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
): string {
  const home = resolveTeamDisplayName(homeTeamId, homeName);
  const away = resolveTeamDisplayName(awayTeamId, awayName);
  if (!home && !away) return '';
  return `${home} vs ${away}`;
}
