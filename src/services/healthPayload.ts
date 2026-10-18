import type { AppEnv } from '../env';
import { isGatewayConfigured } from '../ai/gatewayClient';
import { parseEnv } from '../env';
import {
  BULK_BUDGET_SKIPS_KEY,
  INGEST_LAST_RUN_KEY,
  INGEST_STALE_DROPS_KEY,
  MODEL_QUEUE_STALE_DROPS_KEY,
  NEWS_CRAWL_INTERVAL_SEC,
  NEWS_CRAWL_KV_KEY,
} from '../constants/pipeline';
import { parseLastRunMs } from '../queues/ingestDrain';

/** lastDataRefresh older than this is degraded. Exactly this age stays healthy. */
export const DATA_REFRESH_DEGRADED_AFTER_MS = 150_000;
/** lastDataRefresh older than this is unhealthy. Exactly 10 minutes stays degraded. */
export const DATA_REFRESH_UNHEALTHY_AFTER_MS = 10 * 60_000;

export type DataRefreshHealth = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Missing or unparseable stamps are unhealthy: a refresh that never recorded
 * a time cannot be treated as current.
 */
export function dataRefreshStatus(last: string | null, now = Date.now()): DataRefreshHealth {
  const at = Date.parse(last ?? '');
  if (!Number.isFinite(at)) return 'unhealthy';
  const age = now - at;
  if (age > DATA_REFRESH_UNHEALTHY_AFTER_MS) return 'unhealthy';
  if (age > DATA_REFRESH_DEGRADED_AFTER_MS) return 'degraded';
  return 'healthy';
}

function combineHealthStatus(dbOk: boolean, refresh: DataRefreshHealth): DataRefreshHealth {
  if (refresh === 'unhealthy') return 'unhealthy';
  if (!dbOk || refresh === 'degraded') return 'degraded';
  return 'healthy';
}

export type HealthPayload = {
  status: DataRefreshHealth;
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
    /** Ingest ticks acked without running. Cached with the rest of this payload for 15s. */
    ingestStaleDrops: number;
    /** Epoch ms of the last accepted minute refresh. Null when none is stored. */
    ingestLastRefreshRunMs: number | null;
  };
  viewOnly: boolean;
  timestamp: string;
};

export async function buildHealthPayload(env: AppEnv): Promise<HealthPayload> {
  const config = parseEnv(env);
  const isProduction = config.environment === 'production';

  const [dbResult, lastRefresh, lastFifaSync, lastNewsCrawl, staleDropsRaw, budgetSkipsRaw, ingestDropsRaw, ingestLastRunRaw] =
    await Promise.all([
      env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>().catch(() => null),
      env.KV.get('meta:last_data_refresh'),
      env.KV.get('meta:last_fifa_sync'),
      env.KV.get(NEWS_CRAWL_KV_KEY),
      env.KV.get(MODEL_QUEUE_STALE_DROPS_KEY),
      env.KV.get(BULK_BUDGET_SKIPS_KEY),
      env.KV.get(INGEST_STALE_DROPS_KEY),
      env.KV.get(INGEST_LAST_RUN_KEY),
    ]);
  const staleDrops = Number.parseInt(staleDropsRaw ?? '0', 10);
  const budgetSkips = Number.parseInt(budgetSkipsRaw ?? '0', 10);
  const ingestDrops = Number.parseInt(ingestDropsRaw ?? '0', 10);

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
    status: combineHealthStatus(dbOk, dataRefreshStatus(lastRefresh)),
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
      ingestStaleDrops: Number.isFinite(ingestDrops) ? ingestDrops : 0,
      ingestLastRefreshRunMs: parseLastRunMs(ingestLastRunRaw),
    },
    viewOnly: true,
    timestamp: new Date().toISOString(),
  };
}
