import type { AppEnv } from '../env';
import { WC2026_TOURNAMENT_ID } from '../constants/tournament';
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

export async function buildHomePayloadData(env: AppEnv, tournament = 't-2026'): Promise<HomePayloadData> {
  const [schedule, dashboard, hot, standings, matchProbabilities, topScorers] = await Promise.all([
    buildSchedulePayload(env, tournament),
    buildDashboardPayload(env),
    fetchHotNewsArticles(env, 3),
    buildGroupStandingsPayload(env),
    buildTournamentMatchProbabilitiesPayload(env, WC2026_TOURNAMENT_ID, {
      scheduleBackgroundFill: true,
      skipInlineFill: true,
    }),
    buildTopScorersPayload(env),
  ]);

  return {
    schedule: schedule.data,
    scheduleMeta: schedule.meta,
    dashboard,
    hotNews: hot,
    standings,
    matchProbabilities: matchProbabilities.data,
    topScorers,
  };
}
