import { describe, expect, it, vi } from 'vitest';
import {
  ensureMatchLineups,
  formatLineupPlayerLine,
  getLineupDisplayForMatch,
  lineupPositionGroup,
  normalizeLineupPosition,
} from '../src/services/lineupDisplay';
import { sortLineupPlayers, formatLineupPlayerLine as appFormatLineupPlayerLine, lineupPositionGroup as appLineupPositionGroup } from '../app/lib/lineupDisplay';
import { createMockDb, createMockEnv } from './helpers/mockEnv';
import { FIXTURE_MATCH, FIXTURE_PLAYER } from './helpers/fixtures';

vi.mock('../src/ingestion/fifa/fifaLineupSync', () => ({
  syncFifaMatchLineupsByRef: vi.fn(async () => undefined),
}));

vi.mock('../src/services/officialLineupSync', () => ({
  syncOfficialSquadToMatch: vi.fn(async () => undefined),
}));

describe('lineupDisplay', () => {
  it('formats official player line as (number) - name - position', () => {
    expect(
      formatLineupPlayerLine({ shirtNumber: 10, name: 'Lionel Messi', position: 'ST' }),
    ).toBe('(10) - Lionel Messi - ST');
  });

  it('normalizes long position labels to short codes', () => {
    expect(normalizeLineupPosition(null, null, 'Goalkeeper')).toBe('GK');
    expect(normalizeLineupPosition('DM', null, null)).toBe('DM');
  });

  it('uses em dash placeholder when shirt number missing', () => {
    expect(formatLineupPlayerLine({ shirtNumber: null, name: 'Player', position: 'CM' })).toBe(
      '(—) - Player - CM',
    );
  });

  it('sorts lineup by position group then shirt number', () => {
    const sorted = sortLineupPlayers([
      { shirtNumber: 9, name: 'Striker', position: 'ST' },
      { shirtNumber: 12, name: 'Keeper', position: 'GK' },
      { shirtNumber: 4, name: 'Defender', position: 'CB' },
    ]);
    expect(sorted.map((p) => p.position)).toEqual(['GK', 'CB', 'ST']);
    expect(sorted[0].shirtNumber).toBe(12);
  });

  it('maps positions to lineup groups', () => {
    expect(lineupPositionGroup('GK')).toBe('GK');
    expect(lineupPositionGroup('CB')).toBe('DEF');
    expect(lineupPositionGroup('DM')).toBe('MID');
    expect(lineupPositionGroup('ST')).toBe('FWD');
    expect(lineupPositionGroup('LW')).toBe('FWD');
  });

  it('covers app lineup helper edge cases', () => {
    expect(appLineupPositionGroup('D')).toBe('DEF');
    expect(appLineupPositionGroup('M')).toBe('MID');
    expect(appLineupPositionGroup('F')).toBe('FWD');
    expect(appLineupPositionGroup('Goalkeeper')).toBe('GK');
    expect(appLineupPositionGroup('Unknown')).toBe('MID');

    const sorted = sortLineupPlayers([
      { shirtNumber: null, name: 'NoNum', position: 'DM' },
      { shirtNumber: 1, name: 'Keeper', position: 'GK' },
    ]);
    expect(sorted[0].name).toBe('Keeper');

    expect(appFormatLineupPlayerLine({ shirtNumber: 8, name: 'Mid', position: 'CM' })).toBe(
      '(8) - Mid - CM',
    );
  });

  it('normalizes verbose and empty position labels', () => {
    expect(normalizeLineupPosition(null, null, null)).toBe('—');
    expect(normalizeLineupPosition(null, null, 'Goalkeeper')).toBe('GK');
    expect(normalizeLineupPosition(null, null, 'Very Long Position Name')).toBe('VER');
  });

  it('loads official lineup from D1 when 11 starters present', async () => {
    const lineupId = 'lineup-1';
    const env = createMockEnv({
      DB: createMockDb({
        first: (sql) => {
          if (sql.includes('FROM lineups l')) {
            return {
              id: lineupId,
              formation: '4-3-3',
              is_official: 1,
              source_type: 'match_official',
              confidence: 0.95,
            };
          }
          return null;
        },
        all: (sql) => {
          if (sql.includes('FROM lineup_players')) {
            return {
              results: Array.from({ length: 11 }, (_, i) => ({
                name: `Player ${i + 1}`,
                shirt_number: i + 1,
                position_slot: i === 0 ? 'GK' : i < 5 ? 'CB' : i < 8 ? 'CM' : 'ST',
                role: null,
                position: null,
                is_starter: 1,
              })),
            };
          }
          return { results: [] };
        },
      }),
    });
    const display = await getLineupDisplayForMatch(env, FIXTURE_MATCH.id, FIXTURE_MATCH.home_team_id);
    expect(display.source).toBe('official');
    expect(display.hasAccurateLineup).toBe(true);
    expect(display.starters).toHaveLength(11);
    expect(display.grouped.GK).toHaveLength(1);
  });

  it('falls back to projected lineup from team name', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        first: () => null,
        all: () => ({ results: [] }),
      }),
    });
    const display = await getLineupDisplayForMatch(
      env,
      FIXTURE_MATCH.id,
      FIXTURE_MATCH.home_team_id,
      'Mexico',
    );
    expect(display.source).toBe('projected');
    expect(display.starters.length).toBeGreaterThanOrEqual(7);
    expect(display.displayLines[0]).toContain('Mexico');
  });

  it('loads squad roster fallback when official lineup missing', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        first: (sql) => {
          if (sql.includes('FROM squads')) return { id: 'sq-1', confidence: 0.8 };
          return null;
        },
        all: (sql) => {
          if (sql.includes('FROM squad_players')) {
            return {
              results: Array.from({ length: 12 }, (_, i) => ({
                name: `Squad ${i + 1}`,
                shirt_number: i + 1,
                listed_position: i === 0 ? 'GK' : 'CM',
                position: i === 0 ? 'GK' : 'MF',
              })),
            };
          }
          return { results: [] };
        },
      }),
    });
    const display = await getLineupDisplayForMatch(env, FIXTURE_MATCH.id, FIXTURE_MATCH.home_team_id);
    expect(display.source).toBe('squad');
    expect(display.starters.length).toBeGreaterThanOrEqual(7);
  });

  it('loads club roster fallback from players table', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        first: () => null,
        all: (sql) => {
          if (sql.includes('FROM squad_players')) return { results: [] };
          if (sql.includes('FROM players WHERE primary_team_id')) {
            return {
              results: Array.from({ length: 14 }, (_, i) => ({
                name: `Club ${i + 1}`,
                position: i === 0 ? 'GK' : 'MF',
              })),
            };
          }
          return { results: [] };
        },
      }),
    });
    const display = await getLineupDisplayForMatch(env, FIXTURE_MATCH.id, FIXTURE_PLAYER.primary_team_id!);
    expect(display.sourceType).toBe('club_roster');
    expect(display.starters).toHaveLength(11);
  });

  it('ensureMatchLineups syncs FIFA and official squads', async () => {
    const { syncFifaMatchLineupsByRef } = await import('../src/ingestion/fifa/fifaLineupSync');
    const { syncOfficialSquadToMatch } = await import('../src/services/officialLineupSync');
    const env = createMockEnv({
      DB: createMockDb({
        first: (sql) => {
          if (sql.includes('home_team_id, away_team_id')) {
            return {
              home_team_id: FIXTURE_MATCH.home_team_id,
              away_team_id: FIXTURE_MATCH.away_team_id,
            };
          }
          return null;
        },
      }),
    });
    await ensureMatchLineups(env, FIXTURE_MATCH.id);
    expect(syncFifaMatchLineupsByRef).toHaveBeenCalled();
    expect(syncOfficialSquadToMatch).toHaveBeenCalled();
  });
});
