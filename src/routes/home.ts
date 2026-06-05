import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { ensurePipelineFresh } from '../services/pipelineBootstrap';
import { buildDashboardPayload } from '../services/dashboardPayload';
import { buildSchedulePayload } from '../services/schedulePayload';
import { fetchHotNewsArticles } from '../services/newsListPayload';

export const homeRoutes = new Hono<{ Bindings: AppEnv }>();

/** Single round-trip payload for the homepage (schedule + dashboard + hot news). */
homeRoutes.get('/', async (c) => {
  c.executionCtx.waitUntil(ensurePipelineFresh(c.env).catch(() => undefined));

  const tournament = c.req.query('tournament') ?? 't-2026';
  const [schedule, dashboard, hot] = await Promise.all([
    buildSchedulePayload(c.env, tournament),
    buildDashboardPayload(c.env),
    fetchHotNewsArticles(c.env, 3),
  ]);

  return c.json(
    {
      data: {
        schedule: schedule.data,
        scheduleMeta: schedule.meta,
        dashboard,
        hotNews: hot,
      },
    },
    200,
    { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' },
  );
});
