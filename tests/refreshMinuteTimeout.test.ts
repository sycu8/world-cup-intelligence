import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleIngestBatch } from '../src/queues/ingestConsumer';
import { createMockEnv, createMockKv } from './helpers/mockEnv';
import { createMockMessageBatch } from './helpers/mockMessageBatch';

vi.mock('../src/ingestion/fifa/fifaLiveSync', () => ({
  syncFifaWc2026Matches: vi.fn(() => new Promise(() => undefined)),
}));

vi.mock('../src/ingestion/fifa/fifaLineupSync', () => ({
  syncFifaLineupsForUpcomingMatches: vi.fn(async () => ({ checked: 0, updated: 0, matchIds: [] })),
}));

vi.mock('../src/services/cacheWarm', () => ({
  warmPayloadCaches: vi.fn(async () => undefined),
}));

vi.mock('../src/services/tournamentProgression', () => ({
  processMatchCompletion: vi.fn(async () => undefined),
  replayKnockoutBracketFromCompleted: vi.fn(async () => []),
}));

vi.mock('../src/services/bulkRecomputeRunner', () => ({
  isBulkWalkLeaseActive: vi.fn(async () => false),
  scheduleRecomputeAfterDataChange: vi.fn(async () => undefined),
}));

vi.mock('../src/services/tournamentChampionOdds', () => ({
  runChampionOddsRefreshIfPending: vi.fn(async () => false),
}));

describe('refresh_minute budget', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('queues the steps after FIFA sync before a hung sync can consume the whole budget', async () => {
    const ingestSend = vi.fn(async () => undefined);
    const retry = vi.fn();
    const env = createMockEnv({
      FIFA_LIVE_ENABLED: 'true',
      MOCK_SOURCES: 'false',
      INGEST_QUEUE: { send: ingestSend } as never,
      KV: createMockKv(),
    });

    await handleIngestBatch(
      createMockMessageBatch([
        { body: { type: 'refresh_minute', idempotencyKey: 'refresh-1' }, retry },
      ]),
      env,
      { messageTimeoutMs: 40 },
    );

    const steps = ingestSend.mock.calls.map((call) => (call[0] as { step?: string }).step);
    expect(steps).toEqual(expect.arrayContaining(['lineups', 'bracket', 'warm']));
    expect(retry).toHaveBeenCalled();
    expect(await env.KV.get('meta:last_data_refresh')).toBeNull();
  });

  it.each(['lineups', 'bracket', 'warm'] as const)(
    'stamps its own key when the %s step finishes',
    async (step) => {
      const { warmPayloadCaches } = await import('../src/services/cacheWarm');
      const { replayKnockoutBracketFromCompleted } = await import('../src/services/tournamentProgression');
      const env = createMockEnv({
        FIFA_LIVE_ENABLED: 'true',
        MOCK_SOURCES: 'false',
        KV: createMockKv(),
      });

      await handleIngestBatch(
        createMockMessageBatch([{ body: { type: 'refresh_minute', step, idempotencyKey: `step-${step}` } }]),
        env,
      );

      const ownKey = {
        lineups: 'meta:last_lineups_refresh',
        bracket: 'meta:last_bracket_refresh',
        warm: 'meta:last_warm_refresh',
      }[step];
      expect(await env.KV.get(ownKey)).toEqual(expect.any(String));
      expect(await env.KV.get('meta:last_data_refresh')).toBeNull();
      expect(env.KV.put).toHaveBeenCalledWith(ownKey, expect.any(String), { expirationTtl: 86400 });
      if (step === 'warm') expect(warmPayloadCaches).toHaveBeenCalled();
      if (step === 'bracket') expect(replayKnockoutBracketFromCompleted).toHaveBeenCalled();
    },
  );

  it.each(['throw', 'empty'] as const)(
    'leaves health unchanged when the score sync %s and follow-ups finish',
    async (mode) => {
      const { syncFifaWc2026Matches } = await import('../src/ingestion/fifa/fifaLiveSync');
      const { buildHealthPayload } = await import('../src/services/healthPayload');
      if (mode === 'throw') {
        vi.mocked(syncFifaWc2026Matches).mockRejectedValueOnce(new Error('fifa down'));
      } else {
        vi.mocked(syncFifaWc2026Matches).mockResolvedValueOnce({
          updatedIds: [],
          completedIds: [],
          teamUpdatedIds: [],
          synced: 0,
          skipped: 1,
        });
      }
      const queued: unknown[] = [];
      const env = createMockEnv({
        FIFA_LIVE_ENABLED: 'true',
        MOCK_SOURCES: 'false',
        INGEST_QUEUE: {
          send: vi.fn(async (body: unknown) => {
            queued.push(body);
          }),
        } as never,
        KV: createMockKv({ 'meta:last_fifa_sync': new Date().toISOString() }),
      });
      const before = await buildHealthPayload(env);
      expect(before.status).toBe('unhealthy');
      expect(before.pipeline.lastDataRefresh).toBeNull();
      expect(before.pipeline.lastFifaSync).not.toBeNull();

      await handleIngestBatch(
        createMockMessageBatch([{ body: { type: 'refresh_minute', idempotencyKey: `refresh-${mode}` } }]),
        env,
      );
      for (const body of queued) {
        await handleIngestBatch(createMockMessageBatch([{ body: body as { type: 'refresh_minute' } }]), env);
      }

      const after = await buildHealthPayload(env);
      expect(after.status).toBe(before.status);
      expect(after.pipeline.lastDataRefresh).toBeNull();
      expect(after.pipeline.lastFifaSync).toBe(before.pipeline.lastFifaSync);
      expect(await env.KV.get('meta:last_lineups_refresh')).toEqual(expect.any(String));
      expect(await env.KV.get('meta:last_bracket_refresh')).toEqual(expect.any(String));
      expect(await env.KV.get('meta:last_warm_refresh')).toEqual(expect.any(String));
    },
  );
});
