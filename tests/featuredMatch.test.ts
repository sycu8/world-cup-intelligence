import { describe, expect, it, vi } from 'vitest';
import * as probabilityRepo from '../src/db/repositories/probabilityRepo';
import { WC2026_TOURNAMENT_ID } from '../src/constants/tournament';
import { getFeaturedMatchPayload, resolveFeaturedMatch } from '../src/services/featuredMatch';
import { createMockDb, createMockEnv } from './helpers/mockEnv';

const baseRow = {
  id: 'm-w26-ga-1v2',
  kickoff_utc: '2026-06-20T18:00:00.000Z',
  status: 'scheduled',
  stage: 'Group',
  group_code: 'A',
  home_name: 'United States',
  away_name: 'Mexico',
  home_short: 'USA',
  away_short: 'MEX',
  home_country_code: 'US',
  away_country_code: 'MX',
};

function dbReturningSequence(rows: Array<Record<string, unknown> | null>) {
  let call = 0;
  return createMockDb({
    first: () => rows[call++] ?? null,
  });
}

describe('resolveFeaturedMatch', () => {
  it('prefers live matches', async () => {
    const live = { ...baseRow, status: 'live' };
    const env = createMockEnv({
      DB: dbReturningSequence([live]),
    });

    const match = await resolveFeaturedMatch(env);
    expect(match?.status).toBe('live');
  });

  it('falls back to next upcoming scheduled match', async () => {
    const upcoming = { ...baseRow, status: 'scheduled', kickoff_utc: '2099-01-01T00:00:00.000Z' };
    const env = createMockEnv({
      DB: dbReturningSequence([null, upcoming]),
    });

    const match = await resolveFeaturedMatch(env);
    expect(match?.kickoff_utc).toBe('2099-01-01T00:00:00.000Z');
  });

  it('falls back to earliest scheduled match when none are in the future', async () => {
    const next = { ...baseRow, status: 'scheduled', kickoff_utc: '2026-06-01T00:00:00.000Z' };
    const env = createMockEnv({
      DB: dbReturningSequence([null, null, next]),
    });

    const match = await resolveFeaturedMatch(env);
    expect(match?.id).toBe('m-w26-ga-1v2');
  });

  it('returns null when no matches exist', async () => {
    const env = createMockEnv({
      DB: dbReturningSequence([null, null, null]),
    });
    expect(await resolveFeaturedMatch(env)).toBeNull();
  });
});

describe('getFeaturedMatchPayload', () => {
  it('returns null when no featured match resolves', async () => {
    const env = createMockEnv({ DB: dbReturningSequence([null, null, null]) });
    expect(await getFeaturedMatchPayload(env)).toBeNull();
  });

  it('includes probability snapshot when available', async () => {
    const env = createMockEnv({
      DB: dbReturningSequence([{ ...baseRow, status: 'live' }]),
    });
    vi.spyOn(probabilityRepo, 'getLatestSnapshot').mockResolvedValue({
      id: 'ps-1',
      match_id: baseRow.id,
      minute: 0,
      home_win_prob: 0.45,
      draw_prob: 0.25,
      away_win_prob: 0.3,
      expected_home_goals: 1.4,
      expected_away_goals: 1.1,
      most_likely_score: '1-1',
      scoreline_json: null,
      interval_json: null,
      confidence: 0.8,
      model_version: 'v1',
      input_hash: null,
      explanation_json: null,
    });

    const payload = await getFeaturedMatchPayload(env);

    expect(payload?.slug).toBe('vong-bang-a-united-states-vs-mexico');
    expect(payload?.probability).toEqual({
      homeWinProb: 0.45,
      drawProb: 0.25,
      awayWinProb: 0.3,
      expectedHomeGoals: 1.4,
      expectedAwayGoals: 1.1,
      mostLikelyScore: '1-1',
      confidence: 0.8,
      modelVersion: 'v1',
    });
  });

  it('returns null probability when snapshot is missing', async () => {
    const env = createMockEnv({
      DB: dbReturningSequence([{ ...baseRow, status: 'live' }]),
    });
    vi.spyOn(probabilityRepo, 'getLatestSnapshot').mockResolvedValue(null);

    const payload = await getFeaturedMatchPayload(env);
    expect(payload?.probability).toBeNull();
  });
});
