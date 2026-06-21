import { describe, expect, it } from 'vitest';
import { getProjectedLineupForMatch } from '../src/services/matchLineupProjection';
import { createMockDb, createMockEnv } from './helpers/mockEnv';
import { FIXTURE_MATCH } from './helpers/fixtures';

describe('matchLineupProjection', () => {
  it('returns persisted official and projected lineup rows when starters exist', async () => {
    const official = await getProjectedLineupForMatch(
      createMockEnv({
        DB: createMockDb({
          first: (sql) => {
            if (sql.includes('FROM lineups l')) {
              return { id: 'lu-official', formation: '4-3-3', is_official: 1 };
            }
            return null;
          },
          all: (sql) => {
            if (sql.includes('FROM lineup_players')) {
              return { results: [{ name: 'Starter A' }, { name: 'Starter B' }] };
            }
            return { results: [] };
          },
        }),
      }),
      FIXTURE_MATCH.id,
      FIXTURE_MATCH.home_team_id,
      'Mexico',
    );
    expect(official.source).toBe('official');
    expect(official.players).toEqual(['Starter A', 'Starter B']);

    const projected = await getProjectedLineupForMatch(
      createMockEnv({
        DB: createMockDb({
          first: (sql) => {
            if (sql.includes('FROM lineups l')) {
              return { id: 'lu-projected', formation: '3-5-2', is_official: 0 };
            }
            return null;
          },
          all: (sql) => {
            if (sql.includes('FROM lineup_players')) {
              return { results: [{ name: 'Projected A' }] };
            }
            return { results: [] };
          },
        }),
      }),
      FIXTURE_MATCH.id,
      FIXTURE_MATCH.away_team_id,
      'South Africa',
    );
    expect(projected.source).toBe('projected');
    expect(projected.formation).toBe('3-5-2');
  });

  it('falls back to squad rows and infers each formation branch', async () => {
    const makeEnv = (listedPositions: string[]) =>
      createMockEnv({
        DB: createMockDb({
          first: () => null,
          all: (sql) => {
            if (sql.includes('FROM squad_players')) {
              return {
                results: listedPositions.map((listed_position, i) => ({
                  name: `Squad ${i + 1}`,
                  position: listed_position,
                  listed_position,
                })),
              };
            }
            return { results: [] };
          },
        }),
      });

    const fourThreeThree = await getProjectedLineupForMatch(
      makeEnv(['GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'LW', 'RW', 'FW']),
      FIXTURE_MATCH.id,
      FIXTURE_MATCH.home_team_id,
      'Mexico',
    );
    expect(fourThreeThree.formation).toBe('4-3-3');
    expect(fourThreeThree.source).toBe('squad');

    const fourTwoThreeOne = await getProjectedLineupForMatch(
      makeEnv(['GK', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'LW', 'FW']),
      FIXTURE_MATCH.id,
      FIXTURE_MATCH.home_team_id,
      'Mexico',
    );
    expect(fourTwoThreeOne.formation).toBe('4-2-3-1');

    const threeFiveTwo = await getProjectedLineupForMatch(
      makeEnv(['DEF', 'DEF', 'DEF', 'AM', 'CM', 'CM', 'LM', 'RM', 'FW', 'FW', 'ATT']),
      FIXTURE_MATCH.id,
      FIXTURE_MATCH.home_team_id,
      'Mexico',
    );
    expect(threeFiveTwo.formation).toBe('3-5-2');

    const fourFourTwo = await getProjectedLineupForMatch(
      makeEnv(['GK', 'CB', 'CB', 'CB', 'CB', 'ST', 'ST']),
      FIXTURE_MATCH.id,
      FIXTURE_MATCH.home_team_id,
      'Mexico',
    );
    expect(fourFourTwo.formation).toBe('4-4-2');
  });

  it('uses club players when squad depth is short', async () => {
    const lineup = await getProjectedLineupForMatch(
      createMockEnv({
        DB: createMockDb({
          first: () => null,
          all: (sql) => {
            if (sql.includes('FROM squad_players')) {
              return {
                results: Array.from({ length: 6 }, (_, i) => ({
                  name: `Short Squad ${i + 1}`,
                  position: 'CM',
                  listed_position: 'CM',
                })),
              };
            }
            if (sql.includes('FROM players WHERE primary_team_id')) {
              return {
                results: Array.from({ length: 5 }, (_, i) => ({
                  name: `Club ${i + 1}`,
                  position: i === 0 ? 'GK' : 'CM',
                })),
              };
            }
            return { results: [] };
          },
        }),
      }),
      FIXTURE_MATCH.id,
      'team-club',
      'Club Team',
    );
    expect(lineup.source).toBe('projected');
    expect(lineup.players).toEqual(['Club 1', 'Club 2', 'Club 3', 'Club 4', 'Club 5']);
  });

  it('builds a synthetic projected roster when no persisted data exists', async () => {
    const lineup = await getProjectedLineupForMatch(
      createMockEnv({
        DB: createMockDb({
          first: () => null,
          all: () => ({ results: [] }),
        }),
      }),
      FIXTURE_MATCH.id,
      'team-long',
      'Very Long National Team Name',
    );
    expect(lineup.source).toBe('projected');
    expect(lineup.players).toHaveLength(11);
    expect(lineup.players[0]).toContain('Very Long Na');
  });

  it('falls through empty persisted rows and undefined result arrays to a synthetic roster', async () => {
    const lineup = await getProjectedLineupForMatch(
      createMockEnv({
        DB: createMockDb({
          first: (sql) => {
            if (sql.includes('FROM lineups l')) {
              return { id: 'lu-empty', formation: '4-3-3', is_official: 0 };
            }
            return null;
          },
          all: (sql) => {
            if (sql.includes('FROM lineup_players')) return { results: [] };
            if (sql.includes('FROM squad_players')) return {} as never;
            if (sql.includes('FROM players WHERE primary_team_id')) return {} as never;
            return { results: [] };
          },
        }),
      }),
      FIXTURE_MATCH.id,
      'team-fallback',
      'Fallback Nation',
    );
    expect(lineup.source).toBe('projected');
    expect(lineup.players).toHaveLength(11);
    expect(lineup.players[0]).toContain('Fallback N');
  });

  it('uses position fallbacks when squad rows omit listed positions', async () => {
    const lineup = await getProjectedLineupForMatch(
      createMockEnv({
        DB: createMockDb({
          first: () => null,
          all: (sql) => {
            if (sql.includes('FROM squad_players')) {
              return {
                results: [
                  { name: 'Keeper', position: 'GK', listed_position: null },
                  { name: 'Defender 1', position: 'DEF', listed_position: null },
                  { name: 'Defender 2', position: 'DEF', listed_position: null },
                  { name: 'Defender 3', position: 'DEF', listed_position: null },
                  { name: 'Defender 4', position: 'DEF', listed_position: null },
                  { name: 'Mid 1', position: 'MID', listed_position: null },
                  { name: 'Mid 2', position: 'MID', listed_position: null },
                  { name: 'Mid 3', position: 'MID', listed_position: null },
                  { name: 'Wing 1', position: 'W', listed_position: null },
                  { name: 'Wing 2', position: 'W', listed_position: null },
                  { name: 'Unknown', position: null, listed_position: null },
                ],
              };
            }
            return { results: [] };
          },
        }),
      }),
      FIXTURE_MATCH.id,
      FIXTURE_MATCH.home_team_id,
      'Mexico',
    );
    expect(lineup.source).toBe('squad');
    expect(lineup.formation).toBe('4-3-3');
    expect(lineup.players).toContain('Unknown');
  });
});
