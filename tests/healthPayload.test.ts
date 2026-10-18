import { describe, expect, it, vi } from 'vitest';
import { NEWS_CRAWL_KV_KEY } from '../src/constants/pipeline';
import { buildHealthPayload } from '../src/services/healthPayload';
import { createMockDb, createMockEnv, createMockKv } from './helpers/mockEnv';

describe('buildHealthPayload', () => {
  it('returns healthy status when D1 responds', async () => {
    const env = createMockEnv({
      ENVIRONMENT: 'development',
      KV: createMockKv({
        'meta:last_data_refresh': '2026-06-01T00:00:00.000Z',
        'meta:last_fifa_sync': '2026-06-01T00:05:00.000Z',
        [NEWS_CRAWL_KV_KEY]: '2026-06-01T00:10:00.000Z',
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
    expect(payload.pipeline.lastDataRefresh).toBe('2026-06-01T00:00:00.000Z');
    expect(payload.pipeline.lastFifaSync).toBe('2026-06-01T00:05:00.000Z');
    expect(payload.pipeline.lastNewsCrawl).toBe('2026-06-01T00:10:00.000Z');
    expect(payload.viewOnly).toBe(true);
    expect(payload.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('returns degraded when D1 query fails', async () => {
    const env = createMockEnv({
      ENVIRONMENT: 'development',
      AI: undefined,
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
  });

  it('omits gateway dependency details in production', async () => {
    const env = createMockEnv({
      ENVIRONMENT: 'production',
      DB: createMockDb({ first: () => ({ ok: 1 }) }),
      AI: {} as never,
    });

    const payload = await buildHealthPayload(env);

    expect(payload.environment).toBe('production');
    expect(payload.dependencies).not.toHaveProperty('aiGateway');
    expect(payload.dependencies).not.toHaveProperty('openaiKeySet');
  });

  it('handles null D1 result as degraded', async () => {
    const env = createMockEnv({
      ENVIRONMENT: 'development',
      DB: createMockDb({ first: () => null }),
    });

    const payload = await buildHealthPayload(env);
    expect(payload.status).toBe('degraded');
    expect(payload.dependencies.d1).toBe('down');
  });
});
