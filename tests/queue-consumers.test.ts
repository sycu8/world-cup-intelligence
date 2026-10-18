import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleIngestBatch } from '../src/queues/ingestConsumer';
import { handleModelBatch } from '../src/queues/modelConsumer';
import {
  AI_BRIEFING_QUEUE_MAX_AGE_MS,
  AI_MESSAGE_TIMEOUT_MS,
  CONSUMER_BATCH_DEADLINE_MS,
  queueRetryDelaySeconds,
} from '../src/queues/modelJobLane';
import { MODEL_QUEUE_STALE_DROPS_KEY } from '../src/constants/pipeline';
import { createMockDb, createMockEnv } from './helpers/mockEnv';
import { createMockMessageBatch } from './helpers/mockMessageBatch';

vi.mock('../src/ingestion/matchDataRefresh', () => ({
  refreshMatchData: vi.fn(async () => ({
    updatedIds: ['m-1'],
    completedIds: [],
    teamUpdatedIds: [],
    bracketUpdatedIds: [],
  })),
  handleCompletedMatches: vi.fn(async () => undefined),
}));

vi.mock('../src/ingestion/newsCrawler', () => ({
  crawlWorldCupNews: vi.fn(async () => 2),
}));

vi.mock('../src/ingestion/leagues/syncLeagues', () => ({
  syncAllClubLeagues: vi.fn(async () => [{ leagueId: 't-la-liga', matchesUpserted: 1 }]),
  syncLeague: vi.fn(async () => ({ leagueId: 't-la-liga', matchesUpserted: 1 })),
  queueClubLeagueProbabilities: vi.fn(async () => 4),
}));

vi.mock('../src/ingestion/statsbombIngest', () => ({
  ingestStatsbombWorldCup: vi.fn(async () => ({ matchesInserted: 1, teamsUpdated: 0 })),
}));

vi.mock('../src/ingestion/sourceRegistry', () => ({
  getIngestHandler: vi.fn((sourceId: string) => (sourceId === 'statsbomb' ? 'statsbomb' : null)),
}));

vi.mock('../src/services/recomputeMatch', () => ({
  recomputeMatchProbability: vi.fn(async () => undefined),
}));

vi.mock('../src/services/tournamentProgression', () => ({
  processMatchCompletion: vi.fn(async () => undefined),
  replayKnockoutBracketFromCompleted: vi.fn(async () => []),
}));

vi.mock('../src/services/tournamentChampionOdds', () => ({
  runChampionOddsRefreshIfPending: vi.fn(async () => false),
}));

vi.mock('../src/services/bulkRecomputeRunner', () => ({
  runBulkRecomputeIfPending: vi.fn(async () => false),
  scheduleRecomputeAfterDataChange: vi.fn(async () => undefined),
  isBulkWalkLeaseActive: vi.fn(async () => false),
}));

vi.mock('../src/services/publicApi/webhooks', () => ({
  deliverWebhook: vi.fn(async () => undefined),
}));

vi.mock('../src/services/officialLineupSync', () => ({
  syncOfficialLineupsToMatches: vi.fn(async () => undefined),
}));

vi.mock('../src/services/matchScenarioService', () => ({
  generateMatchScenarios: vi.fn(async () => undefined),
  updateScenariosFromRealtimeEvent: vi.fn(async () => ({ matchId: 'm-1', scenarios: [] })),
  broadcastScenarioUpdate: vi.fn(async () => undefined),
}));

vi.mock('../src/models/scenarios/backtesting/scenarioBacktestRunner', () => ({
  runScenarioBacktest: vi.fn(async () => ({ matchCount: 1 })),
}));

vi.mock('../src/ai/tacticalBriefing', () => ({
  generateTacticalBriefing: vi.fn(async () => ({ matchId: 'm-1', summary: 'brief' })),
  briefingWithheldFromCache: vi.fn(() => false),
}));

vi.mock('../src/ai/multiVariableAnalysis', () => ({
  runMultiVariableAnalysis: vi.fn(async () => ({ matchId: 'm-1' })),
}));

vi.mock('../src/ai/entityExtraction', () => ({
  extractEntitiesFromArticle: vi.fn(async () => ({ teams: ['USA'], players: [], injuries: [], tacticalNotes: [], formations: [] })),
}));

vi.mock('../src/services/newsMatchImpact', () => ({
  processNewsDocumentImpact: vi.fn(async () => undefined),
}));

vi.mock('../src/db/repositories/probabilityRepo', () => ({
  getLatestSnapshot: vi.fn(async () => ({
    home_win_prob: 0.4,
    draw_prob: 0.3,
    away_win_prob: 0.3,
    expected_home_goals: 1.4,
    expected_away_goals: 1.1,
  })),
}));

describe('handleIngestBatch', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('refresh_minute enqueues model jobs when queue is bound', async () => {
    const send = vi.fn(async () => undefined);
    const env = createMockEnv({ MODEL_QUEUE: { send } as never });
    const ack = vi.fn();
    await handleIngestBatch(
      createMockMessageBatch([
        { body: { type: 'refresh_minute', idempotencyKey: 'k1' }, ack },
      ]),
      env,
    );
    expect(ack).toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith({ type: 'recompute_all', matchIds: ['m-1'] });
  });

  it('refresh_minute recomputes inline when model queue missing', async () => {
    const { recomputeMatchProbability } = await import('../src/services/recomputeMatch');
    const env = createMockEnv({ MODEL_QUEUE: undefined });
    await handleIngestBatch(
      createMockMessageBatch([{ body: { type: 'refresh_minute', idempotencyKey: 'k2' } }]),
      env,
    );
    expect(recomputeMatchProbability).toHaveBeenCalledWith(env, 'm-1');
  });

  it('match_complete processes completion and bulk recompute', async () => {
    const { processMatchCompletion } = await import('../src/services/tournamentProgression');
    const env = createMockEnv();
    await handleIngestBatch(
      createMockMessageBatch([
        { body: { type: 'match_complete', matchId: 'm-done', idempotencyKey: 'k3' } },
      ]),
      env,
    );
    expect(processMatchCompletion).toHaveBeenCalledWith(env, 'm-done');
  });

  it('crawl_news crawls news and syncs lineups', async () => {
    const { crawlWorldCupNews } = await import('../src/ingestion/newsCrawler');
    const { syncOfficialLineupsToMatches } = await import('../src/services/officialLineupSync');
    await handleIngestBatch(
      createMockMessageBatch([{ body: { type: 'crawl_news', idempotencyKey: 'k4' } }]),
      createMockEnv(),
    );
    expect(crawlWorldCupNews).toHaveBeenCalled();
    expect(syncOfficialLineupsToMatches).toHaveBeenCalled();
  });

  it('sync_leagues pulls club competitions', async () => {
    const { syncAllClubLeagues } = await import('../src/ingestion/leagues/syncLeagues');
    await handleIngestBatch(
      createMockMessageBatch([{ body: { type: 'sync_leagues', idempotencyKey: 'k-lg' } }]),
      createMockEnv(),
    );
    expect(syncAllClubLeagues).toHaveBeenCalled();
  });

  it('source_ingest schedules recompute for statsbomb changes', async () => {
    const { scheduleRecomputeAfterDataChange } = await import('../src/services/bulkRecomputeRunner');
    await handleIngestBatch(
      createMockMessageBatch([
        { body: { type: 'source_ingest', sourceId: 'statsbomb', idempotencyKey: 'k5' } },
      ]),
      createMockEnv(),
    );
    expect(scheduleRecomputeAfterDataChange).toHaveBeenCalled();
  });

  it('source_ingest schedules recompute when only teamsUpdated changes', async () => {
    const { ingestStatsbombWorldCup } = await import('../src/ingestion/statsbombIngest');
    vi.mocked(ingestStatsbombWorldCup).mockResolvedValueOnce({ matchesInserted: 0, teamsUpdated: 3 });
    const { scheduleRecomputeAfterDataChange } = await import('../src/services/bulkRecomputeRunner');
    await handleIngestBatch(
      createMockMessageBatch([
        { body: { type: 'source_ingest', sourceId: 'statsbomb', idempotencyKey: 'k5b' } },
      ]),
      createMockEnv(),
    );
    expect(scheduleRecomputeAfterDataChange).toHaveBeenCalled();
  });

  it('refresh_minute skips live recompute only while the bulk lease is active', async () => {
    const { isBulkWalkLeaseActive } = await import('../src/services/bulkRecomputeRunner');
    vi.mocked(isBulkWalkLeaseActive).mockResolvedValueOnce(true);
    const send = vi.fn();
    await handleIngestBatch(
      createMockMessageBatch([{ body: { type: 'refresh_minute', idempotencyKey: 'k5c' } }]),
      createMockEnv({ MODEL_QUEUE: { send } as never }),
    );
    expect(send).not.toHaveBeenCalled();
  });

  it('refresh_minute loads default match ids when refresh returns empty', async () => {
    const { refreshMatchData } = await import('../src/ingestion/matchDataRefresh');
    vi.mocked(refreshMatchData).mockResolvedValueOnce({
      updatedIds: [],
      completedIds: [],
      teamUpdatedIds: [],
      bracketUpdatedIds: [],
    });
    const send = vi.fn();
    await handleIngestBatch(
      createMockMessageBatch([{ body: { type: 'refresh_minute', idempotencyKey: 'k5d' } }]),
      createMockEnv({
        MODEL_QUEUE: { send } as never,
        DB: createMockDb({
          all: (sql) => {
            if (sql.includes('FROM matches')) return {};
            return { results: [] };
          },
        }),
      }),
    );
    expect(send).not.toHaveBeenCalled();
  });

  it('webhook_deliver calls deliverWebhook', async () => {
    const { deliverWebhook } = await import('../src/services/publicApi/webhooks');
    await handleIngestBatch(
      createMockMessageBatch([
        {
          body: {
            type: 'webhook_deliver',
            subscriptionId: 'sub-1',
            eventId: 42,
            idempotencyKey: 'k6',
          },
        },
      ]),
      createMockEnv(),
    );
    expect(deliverWebhook).toHaveBeenCalledWith(expect.anything(), 'sub-1', 42);
  });

  it('acks a refresh_minute older than 10 minutes without running it', async () => {
    const { refreshMatchData } = await import('../src/ingestion/matchDataRefresh');
    const ack = vi.fn();
    await handleIngestBatch(
      createMockMessageBatch([
        {
          body: { type: 'refresh_minute', idempotencyKey: 'old-tick' },
          timestamp: new Date(Date.now() - 11 * 60_000),
          ack,
        },
      ]),
      createMockEnv(),
    );
    expect(ack).toHaveBeenCalledTimes(1);
    expect(refreshMatchData).not.toHaveBeenCalled();
  });

  it('runs one refresh_minute per batch and acks the duplicate', async () => {
    const { refreshMatchData } = await import('../src/ingestion/matchDataRefresh');
    const first = vi.fn();
    const second = vi.fn();
    const env = createMockEnv();
    await handleIngestBatch(
      createMockMessageBatch([
        { body: { type: 'refresh_minute', idempotencyKey: 'tick-a' }, ack: first },
        { body: { type: 'refresh_minute', idempotencyKey: 'tick-b' }, ack: second },
      ]),
      env,
    );
    expect(refreshMatchData).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    vi.mocked(refreshMatchData).mockClear();
    const third = vi.fn();
    await handleIngestBatch(
      createMockMessageBatch([
        { body: { type: 'refresh_minute', idempotencyKey: 'tick-c' }, ack: third },
      ]),
      env,
    );
    expect(third).toHaveBeenCalledTimes(1);
    expect(refreshMatchData).not.toHaveBeenCalled();
  });

  it('acks refresh_minute when the job runs longer than the old 60s cap', async () => {
    vi.useFakeTimers();
    try {
      const { refreshMatchData } = await import('../src/ingestion/matchDataRefresh');
      vi.mocked(refreshMatchData).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  updatedIds: ['m-1'],
                  completedIds: [],
                  teamUpdatedIds: [],
                  bracketUpdatedIds: [],
                }),
              70_000,
            );
          }),
      );
      const ack = vi.fn();
      const retry = vi.fn();
      const send = vi.fn(async () => undefined);
      const pending = handleIngestBatch(
        createMockMessageBatch([
          { body: { type: 'refresh_minute', idempotencyKey: 'slow-refresh' }, ack, retry },
        ]),
        createMockEnv({ MODEL_QUEUE: { send } as never }),
      );
      await vi.advanceTimersByTimeAsync(70_000);
      await pending;
      expect(ack).toHaveBeenCalledTimes(1);
      expect(retry).not.toHaveBeenCalled();
      expect(send).toHaveBeenCalledWith({ type: 'recompute_all', matchIds: ['m-1'] });
    } finally {
      vi.useRealTimers();
    }
  });

  it('retries message on handler failure', async () => {
    const { refreshMatchData } = await import('../src/ingestion/matchDataRefresh');
    vi.mocked(refreshMatchData).mockRejectedValueOnce(new Error('boom'));
    const retry = vi.fn();
    await handleIngestBatch(
      createMockMessageBatch([
        { body: { type: 'refresh_minute', idempotencyKey: 'k7' }, retry },
      ]),
      createMockEnv(),
    );
    expect(retry).toHaveBeenCalledWith({ delaySeconds: 10 });
  });

  it('continues a statsbomb ingest from the season cursor instead of restarting', async () => {
    const { ingestStatsbombWorldCup } = await import('../src/ingestion/statsbombIngest');
    const { scheduleRecomputeAfterDataChange } = await import('../src/services/bulkRecomputeRunner');
    vi.mocked(ingestStatsbombWorldCup).mockResolvedValueOnce({
      seasonsProcessed: 1,
      matchesInserted: 1,
      matchesSkipped: 0,
      teamsUpdated: 0,
      done: false,
      seasonCursor: 1,
    });
    const send = vi.fn(async () => undefined);
    await handleIngestBatch(
      createMockMessageBatch([
        { body: { type: 'source_ingest', sourceId: 'statsbomb', idempotencyKey: 'k-sb' } },
      ]),
      createMockEnv({ INGEST_QUEUE: { send } as never }),
    );
    expect(scheduleRecomputeAfterDataChange).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'source_ingest', sourceId: 'statsbomb', seasonCursor: 1 }),
    );
  });

  it('continues a news crawl from the feed cursor', async () => {
    const { crawlWorldCupNews } = await import('../src/ingestion/newsCrawler');
    const { syncOfficialLineupsToMatches } = await import('../src/services/officialLineupSync');
    vi.mocked(crawlWorldCupNews).mockResolvedValueOnce({ inserted: 1, done: false, feedCursor: 4 } as never);
    const send = vi.fn(async () => undefined);
    await handleIngestBatch(
      createMockMessageBatch([{ body: { type: 'crawl_news', idempotencyKey: 'k-news' } }]),
      createMockEnv({ INGEST_QUEUE: { send } as never }),
    );
    expect(syncOfficialLineupsToMatches).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'crawl_news', feedCursor: 4 }));
  });

  it('continues league sync from the next league', async () => {
    const { syncAllClubLeagues } = await import('../src/ingestion/leagues/syncLeagues');
    const partial = Object.assign([{ leagueId: 't-la-liga', matchesUpserted: 1 }], {
      done: false,
      leagueCursor: 1,
    });
    vi.mocked(syncAllClubLeagues).mockResolvedValueOnce(partial as never);
    const send = vi.fn(async () => undefined);
    await handleIngestBatch(
      createMockMessageBatch([{ body: { type: 'sync_leagues', idempotencyKey: 'k-lg2' } }]),
      createMockEnv({ INGEST_QUEUE: { send } as never }),
    );
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'sync_leagues', leagueCursor: 1 }));
  });

  it('defers a later ingest message without spending a retry', async () => {
    const { refreshMatchData } = await import('../src/ingestion/matchDataRefresh');
    const { deliverWebhook } = await import('../src/services/publicApi/webhooks');
    let clock = Date.now();
    const now = vi.spyOn(Date, 'now').mockImplementation(() => clock);
    vi.mocked(refreshMatchData).mockImplementationOnce(async () => {
      clock += 240_000;
      return { updatedIds: [], completedIds: [], teamUpdatedIds: [], bracketUpdatedIds: [] };
    });
    const retry = vi.fn();
    const ack = vi.fn();
    const send = vi.fn(async () => undefined);
    try {
      await handleIngestBatch(
        createMockMessageBatch([
          { body: { type: 'refresh_minute', idempotencyKey: 'k-defer' } },
          {
            body: { type: 'webhook_deliver', subscriptionId: 'wh-1', eventId: 9, idempotencyKey: 'k-wh' },
            retry,
            ack,
          },
        ]),
        createMockEnv({ INGEST_QUEUE: { send } as never }),
      );
    } finally {
      now.mockRestore();
    }
    expect(retry).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalled();
    expect(deliverWebhook).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'webhook_deliver', subscriptionId: 'wh-1', eventId: 9 }),
    );
  });

  it('a slow ingest message does not hold the rest of the batch', async () => {
    const { refreshMatchData } = await import('../src/ingestion/matchDataRefresh');
    const { deliverWebhook } = await import('../src/services/publicApi/webhooks');
    vi.mocked(refreshMatchData).mockImplementationOnce(() => new Promise(() => undefined));
    const retry = vi.fn();
    const ack = vi.fn();
    await handleIngestBatch(
      createMockMessageBatch([
        { body: { type: 'refresh_minute', idempotencyKey: 'slow' }, retry },
        { body: { type: 'webhook_deliver', subscriptionId: 'wh-1', eventId: 3 }, ack },
      ]),
      createMockEnv(),
      { deadlineMs: 500, messageTimeoutMs: 30 },
    );
    expect(retry).toHaveBeenCalled();
    expect(deliverWebhook).toHaveBeenCalled();
    expect(ack).toHaveBeenCalled();
  });
});

describe('handleModelBatch', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('recompute chains briefing and analysis jobs', async () => {
    const send = vi.fn(async () => undefined);
    const env = createMockEnv({ MODEL_QUEUE: { send } as never, AI_FALLBACK_MODE: 'true' });
    await handleModelBatch(
      createMockMessageBatch([{ body: { type: 'recompute', matchId: 'm-1' } }]),
      env,
    );
    expect(send).toHaveBeenCalledWith({ type: 'ai_briefing', matchId: 'm-1' });
    expect(send).toHaveBeenCalledWith({ type: 'ai_multi_analyze', matchId: 'm-1' });
    expect(env.KV.put).toHaveBeenCalledWith(
      'briefing:inflight:m-1',
      expect.stringMatching(/^1:\d+$/),
      expect.any(Object),
    );
  });

  it('recompute_all sets an in-flight marker for each briefing it queues', async () => {
    const send = vi.fn(async () => undefined);
    const env = createMockEnv({ MODEL_QUEUE: { send } as never, AI_FALLBACK_MODE: 'true' });
    await handleModelBatch(
      createMockMessageBatch([{ body: { type: 'recompute_all', matchIds: ['m-1', 'm-2'] } }]),
      env,
    );
    expect(send).toHaveBeenCalledWith({ type: 'ai_briefing', matchId: 'm-1' });
    expect(send).toHaveBeenCalledWith({ type: 'ai_briefing', matchId: 'm-2' });
    expect(env.KV.put).toHaveBeenCalledWith(
      'briefing:inflight:m-1',
      expect.stringMatching(/^1:\d+$/),
      expect.any(Object),
    );
    expect(env.KV.put).toHaveBeenCalledWith(
      'briefing:inflight:m-2',
      expect.stringMatching(/^1:\d+$/),
      expect.any(Object),
    );
  });

  it('PRE_MATCH_RECOMPUTE generates scenarios', async () => {
    const { generateMatchScenarios } = await import('../src/services/matchScenarioService');
    await handleModelBatch(
      createMockMessageBatch([{ body: { type: 'PRE_MATCH_RECOMPUTE', matchId: 'm-1' } }]),
      createMockEnv(),
    );
    expect(generateMatchScenarios).toHaveBeenCalled();
  });

  it('LIVE_RECOMPUTE broadcasts scenario updates', async () => {
    const { broadcastScenarioUpdate } = await import('../src/services/matchScenarioService');
    await handleModelBatch(
      createMockMessageBatch([{ body: { type: 'LIVE_RECOMPUTE', matchId: 'm-1', eventId: 'e-1' } }]),
      createMockEnv(),
    );
    expect(broadcastScenarioUpdate).toHaveBeenCalled();
  });

  it('LIVE_RECOMPUTE generates eventId when omitted', async () => {
    const { updateScenariosFromRealtimeEvent } = await import('../src/services/matchScenarioService');
    vi.mocked(updateScenariosFromRealtimeEvent).mockResolvedValueOnce(null);
    const { broadcastScenarioUpdate } = await import('../src/services/matchScenarioService');
    await handleModelBatch(
      createMockMessageBatch([{ body: { type: 'LIVE_RECOMPUTE', matchId: 'm-1' } }]),
      createMockEnv(),
    );
    expect(updateScenariosFromRealtimeEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ matchId: 'm-1', eventId: expect.any(String) }),
    );
    expect(broadcastScenarioUpdate).not.toHaveBeenCalled();
  });

  it('SCENARIO_RECOMPUTE skips broadcast when update returns null', async () => {
    const { updateScenariosFromRealtimeEvent, broadcastScenarioUpdate } = await import(
      '../src/services/matchScenarioService'
    );
    vi.mocked(updateScenariosFromRealtimeEvent).mockResolvedValueOnce(null);
    await handleModelBatch(
      createMockMessageBatch([{ body: { type: 'SCENARIO_RECOMPUTE', matchId: 'm-1' } }]),
      createMockEnv(),
    );
    expect(broadcastScenarioUpdate).not.toHaveBeenCalled();
  });

  it('SCENARIO_BACKTEST runs backtest runner', async () => {
    const { runScenarioBacktest } = await import('../src/models/scenarios/backtesting/scenarioBacktestRunner');
    await handleModelBatch(
      createMockMessageBatch([{ body: { type: 'SCENARIO_BACKTEST', tournamentYear: 2026 } }]),
      createMockEnv(),
    );
    expect(runScenarioBacktest).toHaveBeenCalledWith(expect.anything(), 2026);
  });

  it('ai_briefing caches briefing in KV', async () => {
    const env = createMockEnv({ AI_FALLBACK_MODE: 'true' });
    await handleModelBatch(
      createMockMessageBatch([{ body: { type: 'ai_briefing', matchId: 'm-1' } }]),
      env,
    );
    expect(env.KV.put).toHaveBeenCalledWith(
      'briefing:m-1',
      expect.any(String),
      expect.objectContaining({ expirationTtl: 3600 }),
    );
  });

  it('ai_briefing does not call the model when the in-flight marker is withheld', async () => {
    const { generateTacticalBriefing } = await import('../src/ai/tacticalBriefing');
    const env = createMockEnv({ AI_FALLBACK_MODE: 'false' });
    await env.KV.put('briefing:inflight:m-1', 'withheld');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await handleModelBatch(
      createMockMessageBatch([{ body: { type: 'ai_briefing', matchId: 'm-1' } }]),
      env,
    );
    expect(generateTacticalBriefing).not.toHaveBeenCalled();
    expect(warn.mock.calls.map((call) => String(call[0])).join('\n')).toContain('tactical briefing skipped');
    expect(await env.KV.get('briefing:inflight:m-1')).toBe('withheld');
    warn.mockRestore();
  });

  it('ai_briefing marks the in-flight key withheld when the briefing is not cached', async () => {
    const { briefingWithheldFromCache } = await import('../src/ai/tacticalBriefing');
    const { BRIEFING_INFLIGHT_TTL_SECONDS } = await import('../src/ai/briefingQueue');
    vi.mocked(briefingWithheldFromCache).mockReturnValueOnce(true);
    const env = createMockEnv({ AI_FALLBACK_MODE: 'true' });
    await handleModelBatch(
      createMockMessageBatch([{ body: { type: 'ai_briefing', matchId: 'm-1' } }]),
      env,
    );
    expect(env.KV.put).toHaveBeenCalledWith(
      'briefing:inflight:m-1',
      'withheld',
      { expirationTtl: BRIEFING_INFLIGHT_TTL_SECONDS },
    );
    expect(env.KV.put).not.toHaveBeenCalledWith('briefing:m-1', expect.any(String), expect.anything());
    expect(env.KV.delete).not.toHaveBeenCalled();
  });

  it('ai_briefing warns when the snapshot is missing', async () => {
    const { getLatestSnapshot } = await import('../src/db/repositories/probabilityRepo');
    const { generateTacticalBriefing } = await import('../src/ai/tacticalBriefing');
    vi.mocked(getLatestSnapshot).mockResolvedValueOnce(null as never);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await handleModelBatch(
      createMockMessageBatch([{ body: { type: 'ai_briefing', matchId: 'm-missing' } }]),
      createMockEnv(),
    );
    const logged = warn.mock.calls.map((call) => String(call[0])).join('\n');
    expect(logged).toContain('tactical briefing snapshot missing');
    expect(logged).toContain('m-missing');
    expect(generateTacticalBriefing).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('ai_briefing warns when a slug cannot be resolved', async () => {
    const { generateTacticalBriefing } = await import('../src/ai/tacticalBriefing');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await handleModelBatch(
      createMockMessageBatch([{ body: { type: 'ai_briefing', matchId: 'vong-bang-c-brazil-vs-haiti' } }]),
      createMockEnv(),
    );
    const logged = warn.mock.calls.map((call) => String(call[0])).join('\n');
    expect(logged).toContain('tactical briefing match ref unresolved');
    expect(logged).toContain('vong-bang-c-brazil-vs-haiti');
    expect(generateTacticalBriefing).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('ai_extract_news updates document entities', async () => {
    const env = createMockEnv({
      DB: createMockDb({ run: () => ({ success: true }) }),
    });
    await handleModelBatch(
      createMockMessageBatch([
        {
          body: {
            type: 'ai_extract_news',
            documentId: 'doc-1',
            content: 'USA lineup news',
          },
        },
      ]),
      env,
    );
    expect(env.DB.prepare).toHaveBeenCalled();
  });

  it('acks a stale ai_briefing without calling the model and counts the drop', async () => {
    const { generateTacticalBriefing } = await import('../src/ai/tacticalBriefing');
    const ack = vi.fn();
    const retry = vi.fn();
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await handleModelBatch(
      createMockMessageBatch([
        {
          body: { type: 'ai_briefing', matchId: 'm-1' },
          timestamp: new Date(Date.now() - AI_BRIEFING_QUEUE_MAX_AGE_MS - 1_000),
          ack,
          retry,
        },
      ]),
      createMockEnv(),
    );
    expect(generateTacticalBriefing).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();
    const logged = log.mock.calls.map((call) => String(call[0])).join('\n');
    expect(logged).toContain('model queue dropped stale');
    expect(logged).toContain('"dropped":1');
    log.mockRestore();
  });

  it('does not drop a fresh briefing that has been waiting behind other AI jobs', async () => {
    const { generateTacticalBriefing } = await import('../src/ai/tacticalBriefing');
    const ack = vi.fn();
    await handleModelBatch(
      createMockMessageBatch([
        {
          body: { type: 'ai_briefing', matchId: 'm-1' },
          timestamp: new Date(Date.now() - 600_000),
          ack,
        },
      ]),
      createMockEnv({ AI_FALLBACK_MODE: 'true' }),
    );
    expect(generateTacticalBriefing).toHaveBeenCalled();
    expect(ack).toHaveBeenCalled();
  });

  it('counts stale drops in KV for the health endpoint', async () => {
    const env = createMockEnv();
    await handleModelBatch(
      createMockMessageBatch([
        { body: { type: 'ai_briefing', matchId: 'm-old' }, timestamp: new Date(Date.now() - AI_BRIEFING_QUEUE_MAX_AGE_MS - 5_000) },
      ]),
      env,
    );
    expect(await env.KV.get(MODEL_QUEUE_STALE_DROPS_KEY)).toBe('1');
  });

  it('acks an unknown job type without calling the model', async () => {
    const { generateTacticalBriefing } = await import('../src/ai/tacticalBriefing');
    const { recomputeMatchProbability } = await import('../src/services/recomputeMatch');
    const ack = vi.fn();
    await handleModelBatch(
      createMockMessageBatch([{ body: { type: 'retired_bulk_score' } as never, ack }]),
      createMockEnv(),
    );
    expect(ack).toHaveBeenCalledTimes(1);
    expect(generateTacticalBriefing).not.toHaveBeenCalled();
    expect(recomputeMatchProbability).not.toHaveBeenCalled();
  });

  it('runs a fresh ai_briefing before other fresh work in the same batch', async () => {
    const { generateTacticalBriefing } = await import('../src/ai/tacticalBriefing');
    const { recomputeMatchProbability } = await import('../src/services/recomputeMatch');
    const order: string[] = [];
    vi.mocked(generateTacticalBriefing).mockImplementationOnce(async () => {
      order.push('briefing');
      return { matchId: 'm-1', summary: 'brief' };
    });
    vi.mocked(recomputeMatchProbability).mockImplementationOnce(async () => {
      order.push('recompute');
    });
    await handleModelBatch(
      createMockMessageBatch([
        { body: { type: 'recompute', matchId: 'm-1' } },
        { body: { type: 'ai_briefing', matchId: 'm-2' } },
      ]),
      createMockEnv({ AI_FALLBACK_MODE: 'true' }),
    );
    expect(order[0]).toBe('briefing');
    expect(order).toEqual(['briefing', 'recompute']);
  });

  it('finishes a briefing before a slow bulk job in the same batch', async () => {
    const { runBulkRecomputeIfPending } = await import('../src/services/bulkRecomputeRunner');
    const { generateTacticalBriefing } = await import('../src/ai/tacticalBriefing');
    const order: string[] = [];
    let releaseBulk: () => void = () => undefined;
    vi.mocked(generateTacticalBriefing).mockImplementationOnce(async () => {
      order.push('briefing');
      return { matchId: 'm-2', summary: 'brief' };
    });
    vi.mocked(runBulkRecomputeIfPending).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          order.push('bulk-start');
          releaseBulk = () => {
            order.push('bulk-end');
            resolve(true);
          };
        }),
    );
    const briefingAck = vi.fn();
    const started = Date.now();
    const pending = handleModelBatch(
      createMockMessageBatch([
        { body: { type: 'recompute_wc2026_bulk' } },
        { body: { type: 'ai_briefing', matchId: 'm-2' }, ack: briefingAck },
      ]),
      createMockEnv({ AI_FALLBACK_MODE: 'true' }),
    );

    await vi.waitFor(() => expect(briefingAck).toHaveBeenCalled());
    expect(Date.now() - started).toBeLessThan(1_000);
    expect(order[0]).toBe('briefing');
    expect(order).not.toContain('bulk-end');
    releaseBulk();
    await pending;
    expect(order).toEqual(['briefing', 'bulk-start', 'bulk-end']);
  });

  it('retries a timed-out briefing and still acks the next message', async () => {
    vi.useFakeTimers({ now: Date.now() });
    try {
      const { generateTacticalBriefing } = await import('../src/ai/tacticalBriefing');
      const { recomputeMatchProbability } = await import('../src/services/recomputeMatch');
      vi.mocked(recomputeMatchProbability).mockClear();
      const retry = vi.fn();
      const ack = vi.fn();
      vi.mocked(generateTacticalBriefing).mockImplementationOnce(
        (_env, _input, options) =>
          new Promise((_resolve, reject) => {
            options?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
          }),
      );
      const pending = handleModelBatch(
        createMockMessageBatch([
          { body: { type: 'ai_briefing', matchId: 'm-slow' }, retry },
          { body: { type: 'recompute', matchId: 'm-next' }, ack },
        ]),
        createMockEnv({ AI_FALLBACK_MODE: 'true' }),
      );
      await vi.advanceTimersByTimeAsync(AI_MESSAGE_TIMEOUT_MS);
      await pending;
      expect(retry).toHaveBeenCalledTimes(1);
      expect(ack).toHaveBeenCalled();
      expect(recomputeMatchProbability).toHaveBeenCalledWith(expect.anything(), 'm-next');
    } finally {
      vi.useRealTimers();
    }
  });

  it('retries on model job failure', async () => {
    const { recomputeMatchProbability } = await import('../src/services/recomputeMatch');
    vi.mocked(recomputeMatchProbability).mockRejectedValueOnce(new Error('fail'));
    const retry = vi.fn();
    await handleModelBatch(
      createMockMessageBatch([{ body: { type: 'recompute', matchId: 'm-1' }, retry, attempts: 2 }]),
      createMockEnv(),
    );
    expect(retry).toHaveBeenCalledWith({ delaySeconds: 30 });
  });

  it('retries a message that does not finish and still runs the next one', async () => {
    const { recomputeMatchProbability } = await import('../src/services/recomputeMatch');
    const { generateMatchScenarios } = await import('../src/services/matchScenarioService');
    vi.mocked(recomputeMatchProbability).mockImplementationOnce(() => new Promise(() => undefined));
    const retry = vi.fn();
    const ack = vi.fn();
    await handleModelBatch(
      createMockMessageBatch([
        { body: { type: 'recompute', matchId: 'm-slow' }, retry },
        { body: { type: 'PRE_MATCH_RECOMPUTE', matchId: 'm-next' }, ack },
      ]),
      createMockEnv(),
      { deadlineMs: 500, messageTimeoutMs: 30 },
    );
    expect(retry).toHaveBeenCalled();
    expect(generateMatchScenarios).toHaveBeenCalled();
    expect(ack).toHaveBeenCalled();
  });

  it('defers the rest of the batch once the 4 minute deadline is spent', async () => {
    const { recomputeMatchProbability } = await import('../src/services/recomputeMatch');
    const { generateMatchScenarios } = await import('../src/services/matchScenarioService');
    let clock = Date.now();
    const now = vi.spyOn(Date, 'now').mockImplementation(() => clock);
    vi.mocked(recomputeMatchProbability).mockImplementationOnce(async () => {
      clock += CONSUMER_BATCH_DEADLINE_MS;
    });
    const retry = vi.fn();
    const ack = vi.fn();
    const send = vi.fn(async () => undefined);
    try {
      await handleModelBatch(
        createMockMessageBatch([
          { body: { type: 'recompute', matchId: 'm-1' } },
          { body: { type: 'PRE_MATCH_RECOMPUTE', matchId: 'm-2' }, retry, ack },
        ]),
        createMockEnv({ MODEL_QUEUE: { send } as never }),
      );
    } finally {
      now.mockRestore();
    }
    expect(retry).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith({ type: 'PRE_MATCH_RECOMPUTE', matchId: 'm-2' });
    expect(generateMatchScenarios).not.toHaveBeenCalled();
  });
});

describe('queueRetryDelaySeconds', () => {
  it('grows 10/30/90/300 and stays at the cap', () => {
    expect(queueRetryDelaySeconds(undefined)).toBe(10);
    expect(queueRetryDelaySeconds(1)).toBe(10);
    expect(queueRetryDelaySeconds(2)).toBe(30);
    expect(queueRetryDelaySeconds(3)).toBe(90);
    expect(queueRetryDelaySeconds(4)).toBe(300);
    expect(queueRetryDelaySeconds(9)).toBe(300);
  });
});
