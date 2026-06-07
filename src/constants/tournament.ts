/** FIFA World Cup 2026 — sole tournament surfaced in the product */
export const WC2026_TOURNAMENT_ID = 't-2026';
export const WC2026_YEAR = 2026;
export const WC2026_MATCH_COUNT = 104;
/** Opening match kickoff — Mexico vs South Africa (FIFA official schedule) */
export const WC2026_TOURNAMENT_START = '2026-06-11T19:00:00Z';
export const WC2026_HOST_COUNTRIES = ['United States', 'Mexico', 'Canada'] as const;
export const WC2026_TEAMS_COUNT = 48;

export function isWc2026Tournament(tournamentId: string | null | undefined): boolean {
  return tournamentId === WC2026_TOURNAMENT_ID;
}

export function resolveScheduleTournamentId(requested: string | undefined): string {
  if (!requested || requested === WC2026_TOURNAMENT_ID) return WC2026_TOURNAMENT_ID;
  return WC2026_TOURNAMENT_ID;
}
