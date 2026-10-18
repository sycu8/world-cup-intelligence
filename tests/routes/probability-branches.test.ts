import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockDb, createMockEnv } from '../helpers/mockEnv';
import { FIXTURE_MATCH, FIXTURE_TEAMS } from '../helpers/fixtures';
import { jsonRoute } from '../helpers/routeHarness';

vi.mock('../../src/services/matchRef', () => ({
  resolveMatchRef: vi.fn(),
}));

vi.mock('../../src/db/repositories/teamsRepo', () => ({
  getTeam: vi.fn(),
}));

vi.mock('../../src/db/repositories/probabilityRepo', () => ({
  getDisplaySnapshot: vi.fn(),
  getLatestSnapshot: vi.fn(),
  saveSnapshot: vi.fn(async () => undefined),
}));

vi.mock('../../src/services/matchFeatures', () => ({
  buildMatchFeaturesWithForm: vi.fn(async () => ({ sourceConfidence: 0.8 })),
}));

vi.mock('../../src/models/probability/engine', () => ({
  computeProbability: vi.fn(),
}));

vi.mock('../../src/services/payloadCache', () => ({
  getCachedJson: vi.fn(async (_env, _key, factory: () => Promise<unknown>) => factory()),
}));

vi.mock('../../src/services/workersPathCache', () => ({
  withPathCache: vi.fn(async (_key, _ttl, cb: () => Promise<Response>) => cb()),
}));

import { probabilityRoutes } from '../../src/routes/probability';

describe('probability routes branch fallbacks', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const matchRef = await import('../../src/services/matchRef');
    vi.mocked(matchRef.resolveMatchRef).mockResolvedValue(FIXTURE_MATCH as never);
    const teamsRepo = await import('../../src/db/repositories/teamsRepo');
    vi.mocked(teamsRepo.getTeam).mockImplementation(async (_db, teamId) =>
      (FIXTURE_TEAMS.find((team) => team.id === teamId) ?? null) as never,
    );
    const probabilityRepo = await import('../../src/db/repositories/probabilityRepo');
    vi.mocked(probabilityRepo.getDisplaySnapshot).mockResolvedValue(null);
    vi.mocked(probabilityRepo.getDisplaySnapshot).mockResolvedValue(null);
    const engine = await import('../../src/models/probability/engine');
    vi.mocked(engine.computeProbability).mockResolvedValue({
      matchId: FIXTURE_MATCH.id,
      homeWinProb: 0.4,
      drawProb: 0.3,
      awayWinProb: 0.3,
      expectedHomeGoals: 1.1,
      expectedAwayGoals: 0.9,
      mostLikelyScore: null,
      explanation: 'Fallback driver',
      timestamp: '2026-06-01T00:00:00Z',
      modelVersion: 'mock-v1',
    } as never);
  });

  function routeEnv(snapshot: Record<string, unknown> | null) {
    return createMockEnv({
      DB: createMockDb({
        first: (sql) => {
          if (sql.includes('SELECT year FROM tournaments')) return null;
          return snapshot as never;
        },
      }),
    });
  }

  it('uses snapshot payload defaults when explanation and created_at are null', async () => {
    const probabilityRepo = await import('../../src/db/repositories/probabilityRepo');
    vi.mocked(probabilityRepo.getDisplaySnapshot).mockResolvedValue({
      id: 'snap-1',
      home_win_prob: 0.55,
      draw_prob: 0.25,
      away_win_prob: 0.2,
      expected_home_goals: 1.8,
      expected_away_goals: 0.7,
      most_likely_score: '2-0',
      scoreline_json: JSON.stringify({ '2-0': 0.22 }),
      interval_json: JSON.stringify({ firstHalf: { home: 0.4 } }),
      explanation_json: null,
      confidence: 0.81,
      model_version: 'snap-v1',
      created_at: null,
    } as never);

    const { json } = await jsonRoute<{
      data: { drivers: string[]; updatedAt: string | null; topScorelines: Array<{ score: string }> };
    }>(probabilityRoutes, `/${FIXTURE_MATCH.id}/probability`, { env: routeEnv(null) });

    expect(json.data.drivers).toEqual([]);
    expect(json.data.updatedAt).toBeNull();
    expect(json.data.topScorelines[0]?.score).toBe('2-0');
  });

  it('recomputes when snapshot JSON is null or empty and falls back to explanation and timestamp', async () => {
    const probabilityRepo = await import('../../src/db/repositories/probabilityRepo');
    vi.mocked(probabilityRepo.getDisplaySnapshot).mockResolvedValue({
      id: 'snap-bad',
      home_win_prob: 0.55,
      draw_prob: 0.25,
      away_win_prob: 0.2,
      expected_home_goals: 1.8,
      expected_away_goals: 0.7,
      most_likely_score: '2-0',
      scoreline_json: null,
      interval_json: '{}',
      explanation_json: null,
      confidence: 0.81,
      model_version: 'snap-v1',
      created_at: '2026-06-01T00:00:00Z',
    } as never);
    const features = await import('../../src/services/matchFeatures');

    const probability = await jsonRoute<{
      data: { drivers: string[]; updatedAt: string | null; topScorelines: unknown[] };
    }>(probabilityRoutes, `/${FIXTURE_MATCH.id}/probability`, { env: routeEnv(null) });
    expect(probability.json.data.drivers).toEqual(['Fallback driver']);
    expect(probability.json.data.updatedAt).toBe('2026-06-01T00:00:00Z');
    expect(probability.json.data.topScorelines).toEqual([]);
    expect(vi.mocked(features.buildMatchFeaturesWithForm)).toHaveBeenCalledWith(
      expect.anything(),
      FIXTURE_MATCH,
      expect.anything(),
      expect.anything(),
      2026,
    );

    const scoreline = await jsonRoute<{ data: Record<string, unknown> }>(
      probabilityRoutes,
      `/${FIXTURE_MATCH.id}/scoreline?recompute=1`,
      { env: routeEnv(null) },
    );
    expect(scoreline.json.data.explanation).toBe('Fallback driver');

    const intervals = await jsonRoute<{ data: Record<string, unknown> }>(
      probabilityRoutes,
      `/${FIXTURE_MATCH.id}/intervals?recompute=1`,
      { env: routeEnv(null) },
    );
    expect(intervals.json.data.timestamp).toBe('2026-06-01T00:00:00Z');
  });

  it('treats empty scoreline and interval objects as incomplete snapshot payloads', async () => {
    const probabilityRepo = await import('../../src/db/repositories/probabilityRepo');
    vi.mocked(probabilityRepo.getDisplaySnapshot).mockResolvedValue({
      id: 'snap-empty-objects',
      home_win_prob: 0.51,
      draw_prob: 0.27,
      away_win_prob: 0.22,
      expected_home_goals: 1.4,
      expected_away_goals: 0.8,
      most_likely_score: '1-0',
      scoreline_json: '{}',
      interval_json: '{}',
      explanation_json: JSON.stringify({ summary: 'ignored snapshot summary' }),
      confidence: 0.77,
      model_version: 'snap-v2',
      created_at: '2026-06-01T00:00:00Z',
    } as never);

    const { json } = await jsonRoute<{
      data: { drivers: string[]; updatedAt: string | null; topScorelines: unknown[] };
    }>(probabilityRoutes, `/${FIXTURE_MATCH.id}/probability`, { env: routeEnv(null) });

    expect(json.data.drivers).toEqual(['Fallback driver']);
    expect(json.data.updatedAt).toBe('2026-06-01T00:00:00Z');
    expect(json.data.topScorelines).toEqual([]);
  });

  it('recomputes when only the interval payload is nullish or empty', async () => {
    const probabilityRepo = await import('../../src/db/repositories/probabilityRepo');
    vi.mocked(probabilityRepo.getDisplaySnapshot).mockResolvedValue({
      id: 'snap-missing-intervals',
      home_win_prob: 0.44,
      draw_prob: 0.31,
      away_win_prob: 0.25,
      expected_home_goals: 1.2,
      expected_away_goals: 0.8,
      most_likely_score: '1-0',
      scoreline_json: JSON.stringify({ '1-0': 0.18 }),
      interval_json: null,
      explanation_json: JSON.stringify({ summary: 'snapshot summary' }),
      confidence: 0.7,
      model_version: 'snap-v3',
      created_at: '2026-06-01T00:00:00Z',
    } as never);

    const probability = await jsonRoute<{
      data: { drivers: string[]; updatedAt: string | null };
    }>(probabilityRoutes, `/${FIXTURE_MATCH.id}/probability`, { env: routeEnv(null) });
    expect(probability.json.data.drivers).toEqual(['Fallback driver']);
    expect(probability.json.data.updatedAt).toBe('2026-06-01T00:00:00Z');

    vi.mocked(probabilityRepo.getDisplaySnapshot).mockResolvedValue({
      id: 'snap-empty-intervals',
      home_win_prob: 0.44,
      draw_prob: 0.31,
      away_win_prob: 0.25,
      expected_home_goals: 1.2,
      expected_away_goals: 0.8,
      most_likely_score: '1-0',
      scoreline_json: JSON.stringify({ '1-0': 0.18 }),
      interval_json: '{}',
      explanation_json: JSON.stringify({ summary: 'snapshot summary' }),
      confidence: 0.7,
      model_version: 'snap-v3',
      created_at: '2026-06-01T00:00:00Z',
    } as never);
    const intervals = await jsonRoute<{ data: Record<string, unknown> }>(
      probabilityRoutes,
      `/${FIXTURE_MATCH.id}/intervals`,
      { env: routeEnv(null) },
    );
    expect(intervals.json.data.timestamp).toBe('2026-06-01T00:00:00Z');
  });

  it('returns 404 when the match ref cannot be resolved or a team lookup fails', async () => {
    const matchRef = await import('../../src/services/matchRef');
    vi.mocked(matchRef.resolveMatchRef).mockResolvedValueOnce(null as never);
    const missing = await jsonRoute(probabilityRoutes, '/missing/probability', { env: routeEnv(null) });
    expect(missing.res.status).toBe(404);

    vi.mocked(matchRef.resolveMatchRef).mockResolvedValueOnce(FIXTURE_MATCH as never);
    const teamsRepo = await import('../../src/db/repositories/teamsRepo');
    vi.mocked(teamsRepo.getTeam).mockResolvedValueOnce(null as never);
    const badTeam = await jsonRoute(probabilityRoutes, `/${FIXTURE_MATCH.id}/probability?recompute=1`, {
      env: routeEnv(null),
    });
    expect(badTeam.res.status).toBe(404);
  });
});
