import { describe, expect, it } from 'vitest';
import { WC2026_MATCH_COUNT, WC2026_TOURNAMENT_ID, WC2026_YEAR } from '../src/constants/tournament';
import { buildSchedulePayload } from '../src/services/schedulePayload';
import { createMockDb, createMockEnv } from './helpers/mockEnv';

const sampleMatchRow = {
  id: 'm-w26-ga-1v2',
  kickoff_utc: '2026-06-15T18:00:00.000Z',
  status: 'scheduled',
  stage: 'Group',
  group_code: 'A',
  home_team_id: 't-usa',
  away_team_id: 't-mex',
  home_score: 0,
  away_score: 0,
  minute: 0,
  tournament_id: WC2026_TOURNAMENT_ID,
};

const sampleTeams = [
  { id: 't-usa', name: 'United States', short_name: 'USA', country_code: 'US' },
  { id: 't-mex', name: 'Mexico', short_name: 'MEX', country_code: 'MX' },
];

function scheduleMockDb(matchRows: Record<string, unknown>[]) {
  return createMockDb({
    all: (sql) => {
      if (sql.includes('FROM matches')) return { results: matchRows };
      if (sql.includes('FROM teams')) return { results: sampleTeams };
      return { results: [] };
    },
  });
}

describe('buildSchedulePayload', () => {
  it('groups matches by date and attaches slugs', async () => {
    const env = createMockEnv({
      DB: scheduleMockDb([sampleMatchRow]),
    });

    const payload = await buildSchedulePayload(env, 't-2026');

    expect(payload.data.total).toBe(1);
    expect(payload.data.tournamentId).toBe(WC2026_TOURNAMENT_ID);
    expect(payload.data.byDate['2026-06-15']).toHaveLength(1);
    expect(payload.data.matches[0].slug).toBe('vong-bang-a-united-states-vs-mexico');
    expect(payload.meta).toEqual({
      expectedMatches: WC2026_MATCH_COUNT,
      year: WC2026_YEAR,
      tournamentId: WC2026_TOURNAMENT_ID,
      wc2026Only: true,
    });
  });

  it('derives date from kickoff when match_date is missing', async () => {
    const env = createMockEnv({
      DB: scheduleMockDb([sampleMatchRow]),
    });

    const payload = await buildSchedulePayload(env);
    expect(payload.data.byDate['2026-06-15']).toHaveLength(1);
  });

  it('uses unknown bucket when no date fields exist', async () => {
    const row = { ...sampleMatchRow, kickoff_utc: undefined as unknown as string };
    const env = createMockEnv({
      DB: scheduleMockDb([row]),
    });

    const payload = await buildSchedulePayload(env);
    expect(payload.data.byDate.unknown).toHaveLength(1);
  });

  it('handles empty schedule', async () => {
    const env = createMockEnv({
      DB: scheduleMockDb([]),
    });

    const payload = await buildSchedulePayload(env, null);
    expect(payload.data.matches).toEqual([]);
    expect(payload.data.total).toBe(0);
  });

  it('handles undefined query results', async () => {
    const env = createMockEnv({
      DB: createMockDb({ all: () => ({}) }),
    });

    const payload = await buildSchedulePayload(env);
    expect(payload.data.matches).toEqual([]);
    expect(payload.data.total).toBe(0);
  });
});
