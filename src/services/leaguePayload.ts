import type { AppEnv } from '../env';
import {
  ALL_LEAGUE_CATALOG,
  CLUB_LEAGUES,
  REGION_LABELS,
  WORLD_CUP_CATALOG,
  getLeagueBySlug,
  type LeagueCatalogEntry,
  type LeagueRegion,
} from '../constants/leagues';
import { WC2026_TOURNAMENT_ID } from '../constants/tournament';
import { attachSlugToScheduleRow } from './matchRef';
import { fetchHotNewsArticlesForTournament } from './newsListPayload';
import { buildSchedulePayload } from './schedulePayload';
import * as probabilityRepo from '../db/repositories/probabilityRepo';

export type LeagueCatalogCard = LeagueCatalogEntry & {
  regionLabel: { vi: string; en: string };
  liveCount: number;
  upcomingCount: number;
  completedCount: number;
  href: string;
};

export type LeagueStandingView = {
  groupCode: string;
  rank: number;
  teamId: string;
  teamName: string;
  shortName: string | null;
  countryCode: string | null;
  crestUrl: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
};

export type LeagueHubPayload = {
  league: LeagueCatalogEntry;
  regionLabel: { vi: string; en: string };
  standings: Record<string, LeagueStandingView[]>;
  live: unknown[];
  upcoming: unknown[];
  results: unknown[];
  matchProbabilities: Record<string, { homeWin: number; draw: number; awayWin: number; mostLikelyScore?: string }>;
  news: Awaited<ReturnType<typeof fetchHotNewsArticlesForTournament>>;
  topScorers: {
    rank: number;
    playerId: string;
    playerName: string;
    teamId: string | null;
    teamName: string | null;
    goals: number;
  }[];
  teams: { id: string; name: string; shortName: string | null; countryCode: string | null }[];
  lastSync: string | null;
};

async function countByStatus(env: AppEnv, tournamentId: string): Promise<{
  live: number;
  upcoming: number;
  completed: number;
}> {
  const { results } = await env.DB.prepare(
    `SELECT status, COUNT(*) AS n FROM matches WHERE tournament_id = ? GROUP BY status`,
  )
    .bind(tournamentId)
    .all<{ status: string; n: number }>();
  const counts = { live: 0, upcoming: 0, completed: 0 };
  for (const row of results ?? []) {
    const n = Number(row.n ?? 0);
    if (row.status === 'live') counts.live += n;
    else if (row.status === 'scheduled') counts.upcoming += n;
    else if (row.status === 'completed' || row.status === 'finished') counts.completed += n;
  }
  return counts;
}

export async function buildLeagueCatalogPayload(env: AppEnv): Promise<{
  featured: LeagueCatalogCard;
  regions: { region: LeagueRegion; label: { vi: string; en: string }; leagues: LeagueCatalogCard[] }[];
  leagues: LeagueCatalogCard[];
}> {
  const cards: LeagueCatalogCard[] = [];
  for (const league of ALL_LEAGUE_CATALOG) {
    const counts = await countByStatus(env, league.id);
    cards.push({
      ...league,
      regionLabel: REGION_LABELS[league.region],
      liveCount: counts.live,
      upcomingCount: counts.upcoming,
      completedCount: counts.completed,
      href: league.format === 'world_cup' ? '/' : `/leagues/${league.slug}`,
    });
  }

  const regions = (['vietnam', 'japan', 'europe', 'africa'] as LeagueRegion[]).map((region) => ({
    region,
    label: REGION_LABELS[region],
    leagues: cards.filter((c) => c.region === region),
  }));

  return {
    featured: cards.find((c) => c.id === WORLD_CUP_CATALOG.id) ?? cards[0]!,
    regions,
    leagues: cards.filter((c) => c.format !== 'world_cup'),
  };
}

export async function buildLeagueHubPayload(env: AppEnv, slug: string): Promise<LeagueHubPayload | null> {
  const league = getLeagueBySlug(slug);
  if (!league || league.format === 'world_cup') return null;

  const [standingsResult, schedule, news, scorersResult, teamsResult, snapshots, lastSync] = await Promise.all([
    env.DB.prepare(
      `SELECT r.*, t.name AS team_name, t.short_name, t.country_code, t.crest_url
       FROM league_table_rows r
       JOIN teams t ON t.id = r.team_id
       WHERE r.tournament_id = ?
       ORDER BY r.group_code ASC, r.rank ASC`,
    )
      .bind(league.id)
      .all<{
        group_code: string;
        rank: number;
        team_id: string;
        team_name: string;
        short_name: string | null;
        country_code: string | null;
        crest_url: string | null;
        played: number;
        won: number;
        drawn: number;
        lost: number;
        gf: number;
        ga: number;
        gd: number;
        points: number;
      }>(),
    buildSchedulePayload(env, league.id),
    fetchHotNewsArticlesForTournament(env, league.id, 8),
    env.DB.prepare(
      `SELECT player_id, player_name, team_id, team_name, goals, rank
       FROM league_scorers
       WHERE tournament_id = ?
       ORDER BY rank ASC, goals DESC
       LIMIT 12`,
    )
      .bind(league.id)
      .all<{
        player_id: string;
        player_name: string;
        team_id: string | null;
        team_name: string | null;
        goals: number;
        rank: number | null;
      }>(),
    env.DB.prepare(
      `SELECT t.id, t.name, t.short_name, t.country_code
       FROM teams t
       INNER JOIN league_table_rows r ON r.team_id = t.id
       WHERE r.tournament_id = ?
       GROUP BY t.id
       ORDER BY MIN(r.rank) ASC`,
    )
      .bind(league.id)
      .all<{ id: string; name: string; short_name: string | null; country_code: string | null }>(),
    probabilityRepo.listLatestSnapshotsForTournament(env.DB, league.id),
    env.KV.get('meta:last_league_sync'),
  ]);

  const standings: Record<string, LeagueStandingView[]> = {};
  for (const row of standingsResult.results ?? []) {
    const key = row.group_code || 'table';
    if (!standings[key]) standings[key] = [];
    standings[key].push({
      groupCode: row.group_code,
      rank: row.rank,
      teamId: row.team_id,
      teamName: row.team_name,
      shortName: row.short_name,
      countryCode: row.country_code,
      crestUrl: row.crest_url,
      played: row.played,
      won: row.won,
      drawn: row.drawn,
      lost: row.lost,
      gf: row.gf,
      ga: row.ga,
      gd: row.gd,
      points: row.points,
    });
  }

  const matches = schedule.data.matches as Array<Record<string, unknown> & { status: string; id: string }>;
  const live = matches.filter((m) => m.status === 'live').map((m) => attachSlugToScheduleRow(m));
  const upcoming = matches
    .filter((m) => m.status === 'scheduled')
    .slice(0, 12)
    .map((m) => attachSlugToScheduleRow(m));
  const results = matches
    .filter((m) => m.status === 'completed' || m.status === 'finished')
    .slice(-12)
    .reverse()
    .map((m) => attachSlugToScheduleRow(m));

  const matchProbabilities: LeagueHubPayload['matchProbabilities'] = {};
  for (const snap of snapshots) {
    matchProbabilities[snap.matchId] = {
      homeWin: snap.homeWinProb,
      draw: snap.drawProb,
      awayWin: snap.awayWinProb,
    };
  }

  return {
    league,
    regionLabel: REGION_LABELS[league.region],
    standings,
    live,
    upcoming,
    results,
    matchProbabilities,
    news,
    topScorers: (scorersResult.results ?? []).map((row, index) => ({
      rank: row.rank ?? index + 1,
      playerId: row.player_id,
      playerName: row.player_name,
      teamId: row.team_id,
      teamName: row.team_name,
      goals: row.goals,
    })),
    teams: (teamsResult.results ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      shortName: t.short_name,
      countryCode: t.country_code,
    })),
    lastSync,
  };
}

export { CLUB_LEAGUES, WC2026_TOURNAMENT_ID };
