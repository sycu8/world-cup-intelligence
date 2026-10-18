import { describe, expect, it, vi } from 'vitest';
import { INGEST_LAST_RUN_KEY, INGEST_STALE_DROPS_KEY, MODEL_QUEUE_STALE_DROPS_KEY, NEWS_CRAWL_KV_KEY } from '../src/constants/pipeline';
import {
  DATA_REFRESH_DEGRADED_AFTER_MS,
  DATA_REFRESH_UNHEALTHY_AFTER_MS,
  buildHealthPayload,
  dataRefreshStatus,
} from '../src/services/healthPayload';
import { createMockDb, createMockEnv, createMockKv } from './helpers/mockEnv';

const NOW = Date.parse('2026-10-18T19:40:00.000Z');

function isoAge(ageMs: number): string {
  return new Date(NOW - ageMs).toISOString();
}

describe('dataRefreshStatus', () => {
  it('stays healthy through 150s, degraded after that, and unhealthy after 10 minutes', () => {
    expect(dataRefreshStatus(isoAge(0), NOW)).toBe('healthy');
    expect(dataRefreshStatus(isoAge(DATA_REFRESH_DEGRADED_AFTER_MS), NOW)).toBe('healthy');
    expect(dataRefreshStatus(isoAge(DATA_REFRESH_DEGRADED_AFTER_MS + 1), NOW)).toBe('degraded');
    expect(dataRefreshStatus(isoAge(DATA_REFRESH_UNHEALTHY_AFTER_MS), NOW)).toBe('degraded');
    expect(dataRefreshStatus(isoAge(DATA_REFRESH_UNHEALTHY_AFTER_MS + 1), NOW)).toBe('unhealthy');
    expect(dataRefreshStatus(null, NOW)).toBe('unhealthy');
    expect(dataRefreshStatus('not-a-date', NOW)).toBe('unhealthy');
  });
});

describe('buildHealthPayload', () => {
  it('returns healthy status when D1 responds and the refresh is current', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const fresh = isoAge(30_000);
    const env = createMockEnv({
      ENVIRONMENT: 'development',
      KV: createMockKv({
        'meta:last_data_refresh': fresh,
        'meta:last_fifa_sync': '2026-06-01T00:05:00.000Z',
        [NEWS_CRAWL_KV_KEY]: '2026-06-01T00:10:00.000Z',
        [MODEL_QUEUE_STALE_DROPS_KEY]: '12',
        [INGEST_STALE_DROPS_KEY]: '7',
        [INGEST_LAST_RUN_KEY]: '1710000000000',
      }),
      DB: createMockDb({
        first: () => ({ ok: 1 }),
      }),
      AI: {} as never,
      OPENAI_API_KEY: 'sk-test',
      AI_GATEWAY_ENABLED: 'true',
      AI_GATEWAY_ACCOUNT_ID: 'acct',
    });

    const payload = await buildHealthPayload(env);

    expect(payload.status).toBe('healthy');
    expect(payload.environment).toBe('development');
    expect(payload.dependencies.d1).toBe('up');
    expect(payload.dependencies.r2).toBe('bound');
    expect(payload.dependencies.workersAi).toBe('bound');
    expect(payload.dependencies.aiGateway).toBe('configured');
    expect(payload.dependencies.openaiKeySet).toBe(true);
    expect(payload.pipeline.lastDataRefresh).toBe(fresh);
    expect(payload.pipeline.lastFifaSync).toBe('2026-06-01T00:05:00.000Z');
    expect(payload.pipeline.lastNewsCrawl).toBe('2026-06-01T00:10:00.000Z');
    expect(payload.pipeline.modelQueueStaleDrops).toBe(12);
    expect(payload.pipeline.bulkRecomputeBudgetSkips).toBe(0);
    expect(payload.pipeline.ingestStaleDrops).toBe(7);
    expect(payload.pipeline.ingestLastRefreshRunMs).toBe(1710000000000);
    expect(payload.viewOnly).toBe(true);
    expect(payload.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    vi.useRealTimers();
  });

  it('reports degraded when lastDataRefresh is older than 150 seconds', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const env = createMockEnv({
      KV: createMockKv({ 'meta:last_data_refresh': isoAge(DATA_REFRESH_DEGRADED_AFTER_MS + 1) }),
      DB: createMockDb({ first: () => ({ ok: 1 }) }),
    });
    const payload = await buildHealthPayload(env);
    expect(payload.status).toBe('degraded');
    vi.useRealTimers();
  });

  it('reports unhealthy when lastDataRefresh is older than 10 minutes or missing', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const stale = createMockEnv({
      KV: createMockKv({ 'meta:last_data_refresh': isoAge(DATA_REFRESH_UNHEALTHY_AFTER_MS + 1) }),
      DB: createMockDb({ first: () => ({ ok: 1 }) }),
    });
    expect((await buildHealthPayload(stale)).status).toBe('unhealthy');
    const missing = createMockEnv({
      DB: createMockDb({ first: () => ({ ok: 1 }) }),
    });
    expect((await buildHealthPayload(missing)).status).toBe('unhealthy');
    vi.useRealTimers();
  });

  it('returns degraded when D1 query fails', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const env = createMockEnv({
      ENVIRONMENT: 'development',
      AI: undefined,
      KV: createMockKv({ 'meta:last_data_refresh': isoAge(0) }),
      DB: createMockDb({
        first: () => {
          throw new Error('db down');
        },
      }),
    });

    const payload = await buildHealthPayload(env);

    expect(payload.status).toBe('degraded');
    expect(payload.dependencies.d1).toBe('down');
    expect(payload.dependencies.workersAi).toBe('none');
    expect(payload.dependencies.aiGateway).toBe('needs_openai_key');
    expect(payload.dependencies.openaiKeySet).toBe(false);
    vi.useRealTimers();
  });

  it('omits gateway dependency details in production', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const env = createMockEnv({
      ENVIRONMENT: 'production',
      KV: createMockKv({ 'meta:last_data_refresh': isoAge(0) }),
      DB: createMockDb({ first: () => ({ ok: 1 }) }),
      AI: {} as never,
    });

    const payload = await buildHealthPayload(env);

    expect(payload.environment).toBe('production');
    expect(payload.dependencies).not.toHaveProperty('aiGateway');
    expect(payload.dependencies).not.toHaveProperty('openaiKeySet');
    vi.useRealTimers();
  });

  it('handles null D1 result as degraded', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const env = createMockEnv({
      ENVIRONMENT: 'development',
      KV: createMockKv({ 'meta:last_data_refresh': isoAge(0) }),
      DB: createMockDb({ first: () => null }),
    });

    const payload = await buildHealthPayload(env);
    expect(payload.status).toBe('degraded');
    expect(payload.dependencies.d1).toBe('down');
    vi.useRealTimers();
  });

  it('lets an unhealthy refresh outrank a D1 failure', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const env = createMockEnv({
      KV: createMockKv({ 'meta:last_data_refresh': isoAge(DATA_REFRESH_UNHEALTHY_AFTER_MS + 1) }),
      DB: createMockDb({ first: () => null }),
    });
    expect((await buildHealthPayload(env)).status).toBe('unhealthy');
    vi.useRealTimers();
  });
});
