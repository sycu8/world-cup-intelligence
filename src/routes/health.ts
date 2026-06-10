import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { isGatewayConfigured } from '../ai/gatewayClient';
import { parseEnv } from '../env';

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
  const lastNewsCrawl = await c.env.KV.get('meta:last_news_crawl');
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
      newsCrawlIntervalSec: 900,
      lastDataRefresh: lastRefresh,
      lastNewsCrawl,
    },
    viewOnly: true,
    timestamp: new Date().toISOString(),
  });
});
