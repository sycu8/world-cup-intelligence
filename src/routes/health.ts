import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { isGatewayConfigured } from '../ai/gatewayClient';
import { parseEnv } from '../env';
import { NEWS_CRAWL_INTERVAL_SEC, NEWS_CRAWL_KV_KEY } from '../constants/pipeline';

export const healthRoutes = new Hono<{ Bindings: AppEnv }>();

healthRoutes.get('/', async (c) => {
  let dbOk = false;
  try {
    await c.env.DB.prepare('SELECT 1').first();
    dbOk = true;
  } catch {
    dbOk = false;
  }
  const lastRefresh = await c.env.KV.get('meta:last_data_refresh');
  const lastFifaSync = await c.env.KV.get('meta:last_fifa_sync');
  const lastNewsCrawl = await c.env.KV.get(NEWS_CRAWL_KV_KEY);
  return c.json({
    status: dbOk ? 'healthy' : 'degraded',
    environment: parseEnv(c.env).environment,
    dependencies: {
      d1: dbOk ? 'up' : 'down',
      r2: 'bound',
      workersAi: c.env.AI ? 'bound' : 'none',
      aiGateway: isGatewayConfigured(c.env) ? 'configured' : 'needs_openai_key',
      openaiKeySet: !!parseEnv(c.env).openaiApiKey,
    },
    pipeline: {
      dataRefreshIntervalSec: 60,
      newsCrawlIntervalSec: NEWS_CRAWL_INTERVAL_SEC,
      lastDataRefresh: lastRefresh,
      lastFifaSync,
      lastNewsCrawl,
    },
    viewOnly: true,
    timestamp: new Date().toISOString(),
  });
});
