import type { LeagueCatalogEntry } from '../../constants/leagues';
import { CAF_CL_ID, J1_LEAGUE_ID, LA_LIGA_ID, V_LEAGUE_ID } from '../../constants/leagues';
import type { ParsedLeagueMatch, ParsedLeagueNews, ParsedLeagueScorer, ParsedLeagueStanding } from './parseLeagueSources';

type Club = { id: string; name: string; short: string; abbr: string };

const LA_LIGA_CLUBS: Club[] = [
  { id: '86', name: 'Real Madrid', short: 'Real Madrid', abbr: 'RMA' },
  { id: '83', name: 'Barcelona', short: 'Barcelona', abbr: 'BAR' },
  { id: '1068', name: 'Atlético Madrid', short: 'Atlético', abbr: 'ATM' },
  { id: '93', name: 'Athletic Club', short: 'Athletic', abbr: 'ATH' },
  { id: '102', name: 'Villarreal', short: 'Villarreal', abbr: 'VIL' },
  { id: '89', name: 'Real Sociedad', short: 'Sociedad', abbr: 'RSO' },
  { id: '244', name: 'Real Betis', short: 'Betis', abbr: 'BET' },
  { id: '94', name: 'Valencia', short: 'Valencia', abbr: 'VAL' },
  { id: '243', name: 'Sevilla', short: 'Sevilla', abbr: 'SEV' },
  { id: '9812', name: 'Girona', short: 'Girona', abbr: 'GIR' },
];

const J1_CLUBS: Club[] = [
  { id: '2196', name: 'Vissel Kobe', short: 'Vissel Kobe', abbr: 'VIS' },
  { id: '2194', name: 'Yokohama F. Marinos', short: 'Yokohama FM', abbr: 'YFM' },
  { id: '2193', name: 'Kashima Antlers', short: 'Kashima', abbr: 'KAS' },
  { id: '2192', name: 'Urawa Red Diamonds', short: 'Urawa', abbr: 'URA' },
  { id: '7113', name: 'Kawasaki Frontale', short: 'Kawasaki', abbr: 'KAW' },
  { id: '2197', name: 'Sanfrecce Hiroshima', short: 'Sanfrecce', abbr: 'SAN' },
  { id: '2198', name: 'Gamba Osaka', short: 'Gamba', abbr: 'GAM' },
  { id: '7114', name: 'Cerezo Osaka', short: 'Cerezo', abbr: 'CER' },
  { id: '2195', name: 'FC Tokyo', short: 'FC Tokyo', abbr: 'FCT' },
  { id: '7115', name: 'Nagoya Grampus', short: 'Nagoya', abbr: 'NAG' },
];

const V_LEAGUE_CLUBS: Club[] = [
  { id: 'hanoi', name: 'Hà Nội FC', short: 'Hà Nội', abbr: 'HN' },
  { id: 'cah', name: 'Công an Hà Nội', short: 'CAHN', abbr: 'CAH' },
  { id: 'namdinh', name: 'Thép Xanh Nam Định', short: 'Nam Định', abbr: 'NĐ' },
  { id: 'hagl', name: 'Hoàng Anh Gia Lai', short: 'HAGL', abbr: 'GL' },
  { id: 'haiphong', name: 'Hải Phòng', short: 'Hải Phòng', abbr: 'HP' },
  { id: 'viettel', name: 'Thể Công-Viettel', short: 'Viettel', abbr: 'VT' },
  { id: 'binhduong', name: 'Becamex Bình Dương', short: 'Bình Dương', abbr: 'BD' },
  { id: 'slna', name: 'Sông Lam Nghệ An', short: 'SLNA', abbr: 'NA' },
  { id: 'thanhhoa', name: 'Đông Á Thanh Hóa', short: 'Thanh Hóa', abbr: 'TH' },
  { id: 'hcm', name: 'Hồ Chí Minh City', short: 'TP.HCM', abbr: 'HCM' },
];

const CAF_CLUBS: Club[] = [
  { id: 'ahly', name: 'Al Ahly', short: 'Al Ahly', abbr: 'AHL' },
  { id: 'pyramids', name: 'Pyramids', short: 'Pyramids', abbr: 'PYR' },
  { id: 'sundowns', name: 'Mamelodi Sundowns', short: 'Sundowns', abbr: 'SUN' },
  { id: 'esperance', name: 'Espérance de Tunis', short: 'Espérance', abbr: 'EST' },
  { id: 'wydad', name: 'Wydad AC', short: 'Wydad', abbr: 'WAC' },
  { id: 'raja', name: 'Raja Casablanca', short: 'Raja', abbr: 'RCA' },
  { id: 'mazembe', name: 'TP Mazembe', short: 'Mazembe', abbr: 'TPM' },
  { id: 'simba', name: 'Simba SC', short: 'Simba', abbr: 'SIM' },
];

function clubsFor(league: LeagueCatalogEntry): Club[] {
  if (league.id === LA_LIGA_ID) return LA_LIGA_CLUBS;
  if (league.id === J1_LEAGUE_ID) return J1_CLUBS;
  if (league.id === V_LEAGUE_ID) return V_LEAGUE_CLUBS;
  if (league.id === CAF_CL_ID) return CAF_CLUBS;
  return LA_LIGA_CLUBS;
}

function asTeam(club: Club, countryCode: string | null) {
  return {
    sourceId: club.id,
    name: club.name,
    shortName: club.short,
    abbreviation: club.abbr,
    crestUrl: null,
    countryCode,
  };
}

function kickoffHoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 3600_000).toISOString();
}

export function buildMockLeagueMatches(league: LeagueCatalogEntry): ParsedLeagueMatch[] {
  const clubs = clubsFor(league);
  const pairs: [number, number, ParsedLeagueMatch['status'], number, number, number][] = [
    [0, 1, 'live', 1, 0, 67],
    [2, 3, 'live', 0, 0, 23],
    [4, 5, 'scheduled', 0, 0, 0],
    [6, 7, 'scheduled', 0, 0, 0],
    [1, 2, 'completed', 2, 1, 90],
    [3, 4, 'completed', 1, 1, 90],
    [5, 6, 'completed', 0, 3, 90],
    [7, 0, 'completed', 2, 2, 90],
  ];
  const offsets = [-2, -1, 24, 48, -72, -96, -120, -144];
  return pairs.map(([hi, ai, status, hs, as, minute], index) => {
    const home = clubs[hi]!;
    const away = clubs[ai]!;
    const groupCode = league.format === 'groups_knockout' ? (index % 2 === 0 ? 'A' : 'B') : null;
    return {
      sourceEventId: `mock-${league.slug}-${index + 1}`,
      kickoffUtc: kickoffHoursFromNow(offsets[index] ?? 12),
      status,
      minute,
      home: asTeam(home, league.countryCode),
      away: asTeam(away, league.countryCode),
      homeScore: hs,
      awayScore: as,
      matchweek: 8,
      stage: groupCode ? 'Group' : 'Round 8',
      groupCode,
      venueName: null,
    };
  });
}

export function buildMockLeagueStandings(league: LeagueCatalogEntry): ParsedLeagueStanding[] {
  const clubs = clubsFor(league);
  return clubs.map((club, index) => {
    const played = 8;
    const won = Math.max(0, 7 - index);
    const drawn = index % 2;
    const lost = Math.max(0, played - won - drawn);
    const gf = 18 - index;
    const ga = 6 + index;
    const groupCode = league.format === 'groups_knockout' ? (index < clubs.length / 2 ? 'A' : 'B') : '';
    const rankInGroup =
      league.format === 'groups_knockout' ? (index % Math.ceil(clubs.length / 2)) + 1 : index + 1;
    return {
      groupCode,
      rank: rankInGroup,
      team: asTeam(club, league.countryCode),
      played,
      won,
      drawn,
      lost,
      gf,
      ga,
      gd: gf - ga,
      points: won * 3 + drawn,
    };
  });
}

export function buildMockLeagueScorers(league: LeagueCatalogEntry): ParsedLeagueScorer[] {
  const clubs = clubsFor(league);
  const names = ['Nguyễn Văn A', 'Sato Ken', 'Kylian Mbappé', 'Percy Tau', 'Vinícius Jr', 'Osako Yuya'];
  return names.slice(0, 5).map((playerName, index) => ({
    sourcePlayerId: `mock-p-${league.slug}-${index + 1}`,
    playerName,
    sourceTeamId: clubs[index]?.id ?? null,
    teamName: clubs[index]?.name ?? null,
    goals: 8 - index,
    rank: index + 1,
  }));
}

export function buildMockLeagueNews(league: LeagueCatalogEntry): ParsedLeagueNews[] {
  return [
    {
      title: `${league.name}: Matchday preview and model notes`,
      description: `PitchIntel preview for ${league.name} — form, standings pressure, and likely scorelines.`,
      url: `https://example.com/${league.slug}/preview`,
      publishedAt: new Date().toISOString(),
      imageUrl: null,
    },
    {
      title: `${league.shortName} round-up: live scores and table`,
      description: `Latest results and updated table for ${league.name}.`,
      url: `https://example.com/${league.slug}/roundup`,
      publishedAt: new Date(Date.now() - 3600_000).toISOString(),
      imageUrl: null,
    },
  ];
}
