import { describe, expect, it, vi } from 'vitest';
import {
  broadcastScenarioUpdate,
  generateMatchScenarios,
  getMatchScenarioSet,
  loadMatchScenarioContext,
} from '../src/services/matchScenarioService';
import { createMockDb, createMockEnv } from './helpers/mockEnv';
import { FIXTURE_MATCH, FIXTURE_TEAMS } from './helpers/fixtures';

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
});
