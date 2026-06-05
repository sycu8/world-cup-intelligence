import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { buildSchedulePayload } from '../services/schedulePayload';

export const scheduleRoutes = new Hono<{ Bindings: AppEnv }>();

scheduleRoutes.get('/', async (c) => {
  const payload = await buildSchedulePayload(c.env, c.req.query('tournament'));
  return c.json(payload, 200, {
    'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
  });
});
