import { describe, expect, it } from 'vitest';
import { assignFormationCoords } from '../src/lib/formationLayout';
import {
  aggregateMovement,
  applySubstitutions,
  computePlayerRating,
  getPitchMapPayload,
} from '../src/services/pitchMap';
import { createMockDb, createMockEnv, createMockKv } from './helpers/mockEnv';
import { FIXTURE_MATCH } from './helpers/fixtures';

describe('assignFormationCoords', () => {
  it('places home GK deep left and ST advanced', () => {
    const players = [
      { playerId: 'gk', position: 'GK' },
      { playerId: 'st', position: 'ST' },
    ];
    const coords = assignFormationCoords('4-3-3', players, 'home');
    expect(coords.get('gk')!.x).toBeLessThan(coords.get('st')!.x);
    expect(coords.get('gk')!.y).toBeCloseTo(0.5, 1);
  });

  it('mirrors away team to the right half', () => {
    const players = [{ playerId: 'cb', position: 'CB' }];
    const home = assignFormationCoords('4-3-3', players, 'home');
    const away = assignFormationCoords('4-3-3', players, 'away');
    expect(away.get('cb')!.x).toBeGreaterThan(home.get('cb')!.x);
  });
});

describe('applySubstitutions', () => {
  it('swaps starters with subs at given minute', () => {
    const starters = new Set(['a', 'b']);
    const onPitch = new Set(starters);
    const marks = applySubstitutions(
      starters,
      onPitch,
      [{ minute: 60, player_id: 'c', related_player_id: 'a', team_id: 't1' }],
      90,
    );
    expect(onPitch.has('a')).toBe(false);
    expect(onPitch.has('c')).toBe(true);
    expect(marks.get('a')?.subType).toBe('out');
    expect(marks.get('c')?.subType).toBe('in');
  });
});

describe('computePlayerRating', () => {
  it('rewards goals and caps range', () => {
    const high = computePlayerRating({
      player_id: 'p1',
      team_id: 't',
      minutes_played: 90,
      goals: 2,
      assists: 1,
      shots: 4,
      shots_on_target: 3,
      xg: 1.2,
      passes: 40,
      pass_accuracy: 85,
      yellow_cards: 0,
      red_cards: 0,
    });
    expect(high).toBeGreaterThan(7);
    expect(high).toBeLessThanOrEqual(10);
  });
});

describe('aggregateMovement', () => {
  it('averages movement vectors per player', () => {
    const map = aggregateMovement([
      { player_id: 'p1', team_id: 't', x: 0.5, y: 0.5, end_x: 0.6, end_y: 0.5 },
      { player_id: 'p1', team_id: 't', x: 0.6, y: 0.5, end_x: 0.8, end_y: 0.5 },
    ]);
    const v = map.get('p1');
    expect(v?.dx).toBeCloseTo(0.15, 2);
    expect(v?.dy).toBeCloseTo(0, 2);
  });

  it('skips rows without end coordinates', () => {
    const map = aggregateMovement([
      { player_id: 'p1', team_id: 't', x: 0.5, y: 0.5, end_x: null, end_y: null },
    ]);
    expect(map.size).toBe(0);
  });
});

describe('getPitchMapPayload', () => {
  const homePlayers = ['p-h1', 'p-h2', 'p-h3', 'p-h4', 'p-h5', 'p-h6', 'p-h7', 'p-h8', 'p-h9', 'p-h10', 'p-h11'];
  const awayPlayers = ['p-a1', 'p-a2', 'p-a3', 'p-a4', 'p-a5', 'p-a6', 'p-a7', 'p-a8', 'p-a9', 'p-a10', 'p-a11'];

  function lineupRow(teamId: string, teamName: string, playerId: string, i: number, starter: number) {
    return {
      lineup_id: `lu-${teamId}`,
      team_id: teamId,
      team_name: teamName,
      formation: '4-3-3',
      source_type: 'match_official',
      player_id: playerId,
      player_name: `Player ${playerId}`,
      shirt_number: i + 1,
      position_slot: i === 0 ? 'GK' : i < 5 ? 'CB' : i < 8 ? 'CM' : 'ST',
      role: null,
      player_position: null,
      is_starter: starter,
      x: 0.2 + i * 0.05,
      y: 0.5,
    };
  }

  function pitchMapDb(status = 'live', minute = 70) {
    return createMockDb({
      first: (sql, binds) => {
        if (sql.includes('FROM matches m') && sql.includes('m.id = ?')) {
          return {
            ...FIXTURE_MATCH,
            status,
            minute,
            slug: FIXTURE_MATCH.id,
            home_name: 'Mexico',
            away_name: 'South Africa',
          };
        }
        if (sql.includes('SELECT name FROM teams')) {
          return { name: binds[0] === FIXTURE_MATCH.home_team_id ? 'Mexico' : 'South Africa' };
        }
        return null;
      },
      all: (sql) => {
        if (sql.includes('FROM lineups l')) {
          const rows = [
            ...homePlayers.map((id, i) => lineupRow(FIXTURE_MATCH.home_team_id, 'Mexico', id, i, 1)),
            ...awayPlayers.map((id, i) => lineupRow(FIXTURE_MATCH.away_team_id, 'South Africa', id, i, 1)),
            lineupRow(FIXTURE_MATCH.home_team_id, 'Mexico', 'p-h-sub', 11, 0),
          ];
          return { results: rows };
        }
        if (sql.includes("event_type = 'substitution'")) {
          return {
            results: [
              {
                minute: 60,
                player_id: 'p-h-sub',
                related_player_id: 'p-h11',
                team_id: FIXTURE_MATCH.home_team_id,
              },
            ],
          };
        }
        if (sql.includes('FROM player_match_stats')) {
          return {
            results: [
              {
                player_id: 'p-h1',
                team_id: FIXTURE_MATCH.home_team_id,
                minutes_played: 90,
                goals: 1,
                assists: 0,
                shots: 2,
                shots_on_target: 1,
                xg: 0.8,
                passes: 40,
                pass_accuracy: 85,
                yellow_cards: 0,
                red_cards: 0,
              },
            ],
          };
        }
        if (sql.includes('FROM match_events') && sql.includes('end_x')) {
          return {
            results: [
              {
                player_id: 'p-h1',
                team_id: FIXTURE_MATCH.home_team_id,
                x: 0.4,
                y: 0.5,
                end_x: 0.55,
                end_y: 0.52,
              },
            ],
          };
        }
        if (sql.includes('FROM match_events') && sql.includes('event_type')) {
          return {
            results: [
              {
                id: 'ev-1',
                x: 0.7,
                y: 0.4,
                end_x: null,
                end_y: null,
                event_type: 'shot',
                team_id: FIXTURE_MATCH.home_team_id,
                player_id: 'p-h9',
                minute: 33,
              },
            ],
          };
        }
        return { results: [] };
      },
    });
  }

  it('builds pitch map with substitutions, ratings, and events', async () => {
    const kv = createMockKv({
      [`cache:match-ref:${FIXTURE_MATCH.id}`]: JSON.stringify({
        ...FIXTURE_MATCH,
        slug: FIXTURE_MATCH.id,
        status: 'live',
        minute: 70,
      }),
    });
    const env = createMockEnv({ DB: pitchMapDb(), KV: kv, MOCK_SOURCES: 'true' });
    const payload = await getPitchMapPayload(env, FIXTURE_MATCH.id);
    expect(payload?.matchId).toBe(FIXTURE_MATCH.id);
    expect(payload?.showRatings).toBe(true);
    expect(payload?.home.players.some((p) => p.playerId === 'p-h-sub')).toBe(true);
    expect(payload?.home.bench.some((p) => p.playerId === 'p-h11')).toBe(true);
    expect(payload?.events).toHaveLength(1);
    expect(payload?.home.players.find((p) => p.playerId === 'p-h1')?.rating).toBeGreaterThan(6);
  });

  it('returns null when no lineup rows exist', async () => {
    const kv = createMockKv({
      [`cache:match-ref:${FIXTURE_MATCH.id}`]: JSON.stringify({ ...FIXTURE_MATCH, slug: FIXTURE_MATCH.id }),
    });
    const env = createMockEnv({
      DB: createMockDb({
        first: () => ({ ...FIXTURE_MATCH, slug: FIXTURE_MATCH.id }),
        all: () => ({ results: [] }),
      }),
      KV: kv,
      MOCK_SOURCES: 'true',
    });
    expect(await getPitchMapPayload(env, FIXTURE_MATCH.id)).toBeNull();
  });
});
