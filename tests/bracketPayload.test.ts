import { describe, expect, it } from 'vitest';
import { buildBracketPayload } from '../src/services/bracketPayload';
import { createMockDb, createMockEnv } from './helpers/mockEnv';
import { WC2026_TOURNAMENT_ID } from '../src/constants/tournament';

describe('buildBracketPayload', () => {
  it('groups knockout matches by stage in canonical order', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        all: () => ({
          results: [
            {
              id: 'm-final',
              stage: 'Final',
              kickoff_utc: '2026-07-19T19:00:00Z',
              status: 'scheduled',
              home_team_id: 't1',
              away_team_id: 't2',
              home_score: 0,
              away_score: 0,
              home_name: 'Team A',
              away_name: 'Team B',
            },
            {
              id: 'm-r32',
              stage: 'Round of 32',
              kickoff_utc: '2026-06-28T18:00:00Z',
              status: 'scheduled',
              home_team_id: 't3',
              away_team_id: 't4',
              home_score: 0,
              away_score: 0,
              home_name: 'Mexico',
              away_name: 'Brazil',
            },
          ],
        }),
      }),
    });

    const payload = await buildBracketPayload(env);
    expect(payload.tournamentId).toBe(WC2026_TOURNAMENT_ID);
    expect(payload.rounds[0].stage).toBe('Round of 32');
    expect(payload.rounds[payload.rounds.length - 1].stage).toBe('Final');
    expect(payload.rounds[0].matches[0].slug).toContain('mexico');
  });

  it('appends unknown stages after canonical order', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        all: () => ({
          results: [
            {
              id: 'm-playoff',
              stage: 'Playoff',
              kickoff_utc: '2026-06-20T18:00:00Z',
              status: 'scheduled',
              home_team_id: 't1',
              away_team_id: 't2',
              home_score: 0,
              away_score: 0,
              home_name: 'X',
              away_name: 'Y',
            },
          ],
        }),
      }),
    });
    const payload = await buildBracketPayload(env);
    expect(payload.rounds.some((r) => r.stage === 'Playoff')).toBe(true);
  });
});
