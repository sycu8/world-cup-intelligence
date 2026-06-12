export const FIFA_API_BASE = 'https://api.fifa.com/api/v3';
export const WC2026_COMPETITION_ID = '17';
export const WC2026_SEASON_ID = '285023';
export const WC2026_TOURNAMENT_ID = 't-2026';

/** Public page — same data via FIFA Match Centre API below. */
export const FIFA_SCORES_FIXTURES_URL =
  'https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures';

export const WC2026_FIXTURES_FROM_ISO = '2026-06-01T00:00:00Z';
export const WC2026_FIXTURES_TO_ISO = '2026-07-20T23:59:59Z';
export const FIFA_SOURCE_ID = 'src-fifa';

/** FIFA country codes that differ from our team names. */
export const FIFA_TEAM_NAME_ALIASES: Record<string, string> = {
  RSA: 'South Africa',
  USA: 'United States',
  KOR: 'Korea Republic',
  IRN: 'IR Iran',
  NZL: 'New Zealand',
  CIV: "Côte d'Ivoire",
  COD: 'Congo DR',
  CPV: 'Cabo Verde',
};
