/**
 * Source of truth: FIFA World Cup 2026 official draw & schedule.
 * @see https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/match-schedule-fixtures-results-teams-stadiums
 */
import { nationMeta } from './nationIsoCodes.mjs';
import { kickoffUtcForFifaNumber } from './wc2026-vn-kickoffs.mjs';

/** @typedef {{ name: string; short: string; iso: string; confederation: string }} TeamMeta */

/** 12 groups × 4 teams (slot 1–4). */
export const GROUPS = {
  A: ['Mexico', 'South Africa', 'Korea Republic', 'Czechia'],
  B: ['Canada', 'Bosnia and Herzegovina', 'Qatar', 'Switzerland'],
  C: ['Haiti', 'Scotland', 'Brazil', 'Morocco'],
  D: ['United States', 'Paraguay', 'Australia', 'Türkiye'],
  E: ["Côte d'Ivoire", 'Ecuador', 'Germany', 'Curaçao'],
  F: ['Netherlands', 'Japan', 'Sweden', 'Tunisia'],
  G: ['IR Iran', 'New Zealand', 'Belgium', 'Egypt'],
  H: ['Saudi Arabia', 'Uruguay', 'Spain', 'Cabo Verde'],
  I: ['France', 'Senegal', 'Iraq', 'Norway'],
  J: ['Argentina', 'Algeria', 'Austria', 'Jordan'],
  K: ['Portugal', 'Congo DR', 'Uzbekistan', 'Colombia'],
  L: ['Ghana', 'Panama', 'England', 'Croatia'],
};

/** Confederation guess per nation (FIFA draw). */
export const CONFEDERATIONS = {
  Mexico: 'CONCACAF',
  'South Africa': 'CAF',
  'Korea Republic': 'AFC',
  Czechia: 'UEFA',
  Canada: 'CONCACAF',
  'Bosnia and Herzegovina': 'UEFA',
  Qatar: 'AFC',
  Switzerland: 'UEFA',
  Haiti: 'CONCACAF',
  Scotland: 'UEFA',
  Brazil: 'CONMEBOL',
  Morocco: 'CAF',
  'United States': 'CONCACAF',
  Paraguay: 'CONMEBOL',
  Australia: 'AFC',
  Türkiye: 'UEFA',
  "Côte d'Ivoire": 'CAF',
  Ecuador: 'CONMEBOL',
  Germany: 'UEFA',
  Curaçao: 'CONCACAF',
  Netherlands: 'UEFA',
  Japan: 'AFC',
  Sweden: 'UEFA',
  Tunisia: 'CAF',
  'IR Iran': 'AFC',
  'New Zealand': 'OFC',
  Belgium: 'UEFA',
  Egypt: 'CAF',
  'Saudi Arabia': 'AFC',
  Uruguay: 'CONMEBOL',
  Spain: 'UEFA',
  'Cabo Verde': 'CAF',
  France: 'UEFA',
  Senegal: 'CAF',
  Iraq: 'AFC',
  Norway: 'UEFA',
  Argentina: 'CONMEBOL',
  Algeria: 'CAF',
  Austria: 'UEFA',
  Jordan: 'AFC',
  Portugal: 'UEFA',
  'Congo DR': 'CAF',
  Uzbekistan: 'AFC',
  Colombia: 'CONMEBOL',
  Ghana: 'CAF',
  Panama: 'CONCACAF',
  England: 'UEFA',
  Croatia: 'UEFA',
};

/** Legacy reference team ids kept in historical seeds. */
export const LEGACY_TEAM_IDS = {
  'United States': 'team-usa',
  Mexico: 'team-mex',
  Argentina: 'team-arg',
  Brazil: 'team-bra',
  France: 'team-fra',
  England: 'team-eng',
};

/** 16 WC2026 host venues mapped to v-* ids. */
export const VENUES = [
  { id: 'v-mexico-city', name: 'Mexico City Stadium', city: 'Mexico City', country: 'Mexico', capacity: 87523, timezone: 'America/Mexico_City' },
  { id: 'v-guadalajara', name: 'Estadio Guadalajara', city: 'Guadalajara', country: 'Mexico', capacity: 49000, timezone: 'America/Mexico_City' },
  { id: 'v-monterrey', name: 'Estadio Monterrey', city: 'Monterrey', country: 'Mexico', capacity: 53500, timezone: 'America/Monterrey' },
  { id: 'v-toronto', name: 'Toronto Stadium', city: 'Toronto', country: 'Canada', capacity: 45000, timezone: 'America/Toronto' },
  { id: 'v-vancouver', name: 'BC Place Vancouver', city: 'Vancouver', country: 'Canada', capacity: 54500, timezone: 'America/Vancouver' },
  { id: 'v-los-angeles', name: 'Los Angeles Stadium', city: 'Inglewood', country: 'USA', capacity: 70000, timezone: 'America/Los_Angeles' },
  { id: 'v-sf-bay', name: 'San Francisco Bay Area Stadium', city: 'Santa Clara', country: 'USA', capacity: 68500, timezone: 'America/Los_Angeles' },
  { id: 'v-seattle', name: 'Seattle Stadium', city: 'Seattle', country: 'USA', capacity: 69000, timezone: 'America/Los_Angeles' },
  { id: 'v-dallas', name: 'Dallas Stadium', city: 'Arlington', country: 'USA', capacity: 80000, timezone: 'America/Chicago' },
  { id: 'v-kansas-city', name: 'Kansas City Stadium', city: 'Kansas City', country: 'USA', capacity: 76416, timezone: 'America/Chicago' },
  { id: 'v-houston', name: 'Houston Stadium', city: 'Houston', country: 'USA', capacity: 72220, timezone: 'America/Chicago' },
  { id: 'v-atlanta', name: 'Atlanta Stadium', city: 'Atlanta', country: 'USA', capacity: 71000, timezone: 'America/New_York' },
  { id: 'v-miami', name: 'Miami Stadium', city: 'Miami Gardens', country: 'USA', capacity: 64767, timezone: 'America/New_York' },
  { id: 'v-boston', name: 'Boston Stadium', city: 'Foxborough', country: 'USA', capacity: 65878, timezone: 'America/New_York' },
  { id: 'v-philadelphia', name: 'Philadelphia Stadium', city: 'Philadelphia', country: 'USA', capacity: 69796, timezone: 'America/New_York' },
  { id: 'v-metlife', name: 'New York New Jersey Stadium', city: 'East Rutherford', country: 'USA', capacity: 82500, timezone: 'America/New_York' },
];

/** @type {Record<string, string>} */
export const VENUE_ID_BY_NAME = Object.fromEntries(VENUES.map((v) => [v.name, v.id]));

/**
 * @param {string} group
 * @param {number} slot
 */
export function teamId(group, slot) {
  return `team-w26-${group.toLowerCase()}${slot}`;
}

/**
 * @param {string} group
 * @param {number} slotA
 * @param {number} slotB
 */
export function groupMatchId(group, slotA, slotB) {
  const lo = Math.min(slotA, slotB);
  const hi = Math.max(slotA, slotB);
  return `m-w26-g${group.toLowerCase()}-${lo}v${hi}`;
}

/**
 * @param {string} group
 * @param {string} teamName
 */
export function slotForTeam(group, teamName) {
  const idx = GROUPS[group].indexOf(teamName);
  if (idx === -1) {
    throw new Error(`Team ${teamName} not in group ${group}`);
  }
  return idx + 1;
}

/**
 * @param {string} name
 * @returns {TeamMeta & { id: string; group: string; slot: number }}
 */
export function teamRecord(name) {
  for (const [group, teams] of Object.entries(GROUPS)) {
    const slot = teams.indexOf(name) + 1;
    if (slot > 0) {
      const { iso, short } = nationMeta(name);
      return {
        id: teamId(group, slot),
        group,
        slot,
        name,
        short,
        iso,
        confederation: CONFEDERATIONS[name],
      };
    }
  }
  throw new Error(`Unknown team: ${name}`);
}

/** @returns {ReturnType<typeof teamRecord>[]} */
export function allTeams() {
  return Object.entries(GROUPS).flatMap(([group, teams]) =>
    teams.map((name, i) => {
      const { iso, short } = nationMeta(name);
      return {
        id: teamId(group, i + 1),
        group,
        slot: i + 1,
        name,
        short,
        iso,
        confederation: CONFEDERATIONS[name],
      };
    }),
  );
}

/**
 * 72 group-stage fixtures in FIFA publication order (matches 1–72).
 * Each entry: { fifaNumber, date, group, home, away, venueName }
 */
export const GROUP_STAGE_MATCHES = [
  { fifaNumber: 1, date: '2026-06-11', group: 'A', home: 'Mexico', away: 'South Africa', venueName: 'Mexico City Stadium' },
  { fifaNumber: 2, date: '2026-06-11', group: 'A', home: 'Korea Republic', away: 'Czechia', venueName: 'Estadio Guadalajara' },
  { fifaNumber: 3, date: '2026-06-12', group: 'B', home: 'Canada', away: 'Bosnia and Herzegovina', venueName: 'Toronto Stadium' },
  { fifaNumber: 4, date: '2026-06-12', group: 'D', home: 'United States', away: 'Paraguay', venueName: 'Los Angeles Stadium' },
  { fifaNumber: 5, date: '2026-06-13', group: 'C', home: 'Haiti', away: 'Scotland', venueName: 'Boston Stadium' },
  { fifaNumber: 6, date: '2026-06-13', group: 'D', home: 'Australia', away: 'Türkiye', venueName: 'BC Place Vancouver' },
  { fifaNumber: 7, date: '2026-06-13', group: 'C', home: 'Brazil', away: 'Morocco', venueName: 'New York New Jersey Stadium' },
  { fifaNumber: 8, date: '2026-06-13', group: 'B', home: 'Qatar', away: 'Switzerland', venueName: 'San Francisco Bay Area Stadium' },
  { fifaNumber: 9, date: '2026-06-14', group: 'E', home: "Côte d'Ivoire", away: 'Ecuador', venueName: 'Philadelphia Stadium' },
  { fifaNumber: 10, date: '2026-06-14', group: 'E', home: 'Germany', away: 'Curaçao', venueName: 'Houston Stadium' },
  { fifaNumber: 11, date: '2026-06-14', group: 'F', home: 'Netherlands', away: 'Japan', venueName: 'Dallas Stadium' },
  { fifaNumber: 12, date: '2026-06-14', group: 'F', home: 'Sweden', away: 'Tunisia', venueName: 'Estadio Monterrey' },
  { fifaNumber: 13, date: '2026-06-15', group: 'H', home: 'Saudi Arabia', away: 'Uruguay', venueName: 'Miami Stadium' },
  { fifaNumber: 14, date: '2026-06-15', group: 'H', home: 'Spain', away: 'Cabo Verde', venueName: 'Atlanta Stadium' },
  { fifaNumber: 15, date: '2026-06-15', group: 'G', home: 'IR Iran', away: 'New Zealand', venueName: 'Los Angeles Stadium' },
  { fifaNumber: 16, date: '2026-06-15', group: 'G', home: 'Belgium', away: 'Egypt', venueName: 'Seattle Stadium' },
  { fifaNumber: 17, date: '2026-06-16', group: 'I', home: 'France', away: 'Senegal', venueName: 'New York New Jersey Stadium' },
  { fifaNumber: 18, date: '2026-06-16', group: 'I', home: 'Iraq', away: 'Norway', venueName: 'Boston Stadium' },
  { fifaNumber: 19, date: '2026-06-16', group: 'J', home: 'Argentina', away: 'Algeria', venueName: 'Kansas City Stadium' },
  { fifaNumber: 20, date: '2026-06-16', group: 'J', home: 'Austria', away: 'Jordan', venueName: 'San Francisco Bay Area Stadium' },
  { fifaNumber: 21, date: '2026-06-17', group: 'L', home: 'Ghana', away: 'Panama', venueName: 'Toronto Stadium' },
  { fifaNumber: 22, date: '2026-06-17', group: 'L', home: 'England', away: 'Croatia', venueName: 'Dallas Stadium' },
  { fifaNumber: 23, date: '2026-06-17', group: 'K', home: 'Portugal', away: 'Congo DR', venueName: 'Houston Stadium' },
  { fifaNumber: 24, date: '2026-06-17', group: 'K', home: 'Uzbekistan', away: 'Colombia', venueName: 'Mexico City Stadium' },
  { fifaNumber: 25, date: '2026-06-18', group: 'A', home: 'Czechia', away: 'South Africa', venueName: 'Atlanta Stadium' },
  { fifaNumber: 26, date: '2026-06-18', group: 'B', home: 'Switzerland', away: 'Bosnia and Herzegovina', venueName: 'Los Angeles Stadium' },
  { fifaNumber: 27, date: '2026-06-18', group: 'B', home: 'Canada', away: 'Qatar', venueName: 'BC Place Vancouver' },
  { fifaNumber: 28, date: '2026-06-18', group: 'A', home: 'Mexico', away: 'Korea Republic', venueName: 'Estadio Guadalajara' },
  { fifaNumber: 29, date: '2026-06-19', group: 'C', home: 'Brazil', away: 'Haiti', venueName: 'Philadelphia Stadium' },
  { fifaNumber: 30, date: '2026-06-19', group: 'C', home: 'Scotland', away: 'Morocco', venueName: 'Boston Stadium' },
  { fifaNumber: 31, date: '2026-06-19', group: 'D', home: 'Türkiye', away: 'Paraguay', venueName: 'San Francisco Bay Area Stadium' },
  { fifaNumber: 32, date: '2026-06-19', group: 'D', home: 'United States', away: 'Australia', venueName: 'Seattle Stadium' },
  { fifaNumber: 33, date: '2026-06-20', group: 'E', home: 'Germany', away: "Côte d'Ivoire", venueName: 'Toronto Stadium' },
  { fifaNumber: 34, date: '2026-06-20', group: 'E', home: 'Ecuador', away: 'Curaçao', venueName: 'Kansas City Stadium' },
  { fifaNumber: 35, date: '2026-06-20', group: 'F', home: 'Netherlands', away: 'Sweden', venueName: 'Houston Stadium' },
  { fifaNumber: 36, date: '2026-06-20', group: 'F', home: 'Tunisia', away: 'Japan', venueName: 'Estadio Monterrey' },
  { fifaNumber: 37, date: '2026-06-21', group: 'H', home: 'Uruguay', away: 'Cabo Verde', venueName: 'Miami Stadium' },
  { fifaNumber: 38, date: '2026-06-21', group: 'H', home: 'Spain', away: 'Saudi Arabia', venueName: 'Atlanta Stadium' },
  { fifaNumber: 39, date: '2026-06-21', group: 'G', home: 'Belgium', away: 'IR Iran', venueName: 'Los Angeles Stadium' },
  { fifaNumber: 40, date: '2026-06-21', group: 'G', home: 'New Zealand', away: 'Egypt', venueName: 'BC Place Vancouver' },
  { fifaNumber: 41, date: '2026-06-22', group: 'I', home: 'Norway', away: 'Senegal', venueName: 'New York New Jersey Stadium' },
  { fifaNumber: 42, date: '2026-06-22', group: 'I', home: 'France', away: 'Iraq', venueName: 'Philadelphia Stadium' },
  { fifaNumber: 43, date: '2026-06-22', group: 'J', home: 'Argentina', away: 'Austria', venueName: 'Dallas Stadium' },
  { fifaNumber: 44, date: '2026-06-22', group: 'J', home: 'Jordan', away: 'Algeria', venueName: 'San Francisco Bay Area Stadium' },
  { fifaNumber: 45, date: '2026-06-23', group: 'L', home: 'England', away: 'Ghana', venueName: 'Boston Stadium' },
  { fifaNumber: 46, date: '2026-06-23', group: 'L', home: 'Panama', away: 'Croatia', venueName: 'Toronto Stadium' },
  { fifaNumber: 47, date: '2026-06-23', group: 'K', home: 'Portugal', away: 'Uzbekistan', venueName: 'Houston Stadium' },
  { fifaNumber: 48, date: '2026-06-23', group: 'K', home: 'Colombia', away: 'Congo DR', venueName: 'Estadio Guadalajara' },
  { fifaNumber: 49, date: '2026-06-24', group: 'C', home: 'Scotland', away: 'Brazil', venueName: 'Miami Stadium' },
  { fifaNumber: 50, date: '2026-06-24', group: 'C', home: 'Morocco', away: 'Haiti', venueName: 'Atlanta Stadium' },
  { fifaNumber: 51, date: '2026-06-24', group: 'B', home: 'Switzerland', away: 'Canada', venueName: 'BC Place Vancouver' },
  { fifaNumber: 52, date: '2026-06-24', group: 'B', home: 'Bosnia and Herzegovina', away: 'Qatar', venueName: 'Seattle Stadium' },
  { fifaNumber: 53, date: '2026-06-24', group: 'A', home: 'Czechia', away: 'Mexico', venueName: 'Mexico City Stadium' },
  { fifaNumber: 54, date: '2026-06-24', group: 'A', home: 'South Africa', away: 'Korea Republic', venueName: 'Estadio Monterrey' },
  { fifaNumber: 55, date: '2026-06-25', group: 'E', home: 'Curaçao', away: "Côte d'Ivoire", venueName: 'Philadelphia Stadium' },
  { fifaNumber: 56, date: '2026-06-25', group: 'E', home: 'Ecuador', away: 'Germany', venueName: 'New York New Jersey Stadium' },
  { fifaNumber: 57, date: '2026-06-25', group: 'F', home: 'Japan', away: 'Sweden', venueName: 'Dallas Stadium' },
  { fifaNumber: 58, date: '2026-06-25', group: 'F', home: 'Tunisia', away: 'Netherlands', venueName: 'Kansas City Stadium' },
  { fifaNumber: 59, date: '2026-06-25', group: 'D', home: 'Türkiye', away: 'United States', venueName: 'Los Angeles Stadium' },
  { fifaNumber: 60, date: '2026-06-25', group: 'D', home: 'Paraguay', away: 'Australia', venueName: 'San Francisco Bay Area Stadium' },
  { fifaNumber: 61, date: '2026-06-26', group: 'I', home: 'Norway', away: 'France', venueName: 'Boston Stadium' },
  { fifaNumber: 62, date: '2026-06-26', group: 'I', home: 'Senegal', away: 'Iraq', venueName: 'Toronto Stadium' },
  { fifaNumber: 63, date: '2026-06-26', group: 'G', home: 'Egypt', away: 'IR Iran', venueName: 'Seattle Stadium' },
  { fifaNumber: 64, date: '2026-06-26', group: 'G', home: 'New Zealand', away: 'Belgium', venueName: 'BC Place Vancouver' },
  { fifaNumber: 65, date: '2026-06-26', group: 'H', home: 'Cabo Verde', away: 'Saudi Arabia', venueName: 'Houston Stadium' },
  { fifaNumber: 66, date: '2026-06-26', group: 'H', home: 'Uruguay', away: 'Spain', venueName: 'Estadio Guadalajara' },
  { fifaNumber: 67, date: '2026-06-27', group: 'L', home: 'Panama', away: 'England', venueName: 'New York New Jersey Stadium' },
  { fifaNumber: 68, date: '2026-06-27', group: 'L', home: 'Croatia', away: 'Ghana', venueName: 'Philadelphia Stadium' },
  { fifaNumber: 69, date: '2026-06-27', group: 'J', home: 'Algeria', away: 'Austria', venueName: 'Kansas City Stadium' },
  { fifaNumber: 70, date: '2026-06-27', group: 'J', home: 'Jordan', away: 'Argentina', venueName: 'Dallas Stadium' },
  { fifaNumber: 71, date: '2026-06-27', group: 'K', home: 'Colombia', away: 'Portugal', venueName: 'Miami Stadium' },
  { fifaNumber: 72, date: '2026-06-27', group: 'K', home: 'Congo DR', away: 'Uzbekistan', venueName: 'Atlanta Stadium' },
];

/** 32 knockout fixtures (matches 73–104). Teams TBD until group stage completes. */
export const KNOCKOUT_MATCHES = [
  { fifaNumber: 73, date: '2026-06-28', stage: 'Round of 32', matchId: 'm-w26-r32-01', venueName: 'Los Angeles Stadium' },
  { fifaNumber: 74, date: '2026-06-29', stage: 'Round of 32', matchId: 'm-w26-r32-02', venueName: 'Boston Stadium' },
  { fifaNumber: 75, date: '2026-06-29', stage: 'Round of 32', matchId: 'm-w26-r32-03', venueName: 'Estadio Monterrey' },
  { fifaNumber: 76, date: '2026-06-29', stage: 'Round of 32', matchId: 'm-w26-r32-04', venueName: 'Houston Stadium' },
  { fifaNumber: 77, date: '2026-06-30', stage: 'Round of 32', matchId: 'm-w26-r32-05', venueName: 'New York New Jersey Stadium' },
  { fifaNumber: 78, date: '2026-06-30', stage: 'Round of 32', matchId: 'm-w26-r32-06', venueName: 'Dallas Stadium' },
  { fifaNumber: 79, date: '2026-06-30', stage: 'Round of 32', matchId: 'm-w26-r32-07', venueName: 'Mexico City Stadium' },
  { fifaNumber: 80, date: '2026-07-01', stage: 'Round of 32', matchId: 'm-w26-r32-08', venueName: 'Atlanta Stadium' },
  { fifaNumber: 81, date: '2026-07-01', stage: 'Round of 32', matchId: 'm-w26-r32-09', venueName: 'San Francisco Bay Area Stadium' },
  { fifaNumber: 82, date: '2026-07-01', stage: 'Round of 32', matchId: 'm-w26-r32-10', venueName: 'Seattle Stadium' },
  { fifaNumber: 83, date: '2026-07-02', stage: 'Round of 32', matchId: 'm-w26-r32-11', venueName: 'Toronto Stadium' },
  { fifaNumber: 84, date: '2026-07-02', stage: 'Round of 32', matchId: 'm-w26-r32-12', venueName: 'Los Angeles Stadium' },
  { fifaNumber: 85, date: '2026-07-02', stage: 'Round of 32', matchId: 'm-w26-r32-13', venueName: 'BC Place Vancouver' },
  { fifaNumber: 86, date: '2026-07-03', stage: 'Round of 32', matchId: 'm-w26-r32-14', venueName: 'Miami Stadium' },
  { fifaNumber: 87, date: '2026-07-03', stage: 'Round of 32', matchId: 'm-w26-r32-15', venueName: 'Kansas City Stadium' },
  { fifaNumber: 88, date: '2026-07-03', stage: 'Round of 32', matchId: 'm-w26-r32-16', venueName: 'Dallas Stadium' },
  { fifaNumber: 89, date: '2026-07-04', stage: 'Round of 16', matchId: 'm-w26-r16-01', venueName: 'Philadelphia Stadium' },
  { fifaNumber: 90, date: '2026-07-04', stage: 'Round of 16', matchId: 'm-w26-r16-02', venueName: 'Houston Stadium' },
  { fifaNumber: 91, date: '2026-07-05', stage: 'Round of 16', matchId: 'm-w26-r16-03', venueName: 'New York New Jersey Stadium' },
  { fifaNumber: 92, date: '2026-07-05', stage: 'Round of 16', matchId: 'm-w26-r16-04', venueName: 'Mexico City Stadium' },
  { fifaNumber: 93, date: '2026-07-06', stage: 'Round of 16', matchId: 'm-w26-r16-05', venueName: 'Dallas Stadium' },
  { fifaNumber: 94, date: '2026-07-06', stage: 'Round of 16', matchId: 'm-w26-r16-06', venueName: 'Seattle Stadium' },
  { fifaNumber: 95, date: '2026-07-07', stage: 'Round of 16', matchId: 'm-w26-r16-07', venueName: 'Atlanta Stadium' },
  { fifaNumber: 96, date: '2026-07-07', stage: 'Round of 16', matchId: 'm-w26-r16-08', venueName: 'BC Place Vancouver' },
  { fifaNumber: 97, date: '2026-07-09', stage: 'Quarter-final', matchId: 'm-w26-qf-01', venueName: 'Boston Stadium' },
  { fifaNumber: 98, date: '2026-07-10', stage: 'Quarter-final', matchId: 'm-w26-qf-02', venueName: 'Los Angeles Stadium' },
  { fifaNumber: 99, date: '2026-07-11', stage: 'Quarter-final', matchId: 'm-w26-qf-03', venueName: 'Miami Stadium' },
  { fifaNumber: 100, date: '2026-07-11', stage: 'Quarter-final', matchId: 'm-w26-qf-04', venueName: 'Kansas City Stadium' },
  { fifaNumber: 101, date: '2026-07-14', stage: 'Semi-final', matchId: 'm-w26-sf-01', venueName: 'Dallas Stadium' },
  { fifaNumber: 102, date: '2026-07-15', stage: 'Semi-final', matchId: 'm-w26-sf-02', venueName: 'Atlanta Stadium' },
  { fifaNumber: 103, date: '2026-07-18', stage: 'Third place', matchId: 'm-w26-3rd-01', venueName: 'Miami Stadium' },
  { fifaNumber: 104, date: '2026-07-19', stage: 'Final', matchId: 'm-w26-final-01', venueName: 'New York New Jersey Stadium' },
];

/**
 * Assign kickoff UTC from Thể Thao 247 Vietnam schedule (GMT+7).
 * @param {typeof GROUP_STAGE_MATCHES} matches
 */
export function assignGroupKickoffs(matches) {
  return matches.map((m) => ({
    ...m,
    kickoffUtc: kickoffUtcForFifaNumber(m.fifaNumber),
  }));
}

/**
 * Knockout kickoffs from VN schedule table (matches 73–104).
 * @param {typeof KNOCKOUT_MATCHES} matches
 */
export function assignKnockoutKickoffs(matches) {
  return matches.map((m) => ({
    ...m,
    kickoffUtc: kickoffUtcForFifaNumber(m.fifaNumber),
  }));
}

/** Resolved group fixtures with ids, team ids, venue ids, kickoffs. */
export function resolvedGroupMatches() {
  return assignGroupKickoffs(GROUP_STAGE_MATCHES).map((m) => {
    const homeSlot = slotForTeam(m.group, m.home);
    const awaySlot = slotForTeam(m.group, m.away);
    return {
      ...m,
      matchId: groupMatchId(m.group, homeSlot, awaySlot),
      homeTeamId: teamId(m.group, homeSlot),
      awayTeamId: teamId(m.group, awaySlot),
      venueId: VENUE_ID_BY_NAME[m.venueName],
    };
  });
}

/** Resolved knockout fixtures with venue ids and kickoffs. */
export function resolvedKnockoutMatches() {
  return assignKnockoutKickoffs(KNOCKOUT_MATCHES).map((m) => ({
    ...m,
    venueId: VENUE_ID_BY_NAME[m.venueName],
  }));
}

if (allTeams().length !== 48) {
  throw new Error(`Expected 48 teams, got ${allTeams().length}`);
}
if (GROUP_STAGE_MATCHES.length !== 72) {
  throw new Error(`Expected 72 group matches, got ${GROUP_STAGE_MATCHES.length}`);
}
if (KNOCKOUT_MATCHES.length !== 32) {
  throw new Error(`Expected 32 knockout matches, got ${KNOCKOUT_MATCHES.length}`);
}
