/** Club + continental competitions surfaced alongside FIFA World Cup 2026. */

export type LeagueRegion = 'vietnam' | 'japan' | 'europe' | 'africa' | 'world';
export type LeagueFormat = 'league_table' | 'groups_knockout' | 'world_cup';
export type LeagueNewsKeywordSet = readonly string[];

export type LeagueCatalogEntry = {
  id: string;
  slug: string;
  name: string;
  nameVi: string;
  shortName: string;
  shortNameVi: string;
  region: LeagueRegion;
  countryCode: string | null;
  format: LeagueFormat;
  season: string;
  year: number;
  /** ESPN soccer slug (`esp.1`). Null when ESPN coverage is unreliable. */
  espnSlug: string | null;
  /** TheSportsDB numeric league id — V.League fallback. */
  theSportsDbId: string | null;
  newsKeywords: LeagueNewsKeywordSet;
  accent: 'cyan' | 'magenta' | 'green' | 'yellow' | 'danger';
};

export const WORLD_CUP_2026_SLUG = 'world-cup-2026';

export const LA_LIGA_ID = 't-la-liga';
export const J1_LEAGUE_ID = 't-j1';
export const V_LEAGUE_ID = 't-vleague';
export const CAF_CL_ID = 't-caf-cl';

export const CLUB_LEAGUES: readonly LeagueCatalogEntry[] = [
  {
    id: V_LEAGUE_ID,
    slug: 'v-league-1',
    name: 'V.League 1',
    nameVi: 'V.League 1',
    shortName: 'V.League',
    shortNameVi: 'V.League',
    region: 'vietnam',
    countryCode: 'VN',
    format: 'league_table',
    season: '2026/27',
    year: 2026,
    espnSlug: 'vie.1',
    theSportsDbId: '4689',
    newsKeywords: ['v.league', 'v-league', 'vleague', 'giải vô địch quốc gia', 'bóng đá việt nam'],
    accent: 'danger',
  },
  {
    id: J1_LEAGUE_ID,
    slug: 'j1-league',
    name: 'J1 League',
    nameVi: 'J1 League',
    shortName: 'J1',
    shortNameVi: 'J1',
    region: 'japan',
    countryCode: 'JP',
    format: 'league_table',
    season: '2026',
    year: 2026,
    espnSlug: 'jpn.1',
    theSportsDbId: '4484',
    newsKeywords: ['j1', 'j-league', 'j.league', 'jleague', 'meiji yasuda'],
    accent: 'magenta',
  },
  {
    id: LA_LIGA_ID,
    slug: 'la-liga',
    name: 'La Liga',
    nameVi: 'La Liga',
    shortName: 'La Liga',
    shortNameVi: 'La Liga',
    region: 'europe',
    countryCode: 'ES',
    format: 'league_table',
    season: '2026/27',
    year: 2026,
    espnSlug: 'esp.1',
    theSportsDbId: '4335',
    newsKeywords: ['la liga', 'laliga', 'la liga ea', 'primera división', 'primera division'],
    accent: 'cyan',
  },
  {
    id: CAF_CL_ID,
    slug: 'caf-champions-league',
    name: 'CAF Champions League',
    nameVi: 'Cúp C1 châu Phi',
    shortName: 'CAF CL',
    shortNameVi: 'Cúp C1 châu Phi',
    region: 'africa',
    countryCode: null,
    format: 'groups_knockout',
    season: '2026/27',
    year: 2026,
    espnSlug: 'caf.champions',
    theSportsDbId: '4480',
    newsKeywords: [
      'caf champions',
      'caf cl',
      'champions league africa',
      'totalenergies caf',
      'caf champions league',
    ],
    accent: 'green',
  },
] as const;

export const WORLD_CUP_CATALOG: LeagueCatalogEntry = {
  id: 't-2026',
  slug: WORLD_CUP_2026_SLUG,
  name: 'FIFA World Cup 2026',
  nameVi: 'FIFA World Cup 2026',
  shortName: 'WC 2026',
  shortNameVi: 'WC 2026',
  region: 'world',
  countryCode: null,
  format: 'world_cup',
  season: '2026',
  year: 2026,
  espnSlug: 'fifa.world',
  theSportsDbId: null,
  newsKeywords: ['world cup', 'worldcup', 'wc 2026'],
  accent: 'yellow',
};

export const ALL_LEAGUE_CATALOG: readonly LeagueCatalogEntry[] = [
  WORLD_CUP_CATALOG,
  ...CLUB_LEAGUES,
];

export const REGION_ORDER: readonly LeagueRegion[] = ['vietnam', 'japan', 'europe', 'africa'];

export const REGION_LABELS: Record<LeagueRegion, { vi: string; en: string }> = {
  vietnam: { vi: 'Việt Nam', en: 'Vietnam' },
  japan: { vi: 'Nhật Bản', en: 'Japan' },
  europe: { vi: 'Châu Âu', en: 'Europe' },
  africa: { vi: 'Châu Phi', en: 'Africa' },
  world: { vi: 'Thế giới', en: 'World' },
};

const BY_ID = new Map(ALL_LEAGUE_CATALOG.map((l) => [l.id, l]));
const BY_SLUG = new Map(ALL_LEAGUE_CATALOG.map((l) => [l.slug, l]));

export function getLeagueById(id: string | null | undefined): LeagueCatalogEntry | undefined {
  if (!id) return undefined;
  return BY_ID.get(id);
}

export function getLeagueBySlug(slug: string | null | undefined): LeagueCatalogEntry | undefined {
  if (!slug) return undefined;
  return BY_SLUG.get(slug);
}

export function isClubLeagueTournamentId(id: string | null | undefined): boolean {
  if (!id) return false;
  return CLUB_LEAGUES.some((l) => l.id === id);
}

export function clubLeagueIds(): string[] {
  return CLUB_LEAGUES.map((l) => l.id);
}

export function teamIdPrefix(league: LeagueCatalogEntry): string {
  if (league.id === LA_LIGA_ID) return 'team-liga';
  if (league.id === J1_LEAGUE_ID) return 'team-j1';
  if (league.id === V_LEAGUE_ID) return 'team-vl';
  if (league.id === CAF_CL_ID) return 'team-caf';
  return 'team-lg';
}

export function matchIdPrefix(league: LeagueCatalogEntry): string {
  if (league.id === LA_LIGA_ID) return 'm-liga';
  if (league.id === J1_LEAGUE_ID) return 'm-j1';
  if (league.id === V_LEAGUE_ID) return 'm-vl';
  if (league.id === CAF_CL_ID) return 'm-caf';
  return 'm-lg';
}

export function clubTeamId(league: LeagueCatalogEntry, sourceTeamId: string): string {
  return `${teamIdPrefix(league)}-${sourceTeamId}`;
}

export function clubMatchId(league: LeagueCatalogEntry, sourceEventId: string): string {
  return `${matchIdPrefix(league)}-${sourceEventId}`;
}
