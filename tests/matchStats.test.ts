import { describe, expect, it } from 'vitest';
import { getMatchStats } from '../src/services/matchStats';
import { createMockDb, createMockEnv, createMockKv } from './helpers/mockEnv';
import { FIXTURE_MATCH } from './helpers/fixtures';

function statsDb(opts: { hasStats?: boolean; hasRecap?: boolean } = {}) {
  const { hasStats = true, hasRecap = false } = opts;
  return createMockDb({
    first: (sql, binds) => {
      if (sql.includes('FROM matches m') && sql.includes('m.id = ?')) {
        return {
          ...FIXTURE_MATCH,
          slug: FIXTURE_MATCH.id,
          home_name: 'Mexico',
          away_name: 'South Africa',
        };
      }
      if (sql.includes('FROM teams WHERE id')) {
        return binds[0] === FIXTURE_MATCH.home_team_id
          ? { id: FIXTURE_MATCH.home_team_id, name: 'Mexico' }
          : { id: FIXTURE_MATCH.away_team_id, name: 'South Africa' };
      }
      if (sql.includes('FROM match_events WHERE match_id') && sql.includes('SUM(CASE')) {
        return { goals: 2, yellow_cards: 3, red_cards: 0, substitutions: 4 };
      }
      if (sql.includes('SELECT status, minute')) {
        return {
          status: 'live',
          minute: 67,
          home_score: 1,
          away_score: 0,
          updated_at: '2026-06-11T20:00:00Z',
        };
      }
      if (sql.includes('FROM match_recaps')) return hasRecap ? { ok: 1 } : null;
      return null;
    },
    all: (sql) => {
      if (sql.includes('FROM team_match_stats')) {
        return hasStats
          ? {
              results: [
                {
                  team_id: FIXTURE_MATCH.home_team_id,
                  possession: 58,
                  shots: 12,
                  shots_on_target: 5,
                  xg: 1.4,
                  passes: 420,
                  pass_accuracy: 86,
                  created_at: '2026-06-11T20:00:00Z',
                },
                {
                  team_id: FIXTURE_MATCH.away_team_id,
                  possession: 42,
                  shots: 6,
                  shots_on_target: 2,
                  xg: 0.7,
                  passes: 310,
                  pass_accuracy: 78,
                  created_at: '2026-06-11T20:00:00Z',
                },
              ],
            }
          : { results: [] };
      }
      return { results: [] };
    },
  });
}

describe('getMatchStats', () => {
  it('returns team stats and event counts for live match', async () => {
    const kv = createMockKv({
      [`cache:match-ref:${FIXTURE_MATCH.id}`]: JSON.stringify({
        ...FIXTURE_MATCH,
        slug: FIXTURE_MATCH.id,
      }),
    });
    const env = createMockEnv({
      DB: statsDb({ hasStats: true, hasRecap: true }),
      KV: kv,
      MOCK_SOURCES: 'true',
    });
    const payload = await getMatchStats(env, FIXTURE_MATCH.id);
    expect(payload?.matchId).toBe(FIXTURE_MATCH.id);
    expect(payload?.home.possession).toBe(58);
    expect(payload?.events.goals).toBe(2);
    expect(payload?.dataSource).toBe('fifa_live');
    expect(payload?.dataSourceLabel).toContain('Opta');
    expect(payload?.xgEstimateNote).toContain('Opta');
  });

  it('returns unavailable data source when no stats rows', async () => {
    const kv = createMockKv({
      [`cache:match-ref:${FIXTURE_MATCH.id}`]: JSON.stringify({
        ...FIXTURE_MATCH,
        slug: FIXTURE_MATCH.id,
      }),
    });
    const env = createMockEnv({ DB: statsDb({ hasStats: false }), KV: kv, MOCK_SOURCES: 'true' });
    const payload = await getMatchStats(env, FIXTURE_MATCH.id);
    expect(payload?.dataSource).toBe('unavailable');
    expect(payload?.home.possession).toBeNull();
  });
});
