import { describe, expect, it, vi } from 'vitest';
import * as lineupsRepo from '../src/db/repositories/lineupsRepo';
import {
  applyOfficialLineupToMatch,
  syncOfficialLineupsToMatches,
  syncOfficialSquadToMatch,
} from '../src/services/officialLineupSync';

vi.mock('../src/services/bulkRecomputeRunner', () => ({
  scheduleRecomputeAfterDataChange: vi.fn(async () => undefined),
}));

vi.mock('../src/services/recomputeMatch', () => ({
  recomputeMatchProbability: vi.fn(async () => null),
}));

function mockEnv(state: {
  lineup?: { id: string; formation: string; is_official: number; source_type: string | null } | null;
  squad?: {
    id: string;
    team_id: string;
    source_id: string | null;
    confidence: number;
    announced_at: string | null;
  } | null;
  squadPlayers?: {
    player_id: string;
    shirt_number: number | null;
    listed_position: string | null;
    position: string | null;
    name: string;
  }[];
  omitSquadResults?: boolean;
}) {
  const upserts: lineupsRepo.UpsertMatchLineupInput[] = [];

  const db = {
    prepare: (sql: string) => ({
      bind: (...args: unknown[]) => ({
        first: async () => {
          if (sql.includes('FROM lineups')) return state.lineup ?? null;
          if (sql.includes('FROM squads')) return state.squad ?? null;
          return null;
        },
        all: async () => {
          if (sql.includes('squad_players') && state.omitSquadResults) return {};
          return {
            results:
              sql.includes('squad_players') && state.squadPlayers ? state.squadPlayers : [],
          };
        },
        run: async () => ({}),
      }),
    }),
  } as unknown as D1Database;

  vi.spyOn(lineupsRepo, 'upsertMatchLineup').mockImplementation(async (_db, input) => {
    upserts.push(input);
    return `lu-${input.matchId}-${input.teamId}`;
  });

  return {
    env: { DB: db } as import('../src/env').AppEnv,
    upserts,
  };
}

describe('officialLineupSync', () => {
  it('writes match_official lineup via admin apply', async () => {
    const { env, upserts } = mockEnv({ lineup: null });
    const result = await applyOfficialLineupToMatch(env, {
      matchId: 'm-1',
      teamId: 'team-usa',
      formation: '4-3-3',
      players: Array.from({ length: 11 }, (_, i) => ({
        playerId: `p-${i}`,
        positionSlot: String(i + 1),
      })),
    });

    expect(result.updated).toBe(true);
    expect(upserts[0]?.sourceType).toBe('match_official');
    expect(upserts[0]?.isOfficial).toBe(true);
  });

  it('does not overwrite confirmed match_official with squad sync', async () => {
    const { env, upserts } = mockEnv({
      lineup: {
        id: 'lu-m-1-team-usa',
        formation: '4-3-3',
        is_official: 1,
        source_type: 'match_official',
      },
      squad: {
        id: 'sq-usa',
        team_id: 'team-usa',
        source_id: 'src-mock',
        confidence: 0.9,
        announced_at: '2026-05-01',
      },
      squadPlayers: Array.from({ length: 11 }, (_, i) => ({
        player_id: `p-${i}`,
        shirt_number: i + 1,
        listed_position: i === 0 ? 'GK' : 'MF',
        position: 'MF',
        name: `Player ${i}`,
      })),
    });

    const changed = await syncOfficialSquadToMatch(env, 'm-1', 'team-usa');
    expect(changed).toBe(false);
    expect(upserts).toHaveLength(0);
  });

  it('syncs official squad into match lineup when none exists', async () => {
    const { env, upserts } = mockEnv({
      lineup: null,
      squad: {
        id: 'sq-fra',
        team_id: 'team-fra',
        source_id: 'src-mock',
        confidence: 0.9,
        announced_at: '2026-05-01',
      },
      squadPlayers: Array.from({ length: 11 }, (_, i) => ({
        player_id: `p-${i}`,
        shirt_number: i + 1,
        listed_position: i === 0 ? 'GK' : i < 5 ? 'CB' : 'FW',
        position: 'FW',
        name: `Player ${i}`,
      })),
    });

    const changed = await syncOfficialSquadToMatch(env, 'm-w26-ga-1v2', 'team-fra');
    expect(changed).toBe(true);
    expect(upserts[0]?.sourceType).toBe('squad_official');
    expect(upserts[0]?.isOfficial).toBe(true);
    expect(upserts[0]?.players).toHaveLength(11);
  });

  it('applyOfficialLineupToMatch replaces existing match_official when re-applied', async () => {
    const { env, upserts } = mockEnv({
      lineup: {
        id: 'lu-m-1-team-usa',
        formation: '4-3-3',
        is_official: 1,
        source_type: 'match_official',
      },
    });
    const result = await applyOfficialLineupToMatch(env, {
      matchId: 'm-1',
      teamId: 'team-usa',
      formation: '4-4-2',
      players: [{ playerId: 'p-1' }],
    });
    expect(result.updated).toBe(true);
    expect(upserts).toHaveLength(1);
  });

  it('syncOfficialSquadToMatch returns false when squad has fewer than seven players', async () => {
    const { env } = mockEnv({
      lineup: null,
      squad: {
        id: 'sq-small',
        team_id: 'team-usa',
        source_id: 'src-mock',
        confidence: 0.5,
        announced_at: '2026-05-01',
      },
      squadPlayers: Array.from({ length: 5 }, (_, i) => ({
        player_id: `p-${i}`,
        shirt_number: i + 1,
        listed_position: 'MF',
        position: 'MF',
        name: `Player ${i}`,
      })),
    });
    expect(await syncOfficialSquadToMatch(env, 'm-1', 'team-usa')).toBe(false);
  });

  it('syncOfficialSquadToMatch returns false when squad player query omits results', async () => {
    const { env } = mockEnv({
      lineup: null,
      squad: {
        id: 'sq-empty',
        team_id: 'team-usa',
        source_id: 'src-mock',
        confidence: 0.5,
        announced_at: '2026-05-01',
      },
      omitSquadResults: true,
    });
    expect(await syncOfficialSquadToMatch(env, 'm-1', 'team-usa')).toBe(false);
  });

  it('syncOfficialSquadToMatch infers 4-2-3-1 formation', async () => {
    const squadPlayers = [
      { player_id: 'p-1', shirt_number: 1, listed_position: 'GK', position: 'GK', name: 'Keeper' },
      ...Array.from({ length: 3 }, (_, i) => ({
        player_id: `d-${i}`,
        shirt_number: i + 2,
        listed_position: 'DEF',
        position: 'DEF',
        name: `Def ${i}`,
      })),
      ...Array.from({ length: 2 }, (_, i) => ({
        player_id: `m-${i}`,
        shirt_number: i + 5,
        listed_position: 'CM',
        position: 'CM',
        name: `Mid ${i}`,
      })),
      ...Array.from({ length: 2 }, (_, i) => ({
        player_id: `f-${i}`,
        shirt_number: i + 7,
        listed_position: 'FW',
        position: 'FW',
        name: `Fwd ${i}`,
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        player_id: `b-${i}`,
        shirt_number: i + 9,
        listed_position: 'DEF',
        position: 'DEF',
        name: `Bench ${i}`,
      })),
    ];
    const { env, upserts } = mockEnv({
      lineup: null,
      squad: {
        id: 'sq-4231',
        team_id: 'team-usa',
        source_id: null,
        confidence: 0.8,
        announced_at: '2026-05-02',
      },
      squadPlayers,
    });

    expect(await syncOfficialSquadToMatch(env, 'm-4231', 'team-usa')).toBe(true);
    expect(upserts[0]?.formation).toBe('4-2-3-1');
  });

  it('syncOfficialSquadToMatch infers 3-5-2 and fills starter and bench slot fallbacks', async () => {
    const squadPlayers = [
      { player_id: 'p-1', shirt_number: 1, listed_position: 'GK', position: 'GK', name: 'Keeper' },
      { player_id: 'p-2', shirt_number: 2, listed_position: 'DEF', position: 'DEF', name: 'DEF 1' },
      { player_id: 'p-3', shirt_number: 3, listed_position: 'DEF', position: 'DEF', name: 'DEF 2' },
      { player_id: 'p-4', shirt_number: 4, listed_position: 'CM', position: 'CM', name: 'MID 1' },
      { player_id: 'p-5', shirt_number: 5, listed_position: 'CM', position: 'CM', name: 'MID 2' },
      { player_id: 'p-6', shirt_number: 6, listed_position: 'CM', position: 'CM', name: 'MID 3' },
      { player_id: 'p-7', shirt_number: 7, listed_position: 'CM', position: 'CM', name: 'MID 4' },
      { player_id: 'p-8', shirt_number: 8, listed_position: 'CM', position: 'CM', name: 'MID 5' },
      { player_id: 'p-9', shirt_number: 9, listed_position: 'FW', position: 'FW', name: 'FW 1' },
      { player_id: 'p-10', shirt_number: 10, listed_position: 'FW', position: 'FW', name: 'FW 2' },
      { player_id: 'p-11', shirt_number: 11, listed_position: null, position: null, name: 'Utility Starter' },
      { player_id: 'p-12', shirt_number: 12, listed_position: null, position: null, name: 'Bench Utility' },
    ];
    const { env, upserts } = mockEnv({
      lineup: null,
      squad: {
        id: 'sq-352',
        team_id: 'team-usa',
        source_id: null,
        confidence: 0.77,
        announced_at: '2026-05-02',
      },
      squadPlayers,
    });

    const changed = await syncOfficialSquadToMatch(env, 'm-formation', 'team-usa');
    expect(changed).toBe(true);
    expect(upserts[0]?.formation).toBe('3-5-2');
    expect(upserts[0]?.sourceId).toBeNull();
    expect(upserts[0]?.players[10]?.positionSlot).toBe('11');
    expect(upserts[0]?.players[11]).toMatchObject({
      playerId: 'p-12',
      isStarter: false,
      positionSlot: 'SUB1',
    });
  });

  it('syncOfficialLineupsToMatches recomputes inline for small update sets', async () => {
    const { recomputeMatchProbability } = await import('../src/services/recomputeMatch');
    const matches = [{ id: 'm-1', home_team_id: 'team-fra', away_team_id: 'team-usa' }];
    const squadPlayers = Array.from({ length: 11 }, (_, i) => ({
      player_id: `p-${i}`,
      shirt_number: i + 1,
      listed_position: i === 0 ? 'GK' : i < 5 ? 'CB' : 'FW',
      position: 'FW',
      name: `Player ${i}`,
    }));
    const { env } = mockEnv({
      lineup: null,
      squad: {
        id: 'sq-fra',
        team_id: 'team-fra',
        source_id: 'src-mock',
        confidence: 0.9,
        announced_at: '2026-05-01',
      },
      squadPlayers,
    });
    env.DB.prepare = ((sql: string) => ({
      bind: (...args: unknown[]) => ({
        first: async () => {
          if (sql.includes('FROM lineups')) return null;
          if (sql.includes('FROM squads')) {
            return {
              id: 'sq-fra',
              team_id: args[0],
              source_id: 'src-mock',
              confidence: 0.9,
              announced_at: '2026-05-01',
            };
          }
          return null;
        },
        all: async () => ({
          results: sql.includes('squad_players') ? squadPlayers : matches,
        }),
        run: async () => ({}),
      }),
    })) as typeof env.DB.prepare;

    const result = await syncOfficialLineupsToMatches(env, { allScheduled: true, recompute: true });
    expect(result.lineupsUpdated).toBeGreaterThan(0);
    expect(recomputeMatchProbability).toHaveBeenCalled();
  });

  it('syncOfficialLineupsToMatches handles missing result arrays without recomputing', async () => {
    const { env } = mockEnv({ lineup: null, squad: null, squadPlayers: [] });
    env.DB.prepare = ((sql: string) => ({
      bind: () => ({
        first: async () => null,
        all: async () => (sql.includes('FROM matches') ? ({ results: undefined }) : { results: undefined }),
        run: async () => ({}),
      }),
    })) as typeof env.DB.prepare;

    const result = await syncOfficialLineupsToMatches(env, { allScheduled: true, recompute: false });
    expect(result).toEqual({ matchesChecked: 0, lineupsUpdated: 0, matchIds: [] });
  });

  it('applyOfficialLineupToMatch overwrites squad_official lineup', async () => {
    const { env, upserts } = mockEnv({
      lineup: {
        id: 'lu-squad',
        formation: '4-4-2',
        is_official: 1,
        source_type: 'squad_official',
      },
    });
    const result = await applyOfficialLineupToMatch(env, {
      matchId: 'm-1',
      teamId: 'team-usa',
      formation: '4-3-3',
      players: [{ playerId: 'p-1' }],
    });
    expect(result.updated).toBe(true);
    expect(upserts[0]?.sourceType).toBe('match_official');
  });

  it('syncOfficialSquadToMatch replaces a non-official projected lineup', async () => {
    const { env, upserts } = mockEnv({
      lineup: {
        id: 'lu-projected',
        formation: '4-2-3-1',
        is_official: 0,
        source_type: 'projected',
      },
      squad: {
        id: 'sq-fra',
        team_id: 'team-fra',
        source_id: 'src-mock',
        confidence: 0.9,
        announced_at: '2026-05-01',
      },
      squadPlayers: Array.from({ length: 11 }, (_, i) => ({
        player_id: `p-${i}`,
        shirt_number: i + 1,
        listed_position: i === 0 ? 'GK' : i < 5 ? 'CB' : 'FW',
        position: 'FW',
        name: `Player ${i}`,
      })),
    });

    const changed = await syncOfficialSquadToMatch(env, 'm-2', 'team-fra');
    expect(changed).toBe(true);
    expect(upserts[0]?.sourceType).toBe('squad_official');
  });

  it('syncOfficialLineupsToMatches bulk recompute when many matches updated', async () => {
    const matches = Array.from({ length: 7 }, (_, i) => ({
      id: `m-${i}`,
      home_team_id: 'team-fra',
      away_team_id: 'team-usa',
    }));
    const { env, upserts } = mockEnv({
      lineup: null,
      squad: {
        id: 'sq-fra',
        team_id: 'team-fra',
        source_id: 'src-mock',
        confidence: 0.9,
        announced_at: '2026-05-01',
      },
      squadPlayers: Array.from({ length: 11 }, (_, i) => ({
        player_id: `p-${i}`,
        shirt_number: i + 1,
        listed_position: i === 0 ? 'GK' : 'MF',
        position: 'MF',
        name: `Player ${i}`,
      })),
    });

    env.DB.prepare = ((sql: string) => ({
      bind: (...args: unknown[]) => ({
        first: async () => {
          if (sql.includes('FROM lineups')) return null;
          if (sql.includes('FROM squads')) {
            return {
              id: 'sq-fra',
              team_id: args[0],
              source_id: 'src-mock',
              confidence: 0.9,
              announced_at: '2026-05-01',
            };
          }
          return null;
        },
        all: async () => ({
          results:
            sql.includes('squad_players')
              ? Array.from({ length: 11 }, (_, i) => ({
                  player_id: `p-${i}`,
                  shirt_number: i + 1,
                  listed_position: 'MF',
                  position: 'MF',
                  name: `Player ${i}`,
                }))
              : matches,
        }),
        run: async () => ({}),
      }),
    })) as typeof env.DB.prepare;

    const result = await syncOfficialLineupsToMatches(env, { allScheduled: true });
    expect(result.matchesChecked).toBe(7);
    expect(result.lineupsUpdated).toBeGreaterThan(0);
    expect(upserts.length).toBeGreaterThan(0);
  });
});
