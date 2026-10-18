import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { ensurePipelineFresh } from '../services/pipelineBootstrap';
import { buildDashboardPayload } from '../services/dashboardPayload';
import { getCachedJsonWithVersion } from '../services/payloadCache';
import { withPathCache } from '../services/workersPathCache';

export const dashboardRoutes = new Hono<{ Bindings: AppEnv }>();

dashboardRoutes.get('/', async (c) => {
  c.executionCtx.waitUntil(ensurePipelineFresh(c.env).catch(() => undefined));
  return withPathCache('api:dashboard', 30, async () => {
    const data = await getCachedJsonWithVersion(c.env, 'dashboard', () => buildDashboardPayload(c.env));
    return c.json({ data }, 200, {
      'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
    });
  });
});
