import { describe, expect, it } from 'vitest';
import { refreshTeamRatingsFromForm } from '../src/services/teamRatingRefresh';
import { createMockDb, createMockEnv } from './helpers/mockEnv';

describe('refreshTeamRatingsFromForm', () => {
  it('updates collective strength from recent completed matches', async () => {
    const runCalls: unknown[][] = [];
    const env = createMockEnv({
      DB: createMockDb({
        all: (sql) => {
          if (sql.includes('SELECT id FROM teams')) {
            return { results: [{ id: 'team-w26-a1' }] };
          }
          if (sql.includes('FROM matches') && sql.includes('completed')) {
            return {
              results: [
                {
                  home_team_id: 'team-w26-a1',
                  away_team_id: 'team-w26-a2',
                  home_score: 2,
                  away_score: 1,
                  home_xg: 1.8,
                  away_xg: 0.9,
                },
                {
                  home_team_id: 'team-w26-b1',
                  away_team_id: 'team-w26-a1',
                  home_score: 0,
                  away_score: 2,
                  home_xg: 0.5,
                  away_xg: 1.6,
                },
              ],
            };
          }
          return { results: [] };
        },
        run: (_sql, binds) => {
          runCalls.push(binds);
          return { success: true, meta: { changes: 1 } };
        },
      }),
    });

    const updated = await refreshTeamRatingsFromForm(env);
    expect(updated).toBe(1);
    expect(runCalls[0]?.[0]).toBeGreaterThan(0.35);
  });

  it('skips teams without enough form matches', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        all: (sql) => {
          if (sql.includes('SELECT id FROM teams')) return { results: [{ id: 'team-arg' }] };
          return { results: [] };
        },
      }),
    });
    expect(await refreshTeamRatingsFromForm(env)).toBe(0);
  });
});
