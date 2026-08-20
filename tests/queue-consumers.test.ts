import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleIngestBatch } from '../src/queues/ingestConsumer';
import { handleModelBatch } from '../src/queues/modelConsumer';
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

vi.mock('../src/ingestion/leagues/syncLeagues', () => ({
  syncAllClubLeagues: vi.fn(async () => [{ leagueId: 't-la-liga', matchesUpserted: 1 }]),
  syncLeague: vi.fn(async () => ({ leagueId: 't-la-liga', matchesUpserted: 1 })),
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

  it('refresh_minute breaks early when bulk recompute is pending', async () => {
    const { runBulkRecomputeIfPending } = await import('../src/services/bulkRecomputeRunner');
    vi.mocked(runBulkRecomputeIfPending).mockResolvedValueOnce(true);
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
    expect(retry).toHaveBeenCalled();
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

  it('retries on model job failure', async () => {
    const { recomputeMatchProbability } = await import('../src/services/recomputeMatch');
    vi.mocked(recomputeMatchProbability).mockRejectedValueOnce(new Error('fail'));
    const retry = vi.fn();
    await handleModelBatch(
      createMockMessageBatch([{ body: { type: 'recompute', matchId: 'm-1' }, retry }]),
      createMockEnv(),
    );
    expect(retry).toHaveBeenCalled();
  });
});
