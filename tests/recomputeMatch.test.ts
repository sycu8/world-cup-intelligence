import { describe, expect, it, vi } from 'vitest';
import {
  recomputeAllActiveMatches,
  recomputeAllWc2026Matches,
  recomputeMatchProbability,
} from '../src/services/recomputeMatch';
import { createMockDb, createMockEnv } from './helpers/mockEnv';
import { FIXTURE_MATCH, FIXTURE_SNAPSHOT, FIXTURE_TEAMS } from './helpers/fixtures';

vi.mock('../src/services/matchScenarioService', () => ({
  generateMatchScenarios: vi.fn(async () => null),
}));

vi.mock('../src/market/services/marketSignalService', () => ({
  buildModelVsMarket: vi.fn(async () => undefined),
}));

describe('recomputeMatchProbability', () => {
  it('computes and persists probability snapshot for a match', async () => {
    const runCalls: string[] = [];
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
          return null;
        },
        all: (sql) => {
          if (sql.includes('FROM matches') && sql.includes('completed')) return { results: [] };
          return { results: [] };
        },
        run: (sql) => {
          runCalls.push(sql);
          return { success: true, meta: { changes: 1 } };
        },
      }),
    });

    const result = await recomputeMatchProbability(env, FIXTURE_MATCH.id);
    expect(result?.matchId).toBe(FIXTURE_MATCH.id);
    expect(result?.homeWinProb).toBeGreaterThan(0);
    expect(runCalls.some((s) => s.includes('probability_snapshots'))).toBe(true);
  });

  it('returns null when match missing', async () => {
    const env = createMockEnv({
      DB: createMockDb({ first: () => null }),
    });
    expect(await recomputeMatchProbability(env, 'missing')).toBeNull();
  });

  it('returns null when either team is missing', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        first: (sql) => {
          if (sql.includes('FROM matches WHERE id')) return FIXTURE_MATCH;
          return null;
        },
      }),
    });
    expect(await recomputeMatchProbability(env, FIXTURE_MATCH.id)).toBeNull();
  });
});

function buildRecomputeDb() {
  return createMockDb({
    first: (sql, binds) => {
      if (sql.includes('FROM matches WHERE id')) return FIXTURE_MATCH;
      if (sql.includes('FROM teams WHERE id')) {
        return binds[0] === FIXTURE_MATCH.home_team_id ? FIXTURE_TEAMS[0] : FIXTURE_TEAMS[1];
      }
      if (sql.includes('SELECT year FROM tournaments')) return { year: 2026 };
      if (sql.includes('FROM lineups')) return null;
      if (sql.includes("role = 'referee'")) return null;
      return null;
    },
    all: (sql) => {
      if (sql.includes('FROM matches') && sql.includes('completed')) return { results: [] };
      if (sql.includes('SELECT id FROM matches')) return { results: [{ id: FIXTURE_MATCH.id }] };
      return { results: [] };
    },
    run: () => ({ success: true, meta: { changes: 1 } }),
  });
}

describe('recomputeAllActiveMatches', () => {
  it('recomputes active match ids', async () => {
    const env = createMockEnv({ DB: buildRecomputeDb() });
    const done = await recomputeAllActiveMatches(env);
    expect(done).toContain(FIXTURE_MATCH.id);
  });
});

describe('recomputeAllWc2026Matches', () => {
  it('returns bulk recompute summary', async () => {
    const env = createMockEnv({ DB: buildRecomputeDb() });
    const result = await recomputeAllWc2026Matches(env);
    expect(result.total).toBe(1);
    expect(result.recomputed).toBe(1);
    expect(result.sampleConfidence).toBeGreaterThan(0);
  });
});
