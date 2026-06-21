import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { buildSchedulePayload } from '../services/schedulePayload';
import { getCachedJsonWithVersion } from '../services/payloadCache';

export const scheduleRoutes = new Hono<{ Bindings: AppEnv }>();

scheduleRoutes.get('/', async (c) => {
  const tournament = c.req.query('tournament') ?? 't-2026';
  const payload = await getCachedJsonWithVersion(c.env, `schedule:${tournament}`, () =>
    buildSchedulePayload(c.env, tournament),
  );
  return c.json(payload, 200, {
    'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
  });
});
