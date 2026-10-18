import { describe, expect, it } from 'vitest';
import { buildTopScorersPayload } from '../src/services/tournamentTopScorers';
import { createMockDb } from './helpers/mockEnv';

describe('tournamentTopScorers', () => {
  it('aggregates goals from match_events for completed matches', async () => {
    const db = createMockDb({
      all: (sql) => {
        if (sql.includes('match_events')) {
          return {
            results: [
              {
                playerId: 'p-mex-quinones',
                playerName: 'Orbelin Pineda',
                teamId: 'team-w26-a1',
                teamName: 'Mexico',
                countryCode: 'MX',
                goals: 2,
              },
              {
                playerId: 'p-mex-jimenez',
                playerName: 'Raúl Jiménez',
                teamId: 'team-w26-a1',
                teamName: 'Mexico',
                countryCode: 'MX',
                goals: 1,
              },
            ],
          };
        }
        return { results: [] };
      },
    });

    const payload = await buildTopScorersPayload({ DB: db } as import('../src/env').AppEnv);
    expect(payload.scorers).toHaveLength(2);
    expect(payload.scorers[0]).toMatchObject({ rank: 1, playerName: 'Orbelin Pineda', goals: 2 });
    expect(payload.scorers[1]).toMatchObject({ rank: 2, goals: 1 });
  });
});
