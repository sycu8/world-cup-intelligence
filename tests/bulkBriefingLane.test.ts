import { afterEach, describe, expect, it, vi } from 'vitest';
import { BULK_RECOMPUTE_KV_KEY } from '../src/constants/pipeline';
import { handleModelBatch } from '../src/queues/modelConsumer';
import { BULK_RECOMPUTE_BUDGET_MS, BULK_RECOMPUTE_CHUNK_SIZE } from '../src/services/bulkRecomputeRunner';
import { createMockDb, createMockEnv, createMockKv } from './helpers/mockEnv';
import { createMockMessageBatch } from './helpers/mockMessageBatch';

vi.mock('../src/services/recomputeMatch', () => ({
  recomputeMatchProbability: vi.fn(async () => null),
}));

vi.mock('../src/ai/tacticalBriefing', () => ({
  generateTacticalBriefing: vi.fn(async () => ({ matchId: 'm-live', summary: 'brief' })),
  briefingWithheldFromCache: vi.fn(() => false),
}));

vi.mock('../src/db/repositories/probabilityRepo', () => ({
  getLatestSnapshot: vi.fn(async () => ({
    home_win_prob: 0.4,
    draw_prob: 0.3,
    away_win_prob: 0.3,
    expected_home_goals: 1.2,
    expected_away_goals: 0.8,
  })),
}));

describe('bulk chunks leave room for a later briefing', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('finishes a fresh briefing within about 2 minutes while a 104-match bulk is in progress', async () => {
    const { recomputeMatchProbability } = await import('../src/services/recomputeMatch');
    const { generateTacticalBriefing } = await import('../src/ai/tacticalBriefing');
    const ids = Array.from({ length: 104 }, (_, index) => `m-${String(index).padStart(3, '0')}`);
    let clock = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => clock);
    const events: Array<{ kind: 'match' | 'briefing'; at: number }> = [];
    vi.mocked(recomputeMatchProbability).mockImplementation(async () => {
      events.push({ kind: 'match', at: clock });
      clock += 45_000;
      return null;
    });
    vi.mocked(generateTacticalBriefing).mockImplementation(async () => {
      events.push({ kind: 'briefing', at: clock });
      return { matchId: 'm-live', summary: 'brief' };
    });

    const queued: Array<{ type: string; cursor?: string; phase?: string }> = [];
    const env = createMockEnv({
      DB: createMockDb({ all: () => ({ results: ids.map((id) => ({ id })) }) }),
      KV: createMockKv({ [BULK_RECOMPUTE_KV_KEY]: 'ingest' }),
      MODEL_QUEUE: {
        send: vi.fn(async (body: { type: string; cursor?: string; phase?: string }) => {
          queued.push(body);
        }),
      } as never,
      AI_FALLBACK_MODE: 'true',
    });

    const started = clock;
    await handleModelBatch(
      createMockMessageBatch([{ body: { type: 'recompute_wc2026_bulk' }, timestamp: new Date(clock) }]),
      env,
    );
    expect(clock - started).toBeLessThanOrEqual(BULK_RECOMPUTE_BUDGET_MS + 45_000);
    expect(events.filter((event) => event.kind === 'match').length).toBeLessThanOrEqual(BULK_RECOMPUTE_CHUNK_SIZE);
    expect(events.filter((event) => event.kind === 'match').length).toBeLessThan(104);

    const continuation = queued.find((body) => body.type === 'recompute_wc2026_bulk' && body.phase !== 'champion');
    expect(continuation?.cursor).toBeTruthy();
    const briefingAck = vi.fn();
    await handleModelBatch(
      createMockMessageBatch([
        { body: continuation as { type: 'recompute_wc2026_bulk'; cursor?: string }, timestamp: new Date(clock) },
        { body: { type: 'ai_briefing', matchId: 'm-live' }, timestamp: new Date(clock), ack: briefingAck },
      ]),
      env,
    );

    const briefing = events.find((event) => event.kind === 'briefing');
    expect(briefingAck).toHaveBeenCalled();
    expect(briefing).toBeTruthy();
    expect(briefing!.at - started).toBeLessThanOrEqual(120_000);
    const matchesBeforeBriefing = events.filter((event) => event.kind === 'match' && event.at <= briefing!.at).length;
    expect(matchesBeforeBriefing).toBeLessThanOrEqual(BULK_RECOMPUTE_CHUNK_SIZE);
    expect(matchesBeforeBriefing).toBeLessThan(104);
  });
});
