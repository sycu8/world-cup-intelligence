import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRouteTestEnv } from './helpers/mockRouteDb';
import { mockExecutionCtx } from './helpers/routeHarness';

const mocks = vi.hoisted(() => ({
  handleIngestBatch: vi.fn(async () => undefined),
  handleModelBatch: vi.fn(async () => undefined),
  handleScheduledCron: vi.fn(async () => undefined),
}));

vi.mock('../src/queues/ingestConsumer', () => ({
  handleIngestBatch: mocks.handleIngestBatch,
}));

vi.mock('../src/queues/modelConsumer', () => ({
  handleModelBatch: mocks.handleModelBatch,
}));

vi.mock('../src/scheduled/cron', () => ({
  handleScheduledCron: mocks.handleScheduledCron,
}));

vi.mock('../src/services/workersPathCache', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/workersPathCache')>();
  return {
    ...actual,
    getPathCachedResponse: vi.fn(async () => null),
    putPathCachedResponse: vi.fn(async () => undefined),
  };
});

import worker from '../src/index';

describe('index default export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetch serves SPA root via ASSETS binding', async () => {
    const html = '<html><head></head><body>PitchIntel</body></html>';
    const assetsFetch = vi.fn(async () => new Response(html, { status: 200 }));
    const env = createRouteTestEnv({
      ASSETS: { fetch: assetsFetch } as never,
    });

    const res = await worker.fetch(new Request('https://example.com/'), env, mockExecutionCtx);

    expect(res.status).toBe(200);
    expect(await res.text()).toContain('PitchIntel');
    expect(assetsFetch).toHaveBeenCalled();
  });

  it('fetch handles /api/health JSON route', async () => {
    const env = createRouteTestEnv();
    const res = await worker.fetch(new Request('https://example.com/api/health'), env, mockExecutionCtx);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string };
    expect(json.status).toBe('healthy');
  });

  it('queue routes ingest jobs by idempotencyKey shape', async () => {
    const env = createRouteTestEnv();
    await worker.queue(
      {
        messages: [{ body: { type: 'crawl_news', idempotencyKey: 'k1' }, ack: vi.fn(), retry: vi.fn() }],
      } as never,
      env,
    );
    expect(mocks.handleIngestBatch).toHaveBeenCalled();
  });

  it('queue routes model jobs when idempotencyKey absent', async () => {
    const env = createRouteTestEnv();
    await worker.queue(
      {
        messages: [{ body: { type: 'recompute', matchId: 'm-1' }, ack: vi.fn(), retry: vi.fn() }],
      } as never,
      env,
    );
    expect(mocks.handleModelBatch).toHaveBeenCalled();
  });

  it('scheduled delegates to cron handler', async () => {
    const env = createRouteTestEnv();
    await worker.scheduled({ cron: '* * * * *' } as ScheduledController, env, mockExecutionCtx);
    expect(mocks.handleScheduledCron).toHaveBeenCalledWith(env, '* * * * *', mockExecutionCtx);
  });
});
