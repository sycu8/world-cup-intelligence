import type { AppEnv } from '../env';
import { isGatewayConfigured } from '../ai/gatewayClient';
import { parseEnv } from '../env';
import {
  BULK_BUDGET_SKIPS_KEY,
  MODEL_QUEUE_STALE_DROPS_KEY,
  NEWS_CRAWL_INTERVAL_SEC,
  NEWS_CRAWL_KV_KEY,
} from '../constants/pipeline';

export type HealthPayload = {
  status: string;
  environment: string;
  dependencies: Record<string, string | boolean>;
  pipeline: {
    dataRefreshIntervalSec: number;
    newsCrawlIntervalSec: number;
    lastDataRefresh: string | null;
    lastFifaSync: string | null;
    lastNewsCrawl: string | null;
    modelQueueStaleDrops: number;
    bulkRecomputeBudgetSkips: number;
  };
  viewOnly: boolean;
  timestamp: string;
};

export async function buildHealthPayload(env: AppEnv): Promise<HealthPayload> {
  const config = parseEnv(env);
  const isProduction = config.environment === 'production';

  const [dbResult, lastRefresh, lastFifaSync, lastNewsCrawl, staleDropsRaw, budgetSkipsRaw] = await Promise.all([
    env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>().catch(() => null),
    env.KV.get('meta:last_data_refresh'),
    env.KV.get('meta:last_fifa_sync'),
    env.KV.get(NEWS_CRAWL_KV_KEY),
    env.KV.get(MODEL_QUEUE_STALE_DROPS_KEY),
    env.KV.get(BULK_BUDGET_SKIPS_KEY),
  ]);
  const staleDrops = Number.parseInt(staleDropsRaw ?? '0', 10);
  const budgetSkips = Number.parseInt(budgetSkipsRaw ?? '0', 10);

  const dbOk = dbResult?.ok === 1;

  const dependencies: Record<string, string | boolean> = {
    d1: dbOk ? 'up' : 'down',
    r2: 'bound',
    workersAi: env.AI ? 'bound' : 'none',
  };
  if (!isProduction) {
    dependencies.aiGateway = isGatewayConfigured(env) ? 'configured' : 'needs_openai_key';
    dependencies.openaiKeySet = !!config.openaiApiKey;
  }

  return {
    status: dbOk ? 'healthy' : 'degraded',
    environment: config.environment,
    dependencies,
    pipeline: {
      dataRefreshIntervalSec: 60,
      newsCrawlIntervalSec: NEWS_CRAWL_INTERVAL_SEC,
      lastDataRefresh: lastRefresh,
      lastFifaSync,
      lastNewsCrawl,
      modelQueueStaleDrops: Number.isFinite(staleDrops) ? staleDrops : 0,
      bulkRecomputeBudgetSkips: Number.isFinite(budgetSkips) ? budgetSkips : 0,
    },
    viewOnly: true,
    timestamp: new Date().toISOString(),
  };
}
