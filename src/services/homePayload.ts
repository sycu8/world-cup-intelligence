import type { AppEnv } from '../env';
import {
  WC2026_HOST_COUNTRIES,
  WC2026_MATCH_COUNT,
  WC2026_TEAMS_COUNT,
  WC2026_TOURNAMENT_ID,
  WC2026_TOURNAMENT_START,
  WC2026_YEAR,
} from '../constants/tournament';
import { logWarn } from '../utils/logger';
import { buildDashboardPayload } from './dashboardPayload';
import { buildSchedulePayload } from './schedulePayload';
import { fetchHotNewsArticles } from './newsListPayload';
import { buildGroupStandingsPayload } from './tournamentStandings';
import { buildTournamentMatchProbabilitiesPayload } from './tournamentMatchProbabilities';
import { buildTopScorersPayload, type TopScorersPayload } from './tournamentTopScorers';

export type HomePayloadData = {
  schedule: Awaited<ReturnType<typeof buildSchedulePayload>>['data'];
  scheduleMeta: Awaited<ReturnType<typeof buildSchedulePayload>>['meta'];
  dashboard: Awaited<ReturnType<typeof buildDashboardPayload>>;
  hotNews: Awaited<ReturnType<typeof fetchHotNewsArticles>>;
  standings: Awaited<ReturnType<typeof buildGroupStandingsPayload>>;
  matchProbabilities: Awaited<ReturnType<typeof buildTournamentMatchProbabilitiesPayload>>['data'];
  topScorers: TopScorersPayload;
};

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function loadSection<T>(name: string, fallback: T, load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (err) {
    logWarn('home section unavailable', { section: name, error: errorMessage(err) });
    return fallback;
  }
}

/** Empty sections used when a homepage dependency fails. */
export function emptyHomeSections(tournament = 't-2026'): HomePayloadData {
  const wc = tournament === WC2026_TOURNAMENT_ID;
  return {
    schedule: { byDate: {}, matches: [], tournamentId: tournament, total: 0 },
    scheduleMeta: {
      expectedMatches: wc ? WC2026_MATCH_COUNT : 0,
      year: WC2026_YEAR,
      tournamentId: tournament,
      wc2026Only: wc,
    },
    dashboard: {
      featuredMatch: null,
      matchCount: 0,
      lastDataRefresh: null,
      lastNewsCrawl: null,
      refreshIntervalSec: 60,
      newsCrawlIntervalSec: 900,
      tournamentStartUtc: WC2026_TOURNAMENT_START,
      expectedMatches: WC2026_MATCH_COUNT,
      hostCountries: [...WC2026_HOST_COUNTRIES],
      teamsCount: WC2026_TEAMS_COUNT,
      groupCount: 0,
      statusCounts: {},
    },
    hotNews: [],
    standings: { tournamentId: WC2026_TOURNAMENT_ID, groups: {}, thirdPlaceRanking: [] },
    matchProbabilities: {},
    topScorers: {
      tournamentId: WC2026_TOURNAMENT_ID,
      updatedAt: '1970-01-01T00:00:00.000Z',
      scorers: [],
    },
  };
}

export async function buildHomePayloadData(env: AppEnv, tournament = 't-2026'): Promise<HomePayloadData> {
  const empty = emptyHomeSections(tournament);
  const [schedule, dashboard, hotNews, standings, matchProbabilities, topScorers] = await Promise.all([
    loadSection('schedule', { data: empty.schedule, meta: empty.scheduleMeta }, () =>
      buildSchedulePayload(env, tournament),
    ),
    loadSection('dashboard', empty.dashboard, () => buildDashboardPayload(env)),
    loadSection('hotNews', empty.hotNews, () => fetchHotNewsArticles(env, 3)),
    loadSection('standings', empty.standings, () => buildGroupStandingsPayload(env)),
    loadSection(
      'matchProbabilities',
      { data: empty.matchProbabilities, meta: { total: 0, withProbability: 0, pending: 0, missingIds: [] } },
      () =>
        buildTournamentMatchProbabilitiesPayload(env, WC2026_TOURNAMENT_ID, {
          scheduleBackgroundFill: true,
          skipInlineFill: true,
        }),
    ),
    loadSection('topScorers', empty.topScorers, () => buildTopScorersPayload(env)),
  ]);

  return {
    schedule: schedule.data,
    scheduleMeta: schedule.meta,
    dashboard,
    hotNews,
    standings,
    matchProbabilities: matchProbabilities.data,
    topScorers,
  };
}
