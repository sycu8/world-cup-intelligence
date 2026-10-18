import { describe, expect, it } from 'vitest';
import { getMatchRecap } from '../src/services/matchRecap';
import { createMockDb, createMockEnv, createMockKv } from './helpers/mockEnv';
import { FIXTURE_MATCH } from './helpers/fixtures';

function recapDb() {
  return createMockDb({
    first: (sql) => {
      if (sql.includes('FROM matches m') && sql.includes('m.id = ?')) {
        return { ...FIXTURE_MATCH, slug: FIXTURE_MATCH.id, status: 'completed' };
      }
      if (sql.includes('FROM match_recaps')) {
        return {
          summary_vi: 'Tóm tắt trận',
          summary_en: 'Match summary',
          source_id: 'fifa-1',
          updated_at: '2026-06-12T00:00:00Z',
        };
      }
      return null;
    },
    all: (sql) => {
      if (sql.includes('FROM match_commentary')) {
        return {
          results: [
            {
              id: 'c1',
              minute: 23,
              period: '1H',
              text_vi: 'Bàn thắng!',
              text_en: 'Goal!',
              event_type: 'goal',
            },
          ],
        };
      }
      if (sql.includes('FROM player_match_stats')) {
        return {
          results: [
            {
              player_id: 'p1',
              player_name: 'Striker',
              team_id: FIXTURE_MATCH.home_team_id,
              shirt_number: 9,
              minutes_played: 90,
              goals: 1,
              assists: 0,
              shots: 4,
              shots_on_target: 2,
              xg: 0.9,
              yellow_cards: 0,
              red_cards: 0,
            },
          ],
        };
      }
      return { results: [] };
    },
  });
}

describe('getMatchRecap', () => {
  it('returns recap, commentary, and player stats', async () => {
    const kv = createMockKv({
      [`cache:match-ref:${FIXTURE_MATCH.id}`]: JSON.stringify({
        ...FIXTURE_MATCH,
        slug: FIXTURE_MATCH.id,
        status: 'completed',
      }),
    });
    const env = createMockEnv({ DB: recapDb(), KV: kv, MOCK_SOURCES: 'true' });
    const payload = await getMatchRecap(env, FIXTURE_MATCH.id);
    expect(payload?.summaryVi).toBe('Tóm tắt trận');
    expect(payload?.commentary).toHaveLength(1);
    expect(payload?.playerStats[0].goals).toBe(1);
  });

  it('returns null when no recap or commentary exists', async () => {
    const db = createMockDb({
      first: (sql) => {
        if (sql.includes('FROM matches m')) return { ...FIXTURE_MATCH, slug: FIXTURE_MATCH.id };
        return null;
      },
      all: () => ({ results: [] }),
    });
    const kv = createMockKv({
      [`cache:match-ref:${FIXTURE_MATCH.id}`]: JSON.stringify({ ...FIXTURE_MATCH, slug: FIXTURE_MATCH.id }),
    });
    const env = createMockEnv({ DB: db, KV: kv, MOCK_SOURCES: 'true' });
    expect(await getMatchRecap(env, FIXTURE_MATCH.id)).toBeNull();
  });
});
