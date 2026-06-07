/** Knockout slot placeholders use country_code XX in the WC 2026 seed. */
export function isPlaceholderTeam(countryCode?: string | null): boolean {
  return countryCode?.trim().toUpperCase() === 'XX';
}
