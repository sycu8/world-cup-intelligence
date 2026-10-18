import { describe, expect, it, vi } from 'vitest';
import {
  broadcastScenarioUpdate,
  generateMatchScenarios,
  getMatchScenarioSet,
  loadMatchScenarioContext,
  updateScenariosFromRealtimeEvent,
} from '../src/services/matchScenarioService';
import { createMockDb, createMockEnv } from './helpers/mockEnv';
import { FIXTURE_MATCH, FIXTURE_TEAMS } from './helpers/fixtures';
import { mockComparison, mockScenario } from './helpers/scenarioFixtures';

vi.mock('../src/services/matchLineupProjection', () => ({
  getProjectedLineupForMatch: vi.fn(async () => ({
    formation: '4-3-3',
    source: 'projected',
    players: [],
  })),
}));

describe('matchScenarioService', () => {
  function scenarioDb() {
    return createMockDb({
      first: (sql, binds) => {
        if (sql.includes('FROM matches WHERE id')) return FIXTURE_MATCH;
        if (sql.includes('FROM teams WHERE id')) {
          return binds[0] === FIXTURE_MATCH.home_team_id ? FIXTURE_TEAMS[0] : FIXTURE_TEAMS[1];
        }
        if (sql.includes('SELECT year FROM tournaments')) return { year: 2026 };
        if (sql.includes('FROM lineups')) return null;
        if (sql.includes("role = 'referee'")) return null;
        if (sql.includes('FROM market_signals')) return null;
        return null;
      },
      all: (sql) => {
        if (sql.includes('FROM matches') && sql.includes('completed')) return { results: [] };
        if (sql.includes('FROM match_prediction_scenarios')) return { results: [] };
        return { results: [] };
      },
      run: () => ({ success: true, meta: { changes: 1, last_row_id: 1 } }),
    });
  }

  it('loadMatchScenarioContext builds probability context', async () => {
    const env = createMockEnv({
      DB: scenarioDb(),
      R2_ARTIFACTS: { put: vi.fn(async () => undefined) } as never,
    });
    const ctx = await loadMatchScenarioContext(env, FIXTURE_MATCH.id);
    expect(ctx?.matchId).toBe(FIXTURE_MATCH.id);
    expect(ctx?.probability.homeWinProb).toBeGreaterThan(0);
    expect(ctx?.homeLineupSource).toBe('projected');
  });

  it('loadMatchScenarioContext returns null when a team lookup is missing', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        first: (sql, binds) => {
          if (sql.includes('FROM matches WHERE id')) return FIXTURE_MATCH;
          if (sql.includes('FROM teams WHERE id')) {
            return binds[0] === FIXTURE_MATCH.home_team_id ? FIXTURE_TEAMS[0] : null;
          }
          return null;
        },
      }),
      R2_ARTIFACTS: { put: vi.fn(async () => undefined) } as never,
    });
    await expect(loadMatchScenarioContext(env, FIXTURE_MATCH.id)).resolves.toBeNull();
  });

  it('loadMatchScenarioContext falls back for nullish match metadata', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        first: (sql, binds) => {
          if (sql.includes('FROM matches WHERE id')) {
            return {
              ...FIXTURE_MATCH,
              tournament_id: 't-nullish',
              stage: null,
              minute: null,
              home_score: null,
              away_score: null,
              status: null,
            };
          }
          if (sql.includes('FROM teams WHERE id')) {
            return binds[0] === FIXTURE_MATCH.home_team_id ? FIXTURE_TEAMS[0] : FIXTURE_TEAMS[1];
          }
          if (sql.includes('SELECT year FROM tournaments')) return null;
          return null;
        },
        all: (sql) => {
          if (sql.includes('FROM matches') && sql.includes('completed')) return { results: [] };
          return { results: [] };
        },
      }),
      R2_ARTIFACTS: { put: vi.fn(async () => undefined) } as never,
    });
    const ctx = await loadMatchScenarioContext(env, FIXTURE_MATCH.id);
    expect(ctx?.tournamentYear).toBe(2026);
    expect(ctx?.stage).toBe('Group');
    expect(ctx?.minute).toBe(0);
    expect(ctx?.homeScore).toBe(0);
    expect(ctx?.awayScore).toBe(0);
    expect(ctx?.status).toBe('scheduled');
  });

  it('generateMatchScenarios persists scenario set', async () => {
    const env = createMockEnv({
      DB: scenarioDb(),
      R2_ARTIFACTS: { put: vi.fn(async () => undefined) } as never,
    });
    const set = await generateMatchScenarios(env, FIXTURE_MATCH.id);
    expect(set?.scenarios.length).toBeGreaterThanOrEqual(2);
    expect(set?.comparison.primaryScenarioId).toBeTruthy();
  });

  it('getMatchScenarioSet generates when fewer than two active scenarios', async () => {
    const env = createMockEnv({
      DB: scenarioDb(),
      R2_ARTIFACTS: { put: vi.fn(async () => undefined) } as never,
    });
    const set = await getMatchScenarioSet(env, FIXTURE_MATCH.id);
    expect(set?.scenarios.length).toBeGreaterThanOrEqual(2);
  });

  it('broadcastScenarioUpdate posts to match room durable object', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 200 }));
    const env = createMockEnv({
      MATCH_ROOM: {
        idFromName: () => ({ toString: () => 'room' }),
        get: () => ({ fetch }),
      } as never,
    });
    await broadcastScenarioUpdate(env, FIXTURE_MATCH.id, {
      matchId: FIXTURE_MATCH.id,
      generatedAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      scenarios: [],
      comparison: {
        mostLikelyScenario: null,
        highestUpsetPotential: null,
        widestProbabilitySpread: null,
        scenarioRankings: [],
      },
      sourceConfidence: { overall: 0.8, notes: [] },
    });
    expect(fetch).toHaveBeenCalled();
  });

  it('getMatchScenarioSet returns stored scenarios when two or more active', async () => {
    const scenarios = [
      mockScenario(),
      mockScenario({
        id: 'mps-2',
        scenarioType: 'early_goal_swing',
        scenarioName: 'Early goal swing',
        scenarioRank: 2,
        isBaseline: false,
      }),
    ];
    const repo = await import('../src/db/repositories/matchPredictionScenarioRepo');
    vi.spyOn(repo, 'listActiveScenariosForMatch').mockResolvedValue(scenarios);
    vi.spyOn(repo, 'getLatestComparison').mockResolvedValue(null);
    const env = createMockEnv({
      DB: createMockDb({
        first: () => ({ confidence: 0.75, input_hash: 'hash' }),
      }),
    });
    const set = await getMatchScenarioSet(env, FIXTURE_MATCH.id);
    expect(set?.scenarios).toHaveLength(2);
    expect(set?.sourceConfidence.notes[0]).toContain('model estimates');
  });

  it('getMatchScenarioSet keeps stored comparison and snapshot confidence defaults', async () => {
    const scenarios = [
      mockScenario({ updatedAt: undefined as unknown as string }),
      mockScenario({
        id: 'mps-2',
        updatedAt: undefined as unknown as string,
        scenarioType: 'early_goal_swing',
        scenarioName: 'Early goal swing',
        scenarioRank: 2,
        isBaseline: false,
      }),
    ];
    const comparison = mockComparison({ summary: 'Stored comparison summary' });
    const repo = await import('../src/db/repositories/matchPredictionScenarioRepo');
    vi.spyOn(repo, 'listActiveScenariosForMatch').mockResolvedValue(scenarios);
    vi.spyOn(repo, 'getLatestComparison').mockResolvedValue(comparison);
    const probability = await import('../src/db/repositories/probabilityRepo');
    vi.spyOn(probability, 'getLatestSnapshot').mockResolvedValue(null);
    const env = createMockEnv({ DB: createMockDb({}) });

    const set = await getMatchScenarioSet(env, FIXTURE_MATCH.id);
    expect(set?.comparison.summary).toBe('Stored comparison summary');
    expect(set?.sourceConfidence.overall).toBe(0.7);
    expect(typeof set?.generatedAt).toBe('string');
    expect(typeof set?.updatedAt).toBe('string');
  });

  it('generateMatchScenarios notes market-implied signal when present', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        first: (sql, binds) => {
          if (sql.includes('FROM matches WHERE id')) return FIXTURE_MATCH;
          if (sql.includes('FROM teams WHERE id')) {
            return binds[0] === FIXTURE_MATCH.home_team_id ? FIXTURE_TEAMS[0] : FIXTURE_TEAMS[1];
          }
          if (sql.includes('SELECT year FROM tournaments')) return { year: 2026 };
          if (sql.includes('FROM lineups')) return null;
          if (sql.includes("role = 'referee'")) return null;
          if (sql.includes('FROM market_signal_analysis')) {
            return {
              market_home_prob: 0.42,
              market_draw_prob: 0.28,
              market_away_prob: 0.3,
            };
          }
          return null;
        },
        all: (sql) => {
          if (sql.includes('FROM matches') && sql.includes('completed')) return { results: [] };
          if (sql.includes('FROM match_prediction_scenarios')) return { results: [] };
          return { results: [] };
        },
        run: () => ({ success: true, meta: { changes: 1, last_row_id: 1 } }),
      }),
      R2_ARTIFACTS: { put: vi.fn(async () => undefined) } as never,
    });
    const set = await generateMatchScenarios(env, FIXTURE_MATCH.id);
    expect(set?.sourceConfidence.notes[0]).toContain('Market-implied');
  });

  it('generateMatchScenarios returns null when context cannot be loaded', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        first: () => null,
        all: () => ({ results: [] }),
      }),
      R2_ARTIFACTS: { put: vi.fn(async () => undefined) } as never,
    });
    await expect(generateMatchScenarios(env, FIXTURE_MATCH.id)).resolves.toBeNull();
  });

  it('updateScenariosFromRealtimeEvent persists snapshots', async () => {
    const env = createMockEnv({
      DB: scenarioDb(),
      R2_ARTIFACTS: { put: vi.fn(async () => undefined) } as never,
    });
    await generateMatchScenarios(env, FIXTURE_MATCH.id);
    const updated = await updateScenariosFromRealtimeEvent(env, {
      matchId: FIXTURE_MATCH.id,
      eventId: 'evt-1',
      eventType: 'goal',
      minute: 23,
    });
    expect(updated?.scenarios.length).toBeGreaterThanOrEqual(2);
  });

  it('updateScenariosFromRealtimeEvent ignores snapshots without matching scenarios', async () => {
    const scenarios = [
      mockScenario({ id: 'mps-a' }),
      mockScenario({
        id: 'mps-b',
        scenarioType: 'early_goal_swing',
        scenarioName: 'Early goal swing',
        scenarioRank: 2,
        isBaseline: false,
      }),
    ];
    const repo = await import('../src/db/repositories/matchPredictionScenarioRepo');
    vi.spyOn(repo, 'listActiveScenariosForMatch').mockResolvedValue(scenarios);
    const saveScenarioSnapshot = vi.spyOn(repo, 'saveScenarioSnapshot').mockResolvedValue(undefined);
    const realtime = await import('../src/models/scenarios/scenarioRealtimeUpdater');
    vi.spyOn(realtime, 'applyRealtimeEventToScenarios').mockReturnValue({
      scenarios,
      snapshots: [
        { scenarioId: 'missing', deltaFromPrevious: 0.12, updateReason: 'ignored' },
        { scenarioId: 'mps-a', deltaFromPrevious: 0.05, updateReason: 'goal swing' },
      ],
    });

    const env = createMockEnv({
      DB: scenarioDb(),
      R2_ARTIFACTS: { put: vi.fn(async () => undefined) } as never,
    });
    const updated = await updateScenariosFromRealtimeEvent(env, {
      matchId: FIXTURE_MATCH.id,
      eventId: 'evt-2',
      eventType: 'goal',
      minute: 55,
    });

    expect(updated?.scenarios).toHaveLength(2);
    expect(saveScenarioSnapshot).toHaveBeenCalledTimes(1);
    expect(saveScenarioSnapshot).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: 'mps-a' }),
      expect.objectContaining({ updateReason: 'goal swing' }),
    );
  });

  it('updateScenariosFromRealtimeEvent returns null when context is unavailable', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        first: () => null,
        all: () => ({ results: [] }),
      }),
      R2_ARTIFACTS: { put: vi.fn(async () => undefined) } as never,
    });
    await expect(
      updateScenariosFromRealtimeEvent(env, {
        matchId: FIXTURE_MATCH.id,
        eventId: 'evt-3',
        eventType: 'shot',
        minute: 10,
      }),
    ).resolves.toBeNull();
  });
});
