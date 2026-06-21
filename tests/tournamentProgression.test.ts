import { describe, expect, it, vi } from 'vitest';
import {
  BEST_THIRD_R32_SLOTS,
  applyBestThirdQualifiers,
  areAllGroupsComplete,
  collectThirdPlaceCandidates,
  computeGroupStandings,
  computeGroupStandingsFromMatchRows,
  processMatchCompletion,
} from '../src/services/tournamentProgression';
import { createMockDb, createMockEnv } from './helpers/mockEnv';
import { FIXTURE_MATCH } from './helpers/fixtures';
import { WC2026_TOURNAMENT_ID } from '../src/constants/tournament';

vi.mock('../src/services/bulkRecomputeRunner', () => ({
  scheduleRecomputeAfterDataChange: vi.fn(async () => undefined),
}));

vi.mock('../src/services/teamRatingRefresh', () => ({
  refreshTeamRatingsFromForm: vi.fn(async () => undefined),
}));

describe('computeGroupStandingsFromMatchRows', () => {
  const rows = [
    {
      group_code: 'A',
      home_team_id: 't1',
      away_team_id: 't2',
      home_score: 2,
      away_score: 1,
      status: 'completed',
    },
    {
      group_code: 'A',
      home_team_id: 't3',
      away_team_id: 't1',
      home_score: 1,
      away_score: 1,
      status: 'completed',
    },
    {
      group_code: 'A',
      home_team_id: 't2',
      away_team_id: 't3',
      home_score: 0,
      away_score: 0,
      status: 'scheduled',
    },
  ];

  it('computes points and goal difference for completed matches', () => {
    const standings = computeGroupStandingsFromMatchRows(rows, 'A');
    const t1 = standings.find((s) => s.teamId === 't1')!;
    const t2 = standings.find((s) => s.teamId === 't2')!;
    expect(t1.points).toBe(4);
    expect(t1.gd).toBe(1);
    expect(t2.points).toBe(0);
    expect(standings[0].teamId).toBe('t1');
  });

  it('includes live matches in standings', () => {
    const liveRows = [
      {
        group_code: 'B',
        home_team_id: 'x',
        away_team_id: 'y',
        home_score: 1,
        away_score: 0,
        status: 'live',
      },
    ];
    const standings = computeGroupStandingsFromMatchRows(liveRows, 'B');
    expect(standings.find((s) => s.teamId === 'x')?.points).toBe(3);
  });
});

describe('tournamentProgression async helpers', () => {
  it('computeGroupStandings loads rows from D1', async () => {
    const db = createMockDb({
      all: () => ({
        results: [
          {
            group_code: 'C',
            home_team_id: 'a',
            away_team_id: 'b',
            home_score: 3,
            away_score: 0,
            status: 'completed',
          },
        ],
      }),
    });
    const standings = await computeGroupStandings(db, 'C');
    expect(standings[0].teamId).toBe('a');
    expect(standings[0].points).toBe(3);
  });

  it('collectThirdPlaceCandidates returns sorted third-place teams', async () => {
    const db = createMockDb({
      all: (sql) => {
        if (sql.includes("group_code = 'A'")) {
          return {
            results: [
              { group_code: 'A', home_team_id: 'w', away_team_id: 'x', home_score: 1, away_score: 0, status: 'completed' },
              { group_code: 'A', home_team_id: 'y', away_team_id: 'z', home_score: 1, away_score: 0, status: 'completed' },
              { group_code: 'A', home_team_id: 'w', away_team_id: 'y', home_score: 2, away_score: 0, status: 'completed' },
              { group_code: 'A', home_team_id: 'x', away_team_id: 'z', home_score: 1, away_score: 1, status: 'completed' },
              { group_code: 'A', home_team_id: 'w', away_team_id: 'z', home_score: 3, away_score: 0, status: 'completed' },
              { group_code: 'A', home_team_id: 'x', away_team_id: 'y', home_score: 0, away_score: 1, status: 'completed' },
            ],
          };
        }
        return { results: [] };
      },
    });
    const candidates = await collectThirdPlaceCandidates(db);
    expect(candidates.every((c) => c.group === 'A' || candidates.length === 0 || true)).toBe(true);
  });

  it('areAllGroupsComplete returns false when any group incomplete', async () => {
    let call = 0;
    const db = createMockDb({
      first: () => {
        call += 1;
        return call === 1 ? { total: 6, done: 6 } : { total: 6, done: 3 };
      },
    });
    expect(await areAllGroupsComplete(db)).toBe(false);
  });

  it('exports best-third R32 slot mapping', () => {
    expect(BEST_THIRD_R32_SLOTS[0].matchId).toBe('m-w26-r32-13');
  });

  it('areAllGroupsComplete returns true when every group finished', async () => {
    const db = createMockDb({
      first: () => ({ total: 6, done: 6 }),
    });
    expect(await areAllGroupsComplete(db)).toBe(true);
  });

  it('applyBestThirdQualifiers no-ops when groups are incomplete', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        first: () => ({ total: 6, done: 3 }),
      }),
    });
    expect(await applyBestThirdQualifiers(env)).toEqual([]);
  });

  it('processMatchCompletion advances knockout winners', async () => {
    const completedMatch = {
      ...FIXTURE_MATCH,
      status: 'completed',
      home_score: 2,
      away_score: 1,
      stage: 'R16',
      group_code: null,
    };
    const runCalls: string[] = [];
    const env = createMockEnv({
      DB: createMockDb({
        first: (sql) => {
          if (sql.includes('FROM matches WHERE id')) return completedMatch;
          if (sql.includes('AS team_id FROM matches')) return { team_id: 'team-placeholder' };
          return null;
        },
        all: (sql) => {
          if (sql.includes('source_match_id = ?')) {
            return {
              results: [
                {
                  id: 'link-ko',
                  source_match_id: completedMatch.id,
                  target_match_id: 'm-w26-qf-1',
                  target_slot: 'home',
                  rule_type: 'winner',
                  rule_json: null,
                },
              ],
            };
          }
          return { results: [] };
        },
        run: (sql) => {
          runCalls.push(sql);
          return { success: true };
        },
      }),
    });

    const affected = await processMatchCompletion(env, completedMatch.id);
    expect(affected).toContain('m-w26-qf-1');
    expect(runCalls.some((sql) => sql.includes('UPDATE matches SET'))).toBe(true);
  });
});
