import { describe, expect, it, vi } from 'vitest';

const syncQueuedMatchRecap = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('../src/services/matchRecap', () => ({
  syncQueuedMatchRecap,
  getMatchRecap: vi.fn(),
}));

vi.mock('../src/ingestion/fifa/fifaLiveSync', () => ({
  syncFifaWc2026Matches: vi.fn(async () => ({
    updatedIds: ['m-live'],
    completedIds: [],
    teamUpdatedIds: [],
    synced: 1,
    skipped: 0,
  })),
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

import worker from '../src/index';
import { syncFifaWc2026Matches } from '../src/ingestion/fifa/fifaLiveSync';
import { handleIngestBatch } from '../src/queues/ingestConsumer';
import { handleRecapBatch } from '../src/queues/recapConsumer';
import { createMockEnv } from './helpers/mockEnv';
import { createMockMessageBatch } from './helpers/mockMessageBatch';

describe('recap queue', () => {
  it('forwards a recap on the ingest lane and still runs the refresh behind it', async () => {
    syncQueuedMatchRecap.mockImplementation(() => new Promise(() => undefined));
    const recapSend = vi.fn(async () => undefined);
    const ingestSend = vi.fn(async () => undefined);
    const env = createMockEnv({
      FIFA_LIVE_ENABLED: 'true',
      MOCK_SOURCES: 'false',
      INGEST_QUEUE: { send: ingestSend } as never,
      RECAP_QUEUE: { send: recapSend } as never,
      MODEL_QUEUE: { send: vi.fn(async () => undefined) } as never,
    });
    const refreshAck = vi.fn();

    const done = handleIngestBatch(
      createMockMessageBatch([
        { body: { type: 'sync_match_recap', matchRef: 'm-1', idempotencyKey: 'sync_match_recap:m-1' } },
        { body: { type: 'refresh_minute', idempotencyKey: 'refresh-1' }, ack: refreshAck },
      ]),
      env,
    );
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('refresh waited on the recap sync')), 500);
    });
    await Promise.race([done, timeout]);

    expect(syncQueuedMatchRecap).not.toHaveBeenCalled();
    expect(recapSend).toHaveBeenCalledWith({
      type: 'sync_match_recap',
      matchRef: 'm-1',
      idempotencyKey: 'sync_match_recap:m-1',
    });
    expect(syncFifaWc2026Matches).toHaveBeenCalled();
    expect(refreshAck).toHaveBeenCalled();
  });

  it('runs the sync on the recap queue and not on the ingest consumer', async () => {
    syncQueuedMatchRecap.mockReset();
    syncQueuedMatchRecap.mockResolvedValue(undefined);
    const ack = vi.fn();
    const env = createMockEnv();
    await worker.queue(
      {
        queue: 'wc-recap-queue',
        messages: [
          {
            id: 'r1',
            body: { type: 'sync_match_recap', matchRef: 'm-1', idempotencyKey: 'sync_match_recap:m-1' },
            timestamp: new Date(),
            attempts: 1,
            ack,
            retry: vi.fn(),
          },
        ],
      } as never,
      env,
    );
    expect(syncQueuedMatchRecap).toHaveBeenCalledWith(env, 'm-1');
    expect(ack).toHaveBeenCalledTimes(1);

    syncQueuedMatchRecap.mockClear();
    const ingestAck = vi.fn();
    const recapSend = vi.fn(async () => undefined);
    await handleRecapBatch(
      {
        queue: 'wc-ingest-queue',
        messages: [
          {
            id: 'skip',
            body: { type: 'refresh_minute' },
            timestamp: new Date(),
            attempts: 1,
            ack: ingestAck,
            retry: vi.fn(),
          },
        ],
      } as never,
      createMockEnv({ RECAP_QUEUE: { send: recapSend } as never }),
    );
    expect(syncQueuedMatchRecap).not.toHaveBeenCalled();
    expect(ingestAck).toHaveBeenCalled();
    expect(recapSend).not.toHaveBeenCalled();
  });
});
