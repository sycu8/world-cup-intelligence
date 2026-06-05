import { describe, expect, it, vi } from 'vitest';
import * as lineupsRepo from '../src/db/repositories/lineupsRepo';
import {
  applyOfficialLineupToMatch,
  syncOfficialSquadToMatch,
} from '../src/services/officialLineupSync';

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
        all: async () => ({
          results:
            sql.includes('squad_players') && state.squadPlayers ? state.squadPlayers : [],
        }),
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
});
