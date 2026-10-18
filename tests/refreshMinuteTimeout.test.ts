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
    'stamps lastDataRefresh when the %s step finishes on its own',
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

      expect(await env.KV.get('meta:last_data_refresh')).toEqual(expect.any(String));
      if (step === 'warm') expect(warmPayloadCaches).toHaveBeenCalled();
      if (step === 'bracket') expect(replayKnockoutBracketFromCompleted).toHaveBeenCalled();
    },
  );
});
