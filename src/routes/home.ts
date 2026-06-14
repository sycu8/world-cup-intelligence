import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { WC2026_TOURNAMENT_ID } from '../constants/tournament';
import { ensureNewsCrawlFresh, ensurePipelineFresh } from '../services/pipelineBootstrap';
import { buildDashboardPayload } from '../services/dashboardPayload';
import { buildSchedulePayload } from '../services/schedulePayload';
import { fetchHotNewsArticles } from '../services/newsListPayload';
import { buildGroupStandingsPayload } from '../services/tournamentStandings';
import { buildTournamentMatchProbabilitiesPayload } from '../services/tournamentMatchProbabilities';
import { getChampionOddsForHome } from '../services/tournamentChampionOdds';

export const homeRoutes = new Hono<{ Bindings: AppEnv }>();

/** Single round-trip payload for the homepage (schedule + dashboard + hot news). */
homeRoutes.get('/', async (c) => {
  c.executionCtx.waitUntil(
    Promise.all([
      ensurePipelineFresh(c.env).catch(() => undefined),
      ensureNewsCrawlFresh(c.env).catch(() => undefined),
    ]),
  );

  const tournament = c.req.query('tournament') ?? 't-2026';
  const [schedule, dashboard, hot, standings, matchProbabilities, championOdds] = await Promise.all([
    buildSchedulePayload(c.env, tournament),
    buildDashboardPayload(c.env),
    fetchHotNewsArticles(c.env, 3),
    buildGroupStandingsPayload(c.env),
    buildTournamentMatchProbabilitiesPayload(c.env, WC2026_TOURNAMENT_ID, {
      scheduleBackgroundFill: false,
    }),
    getChampionOddsForHome(c.env, c.executionCtx),
  ]);

  if (matchProbabilities.meta.missingIds.length > 0) {
    c.executionCtx.waitUntil(
      import('../services/tournamentMatchProbabilities').then(({ persistMissingTournamentProbabilities }) =>
        persistMissingTournamentProbabilities(c.env, matchProbabilities.meta.missingIds).catch(() => undefined),
      ),
    );
  }

  return c.json(
    {
      data: {
        schedule: schedule.data,
        scheduleMeta: schedule.meta,
        dashboard,
        hotNews: hot,
        standings,
        matchProbabilities: matchProbabilities.data,
        championOdds,
      },
    },
    200,
    { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' },
  );
});
