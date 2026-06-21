import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { getCachedJson } from '../services/payloadCache';
import { buildHealthPayload } from '../services/healthPayload';
import { withPathCache } from '../services/workersPathCache';

export const healthRoutes = new Hono<{ Bindings: AppEnv }>();

healthRoutes.get('/', async (c) =>
  withPathCache('api:health', 15, async () => {
    const payload = await getCachedJson(c.env, 'cache:health:v1', () => buildHealthPayload(c.env), 15);
    return c.json(payload, 200, {
      'Cache-Control': 'public, max-age=10, stale-while-revalidate=30',
    });
  }),
);
