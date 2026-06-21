import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../src/db/client';
import { getMatchRecap } from '../src/services/matchRecap';
import { getMatchStats } from '../src/services/matchStats';
import { getMatchSnapshot } from '../src/services/publicApi/snapshot';
import {
  getProbabilityMovement,
  getTeamSystemPayload,
  mapTeamSystemRow,
} from '../src/services/matchIntelligence';
import { buildTeamSystemProfile } from '../src/models/probability/teamSystemStrength';
import {
  createWebhook,
  deleteWebhook,
  deliverWebhook,
  enqueueWebhookDeliveries,
  listWebhooks,
} from '../src/services/publicApi/webhooks';
import { handleIngestBatch } from '../src/queues/ingestConsumer';
import { handleModelBatch } from '../src/queues/modelConsumer';
import { mockScoreAtMinute } from '../src/services/matchLifecycle';
import { MatchRoom } from '../src/durable-objects/MatchRoom';
import { explainTeamSystemStrength } from '../src/ai/explainTeamSystemStrength';
import {
  buildCandidateScenarios,
  ensureAtLeastTwoScenarios,
} from '../src/models/scenarios/scenarioGenerator';
import { runScenarioProbabilityModel } from '../src/models/scenarios/scenarioEngine';
import { selectScenarioFeatures } from '../src/models/scenarios/scenarioFeatureSelector';
import { createMockDb, createMockEnv, createMockKv } from './helpers/mockEnv';
import { FIXTURE_MATCH, FIXTURE_SNAPSHOT, FIXTURE_TEAMS } from './helpers/fixtures';
import { createMockMessageBatch } from './helpers/mockMessageBatch';
import { mockScenarioContext } from './helpers/scenarioFixtures';

vi.mock('../src/ingestion/fifa/fifaLiveSync', () => ({
  shouldSyncFifaMatch: vi.fn(async () => true),
  syncFifaMatchByRef: vi.fn(async () => undefined),
}));

vi.mock('../src/ingestion/fifa/fifaLiveBlogSync', () => ({
  shouldSyncFifaBlogAndStats: vi.fn(async () => true),
  ensureFifaBlogAndStats: vi.fn(async () => undefined),
}));

vi.mock('../src/ingestion/fifa/teamMatchStatsComplete', () => ({
  loadTeamMatchStatsCompleteness: vi.fn(async () => ({ complete: false })),
}));

vi.mock('../src/services/bulkRecomputeRunner', () => ({
  runBulkRecomputeIfPending: vi.fn(async () => false),
  scheduleRecomputeAfterDataChange: vi.fn(async () => undefined),
}));

vi.mock('../src/services/recomputeMatch', () => ({
  recomputeMatchProbability: vi.fn(async () => undefined),
}));

vi.mock('../src/ingestion/matchDataRefresh', () => ({
  refreshMatchData: vi.fn(async () => ({ updatedIds: [], completedIds: ['m-done'] })),
  handleCompletedMatches: vi.fn(async () => undefined),
}));

vi.mock('../src/ingestion/newsCrawler', () => ({
  crawlWorldCupNews: vi.fn(async () => 1),
}));

vi.mock('../src/ingestion/statsbombIngest', () => ({
  ingestStatsbombWorldCup: vi.fn(async () => ({ matchesInserted: 2, teamsUpdated: 1 })),
}));

vi.mock('../src/ingestion/sourceRegistry', () => ({
  getIngestHandler: vi.fn((sourceId: string) => (sourceId === 'statsbomb' ? 'statsbomb' : null)),
}));

vi.mock('../src/services/tournamentProgression', () => ({
  processMatchCompletion: vi.fn(async () => undefined),
}));

vi.mock('../src/models/scenarios/backtesting/scenarioBacktestRunner', () => ({
  runScenarioBacktest: vi.fn(async () => ({ matchCount: 1 })),
}));

vi.mock('../src/ai/tacticalBriefing', () => ({
  generateTacticalBriefing: vi.fn(async () => ({ matchId: 'm-1', summary: { vi: 'x', en: 'y' } })),
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

vi.mock('../src/db/repositories/probabilityRepo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/db/repositories/probabilityRepo')>();
  return {
    ...actual,
    getLatestSnapshot: vi.fn(actual.getLatestSnapshot),
  };
});

describe('coverage branches — global backend gaps', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('getDb returns env.DB', () => {
    const db = createMockDb();
    expect(getDb(createMockEnv({ DB: db }))).toBe(db);
  });

  it('getMatchRecap triggers FIFA sync when live enabled', async () => {
    const { syncFifaMatchByRef } = await import('../src/ingestion/fifa/fifaLiveSync');
    const kv = createMockKv({
      [`cache:match-ref:${FIXTURE_MATCH.id}`]: JSON.stringify({
        ...FIXTURE_MATCH,
        slug: FIXTURE_MATCH.id,
        status: 'live',
      }),
    });
    const env = createMockEnv({
      DB: createMockDb({
        first: (sql) => {
          if (sql.includes('FROM matches m')) {
            return { ...FIXTURE_MATCH, slug: FIXTURE_MATCH.id, status: 'live' };
          }
          if (sql.includes('FROM match_recaps')) {
            return {
              summary_vi: 'Tóm tắt',
              summary_en: 'Summary',
              source_id: 'fifa',
              updated_at: '2026-06-12T00:00:00Z',
            };
          }
          return null;
        },
        all: () => ({ results: [] }),
      }),
      KV: kv,
      FIFA_LIVE_ENABLED: 'true',
    });
    await getMatchRecap(env, FIXTURE_MATCH.id);
    expect(syncFifaMatchByRef).toHaveBeenCalled();
  });

  it('getMatchStats covers ESPN and FIFA-only data source labels', async () => {
    const kv = createMockKv({
      [`cache:match-ref:${FIXTURE_MATCH.id}`]: JSON.stringify({
        ...FIXTURE_MATCH,
        slug: FIXTURE_MATCH.id,
        status: 'live',
      }),
    });
    const env = createMockEnv({
      DB: createMockDb({
        first: (sql, binds) => {
          if (sql.includes('FROM matches m')) {
            return { ...FIXTURE_MATCH, slug: FIXTURE_MATCH.id, status: 'live' };
          }
          if (sql.includes('FROM teams WHERE id')) {
            return binds[0] === FIXTURE_MATCH.home_team_id
              ? { id: FIXTURE_MATCH.home_team_id, name: 'Mexico' }
              : { id: FIXTURE_MATCH.away_team_id, name: 'South Africa' };
          }
          if (sql.includes('FROM match_events')) {
            return { goals: 1, yellow_cards: 0, red_cards: 0, substitutions: 0 };
          }
          if (sql.includes('SELECT status, minute')) {
            return { status: 'live', minute: 55, home_score: 1, away_score: 0, updated_at: '2026-06-11T20:00:00Z' };
          }
          if (sql.includes('FROM match_recaps')) return null;
          return null;
        },
        all: (sql) => {
          if (sql.includes('FROM team_match_stats')) {
            return {
              results: [
                {
                  team_id: FIXTURE_MATCH.home_team_id,
                  possession: 0,
                  shots: 5,
                  shots_on_target: 2,
                  xg: 0.8,
                  passes: 0,
                  pass_accuracy: null,
                  created_at: '2026-06-11T20:00:00Z',
                },
              ],
            };
          }
          return { results: [] };
        },
      }),
      KV: kv,
      FIFA_LIVE_ENABLED: 'true',
    });
    const payload = await getMatchStats(env, FIXTURE_MATCH.id);
    expect(payload?.dataSourceLabel).toBe('FIFA Match Centre');
    expect(payload?.xgEstimateNote).toContain('ước tính');
  });

  it('getMatchSnapshot includes recap summary when available', async () => {
    const kv = createMockKv({
      [`cache:match-ref:${FIXTURE_MATCH.id}`]: JSON.stringify({
        ...FIXTURE_MATCH,
        slug: FIXTURE_MATCH.id,
        home_name: 'Mexico',
        away_name: 'South Africa',
        status: 'completed',
      }),
    });
    const env = createMockEnv({
      DB: createMockDb({
        first: (sql) => {
          if (sql.includes('FROM matches m')) {
            return {
              ...FIXTURE_MATCH,
              slug: FIXTURE_MATCH.id,
              home_name: 'Mexico',
              away_name: 'South Africa',
              status: 'completed',
            };
          }
          if (sql.includes('FROM match_recaps')) {
            return {
              summary_vi: 'Tóm tắt',
              summary_en: 'Recap EN',
              source_id: 'fifa',
              updated_at: '2026-06-12T00:00:00Z',
            };
          }
          if (sql.includes('FROM teams WHERE id')) {
            return { id: FIXTURE_MATCH.home_team_id, name: 'Mexico' };
          }
          if (sql.includes('FROM match_events')) {
            return { goals: 0, yellow_cards: 0, red_cards: 0, substitutions: 0 };
          }
          if (sql.includes('SELECT status, minute')) {
            return { status: 'completed', minute: 90, home_score: 2, away_score: 0, updated_at: '2026-06-12T00:00:00Z' };
          }
          return null;
        },
        all: (sql) => {
          if (sql.includes('FROM match_commentary')) {
            return { results: [{ id: 'c1', minute: 10, period: '1H', text_vi: 'G', text_en: 'G', event_type: 'goal' }] };
          }
          if (sql.includes('FROM player_match_stats')) return { results: [] };
          if (sql.includes('FROM team_match_stats')) return { results: [] };
          if (sql.includes('FROM match_events')) return { results: [] };
          return { results: [] };
        },
      }),
      KV: kv,
      MOCK_SOURCES: 'true',
    });
    const snap = await getMatchSnapshot(env, FIXTURE_MATCH.id);
    expect(snap?.recap?.summaryEn).toBe('Recap EN');
    expect(snap?.recap?.commentaryCount).toBe(1);
  });

  it('mapTeamSystemRow uses fallback profile when row missing', () => {
    const fallback = buildTeamSystemProfile(
      {
        teamId: FIXTURE_TEAMS[0].id,
        eloRating: 1800,
        fifaRanking: 10,
        recentForm: 0.2,
        goalDifference: 0,
        xgDifference: 0,
        xgFor: 1.2,
        xgAgainst: 1.1,
        possessionProfile: 0.5,
        fieldTilt: 0.5,
        ppda: 10,
        highTurnovers: 0.5,
        transitionThreat: 0.5,
        setPieceXg: 0.2,
        setPieceXga: 0.2,
        defensiveCompactness: 0.5,
        formationStability: 0.5,
        benchDepth: 0.5,
        goalkeeperStrength: 0.5,
        restDays: 3,
      },
      '4-3-3',
    );
    const mapped = mapTeamSystemRow(null, fallback);
    expect(mapped?.teamId).toBe(FIXTURE_TEAMS[0].id);
    expect(mapped?.tacticalIdentity).toBe(fallback.tacticalIdentity);
  });

  it('getTeamSystemPayload maps stored rows with null source id', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        first: (sql, binds) => {
          if (sql.includes('FROM matches WHERE id')) return FIXTURE_MATCH;
          if (sql.includes('FROM team_system_profiles')) {
            return {
              team_id: binds[0],
              tactical_identity: 'balanced_block',
              primary_formation: '4-4-2',
              collective_strength_score: 0.5,
              formation_stability_score: 0.5,
              pressing_score: 0.5,
              defensive_compactness_score: 0.5,
              transition_score: 0.5,
              set_piece_score: 0.5,
              bench_depth_score: 0.5,
              lineup_cohesion_score: 0.5,
              possession_control_score: 0.5,
              tempo_score: 0.5,
              model_version: 'wc-prob-v2',
              source_id: null,
            };
          }
          return null;
        },
      }),
    });
    const payload = await getTeamSystemPayload(env, FIXTURE_MATCH.id);
    expect(payload?.home?.teamId).toBe(FIXTURE_MATCH.home_team_id);
    expect(payload?.home?.sourceId).toBeNull();
  });

  it('getProbabilityMovement labels live and recalc reason codes', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        all: () => ({
          results: [
            {
              minute: 0,
              home_win_prob: 0.5,
              draw_prob: 0.25,
              away_win_prob: 0.25,
              created_at: '2026-01-01T00:00:00Z',
              model_version: 'v1',
            },
            {
              minute: 0,
              home_win_prob: 0.5,
              draw_prob: 0.25,
              away_win_prob: 0.25,
              created_at: '2026-01-01T00:05:00Z',
              model_version: 'v1',
            },
            {
              minute: 30,
              home_win_prob: 0.55,
              draw_prob: 0.22,
              away_win_prob: 0.23,
              created_at: '2026-01-01T01:00:00Z',
              model_version: 'v1',
            },
            {
              minute: 20,
              home_win_prob: 0.52,
              draw_prob: 0.24,
              away_win_prob: 0.24,
              created_at: '2026-01-01T01:30:00Z',
              model_version: 'v1',
            },
          ],
        }),
      }),
    });
    const movement = await getProbabilityMovement(env, FIXTURE_MATCH.id);
    expect(movement.events.some((e) => e.reasonCode === 'baseline')).toBe(true);
    expect(movement.events.some((e) => e.reasonCode === 'live')).toBe(true);
    expect(movement.events.some((e) => e.reasonCode === 'recalc')).toBe(true);
  });

  it('webhooks parseEventsJson handles invalid JSON and filtered deliveries', async () => {
    const send = vi.fn(async () => undefined);
    const env = createMockEnv({
      INGEST_QUEUE: { send } as never,
      DB: createMockDb({
        all: () => ({
          results: [
            {
              id: 'wh-1',
              client_id: 'c1',
              url: 'https://hook.example.com',
              secret: 'whsec_test',
              events_json: '{bad',
            },
            {
              id: 'wh-2',
              client_id: 'c1',
              url: 'https://hook2.example.com',
              secret: 'whsec_test2',
              events_json: '["match.completed"]',
            },
          ],
        }),
      }),
    });
    await enqueueWebhookDeliveries(env, {
      id: 1,
      type: 'match.score_updated',
      matchId: FIXTURE_MATCH.id,
      createdAt: '2026-01-01T00:00:00Z',
      data: {},
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('deliverWebhook returns false for disabled subscription or missing feed row', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        first: (sql) => {
          if (sql.includes('api_webhook_subscriptions')) {
            return { id: 'wh-1', url: 'https://hook.example.com', secret: 'whsec_test', enabled: 0 };
          }
          return null;
        },
      }),
    });
    expect(await deliverWebhook(env, 'wh-1', 99)).toEqual({ ok: false });
  });

  it('deliverWebhook catches fetch failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network'); }));
    const env = createMockEnv({
      DB: createMockDb({
        first: (sql) => {
          if (sql.includes('api_webhook_subscriptions')) {
            return { id: 'wh-1', url: 'https://hook.example.com', secret: 'whsec_test', enabled: 1 };
          }
          if (sql.includes('api_feed_events')) {
            return {
              id: 7,
              event_type: 'match.score_updated',
              match_id: FIXTURE_MATCH.id,
              payload_json: '{}',
              created_at: '2026-01-01T00:00:00Z',
            };
          }
          return null;
        },
      }),
    });
    expect(await deliverWebhook(env, 'wh-1', 7)).toEqual({ ok: false });
  });

  it('createWebhook defaults events to wildcard', async () => {
    const env = createMockEnv({ DB: createMockDb({ run: () => ({ success: true }) }) });
    const { subscription } = await createWebhook(env, 'client-1', 'https://hook.example.com', []);
    expect(subscription.events).toEqual(['*']);
  });

  it('listWebhooks maps subscription rows', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        all: () => ({
          results: [
            {
              id: 'wh-1',
              client_id: 'c1',
              url: 'https://hook.example.com',
              events_json: '["match.score_updated"]',
              enabled: 1,
              created_at: '2026-01-01T00:00:00Z',
            },
          ],
        }),
      }),
    });
    expect(await listWebhooks(env, 'c1')).toHaveLength(1);
  });

  it('deleteWebhook returns false when no rows deleted', async () => {
    const env = createMockEnv({
      DB: createMockDb({ run: () => ({ success: true, meta: { changes: 0 } }) }),
    });
    expect(await deleteWebhook(env, 'c1', 'wh-missing')).toBe(false);
  });

  it('handleIngestBatch covers completed matches, bulk ingest, and unknown source', async () => {
    const { handleCompletedMatches } = await import('../src/ingestion/matchDataRefresh');
    const { scheduleRecomputeAfterDataChange } = await import('../src/services/bulkRecomputeRunner');
    await handleIngestBatch(
      createMockMessageBatch([
        { body: { type: 'refresh_minute', idempotencyKey: 'k1' } },
        { body: { type: 'bulk_ingest', idempotencyKey: 'k2' } },
        { body: { type: 'source_ingest', sourceId: 'unknown', idempotencyKey: 'k3' } },
      ]),
      createMockEnv({
        DB: createMockDb({
          all: () => ({ results: [{ id: 'm-fallback' }] }),
        }),
      }),
    );
    expect(handleCompletedMatches).toHaveBeenCalled();
    expect(scheduleRecomputeAfterDataChange).toHaveBeenCalled();
  });

  it('handleIngestBatch refresh_minute uses DB fallback when no updated ids', async () => {
    const { refreshMatchData } = await import('../src/ingestion/matchDataRefresh');
    vi.mocked(refreshMatchData).mockResolvedValueOnce({ updatedIds: [], completedIds: [] });
    const send = vi.fn(async () => undefined);
    await handleIngestBatch(
      createMockMessageBatch([{ body: { type: 'refresh_minute', idempotencyKey: 'k4' } }]),
      createMockEnv({
        MODEL_QUEUE: { send } as never,
        DB: createMockDb({ all: () => ({ results: [{ id: 'm-fb' }] }) }),
      }),
    );
    expect(send).toHaveBeenCalledWith({ type: 'recompute_all', matchIds: ['m-fb'] });
  });

  it('handleModelBatch covers scenario generate/recompute, bulk paths, and missing snapshot', async () => {
    const { getLatestSnapshot } = await import('../src/db/repositories/probabilityRepo');
    vi.mocked(getLatestSnapshot).mockResolvedValueOnce(null);
    const send = vi.fn(async () => undefined);
    await handleModelBatch(
      createMockMessageBatch([
        { body: { type: 'SCENARIO_GENERATE', matchId: FIXTURE_MATCH.id } },
        { body: { type: 'SCENARIO_RECOMPUTE', matchId: FIXTURE_MATCH.id, eventId: 'e-1' } },
        { body: { type: 'recompute_all', matchIds: ['m-1', 'm-2'] } },
        { body: { type: 'recompute_wc2026_bulk' } },
        { body: { type: 'ai_briefing', matchId: FIXTURE_MATCH.id } },
        { body: { type: 'ai_extract_news', documentId: 'doc-1' } },
      ]),
      createMockEnv({ MODEL_QUEUE: { send } as never }),
    );
    expect(send).toHaveBeenCalled();
  });

  it('mockScoreAtMinute covers official match phases and hash-based scoring', () => {
    expect(mockScoreAtMinute('m-w26-ga-1v2', 5)).toEqual({ home: 0, away: 0 });
    expect(mockScoreAtMinute('m-w26-ga-1v2', 20)).toEqual({ home: 1, away: 0 });
    expect(mockScoreAtMinute('m-w26-ga-1v2', 90)).toEqual({ home: 2, away: 0 });
    const generic = mockScoreAtMinute('m-custom-hash', 80);
    expect(generic.home).toBeGreaterThanOrEqual(0);
    expect(generic.away).toBeGreaterThanOrEqual(0);
  });

  it('explainTeamSystemStrength handles null data and both team profiles', async () => {
    expect(await explainTeamSystemStrength(createMockEnv(), null)).toBeNull();
    const both = await explainTeamSystemStrength(createMockEnv(), {
      matchId: 'm-1',
      home: { collectiveStrengthScore: 0.8, tacticalIdentity: 'high_press' },
      away: { collectiveStrengthScore: 0.7, tacticalIdentity: 'low_block' },
    });
    expect(both?.awaySummary).toContain('70%');
    const homeOnly = await explainTeamSystemStrength(createMockEnv(), {
      matchId: 'm-1',
      home: null,
      away: { collectiveStrengthScore: 0.6, tacticalIdentity: 'balanced' },
    });
    expect(homeOnly?.homeSummary).toContain('pending');
  });
});

describe('coverage branches — scenario engine', () => {
  it('buildCandidateScenarios adds knockout and high-xG scenarios', () => {
    const ctx = mockScenarioContext({
      stage: 'Round of 16',
      homeLineupSource: 'projected',
      awayLineupSource: 'official',
      probability: {
        ...mockScenarioContext().probability,
        expectedHomeGoals: 2.0,
        expectedAwayGoals: 1.5,
        drawProb: 0.35,
      },
    });
    const candidates = buildCandidateScenarios(ctx);
    expect(candidates.some((c) => c.scenarioType === 'extra_time_path')).toBe(true);
    expect(candidates.some((c) => c.scenarioType === 'lineup_surprise')).toBe(true);
    expect(candidates.some((c) => c.scenarioType === 'high_event_open_match')).toBe(true);
  });

  it('ensureAtLeastTwoScenarios adds fallback when only baseline survives filter', () => {
    const ctx = mockScenarioContext();
    const baseline = {
      scenarioType: 'baseline_expected_flow' as const,
      scenarioName: 'Baseline',
      isBaseline: true,
      weight: 1,
      featureSelection: selectScenarioFeatures('baseline_expected_flow', ctx),
      output: runScenarioProbabilityModel(
        'baseline_expected_flow',
        ctx,
        selectScenarioFeatures('baseline_expected_flow', ctx),
      ),
    };
    const picked = ensureAtLeastTwoScenarios([baseline], ctx);
    expect(picked.length).toBeGreaterThanOrEqual(2);
  });

  it('runScenarioProbabilityModel covers alternative scenario branches', () => {
    const types = [
      'early_goal_swing',
      'transition_dominance',
      'pressing_breakthrough',
      'low_block_frustration',
      'set_piece_decider',
      'high_event_open_match',
      'low_event_controlled_match',
      'red_card_disruption',
      'late_bench_impact',
      'extra_time_path',
      'penalty_shootout_path',
      'lineup_surprise',
    ] as const;
    const ctx = mockScenarioContext({
      minute: 35,
      homeScore: 1,
      awayScore: 0,
      status: 'live',
      probability: {
        ...mockScenarioContext().probability,
        expectedHomeGoals: 1.8,
        expectedAwayGoals: 1.2,
      },
    });
    for (const type of types) {
      const selection = selectScenarioFeatures(type, ctx);
      const output = runScenarioProbabilityModel(type, ctx, selection);
      expect(output.scenarioProbability).toBeGreaterThan(0);
    }
  });
});
