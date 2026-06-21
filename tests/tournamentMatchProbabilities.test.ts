import { describe, expect, it, vi } from 'vitest';
import {
  buildTournamentMatchProbabilitiesPayload,
  persistMissingTournamentProbabilities,
} from '../src/services/tournamentMatchProbabilities';
import { createMockDb, createMockEnv, createMockKv } from './helpers/mockEnv';
import { FIXTURE_MATCH, FIXTURE_SNAPSHOT, FIXTURE_TEAMS } from './helpers/fixtures';
import { WC2026_TOURNAMENT_ID } from '../src/constants/tournament';

vi.mock('../src/services/recomputeMatch', () => ({
  recomputeMatchProbability: vi.fn(async () => ({
    matchId: FIXTURE_MATCH.id,
    homeWinProb: 0.5,
    drawProb: 0.25,
    awayWinProb: 0.25,
  })),
}));

describe('tournamentMatchProbabilities', () => {
  it('returns existing snapshots without inline fill when complete', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        all: (sql) => {
          if (sql.includes('FROM probability_snapshots')) {
            return {
              results: [
                {
                  matchId: FIXTURE_MATCH.id,
                  homeWinProb: FIXTURE_SNAPSHOT.home_win_prob,
                  drawProb: FIXTURE_SNAPSHOT.draw_prob,
                  awayWinProb: FIXTURE_SNAPSHOT.away_win_prob,
                },
              ],
            };
          }
          if (sql.includes('FROM matches WHERE tournament_id')) {
            return { results: [FIXTURE_MATCH] };
          }
          return { results: [] };
        },
      }),
    });
    const payload = await buildTournamentMatchProbabilitiesPayload(env, WC2026_TOURNAMENT_ID);
    expect(payload.meta.pending).toBe(0);
    expect(payload.data[FIXTURE_MATCH.id].homeWin).toBe(FIXTURE_SNAPSHOT.home_win_prob);
  });

  it('skipInlineFill schedules background gap fill for missing ids', async () => {
    const kv = createMockKv();
    const env = createMockEnv({
      KV: kv,
      DB: createMockDb({
        all: (sql) => {
          if (sql.includes('FROM probability_snapshots')) return { results: [] };
          if (sql.includes('FROM matches WHERE tournament_id')) return { results: [FIXTURE_MATCH] };
          return { results: [] };
        },
      }),
    });
    const payload = await buildTournamentMatchProbabilitiesPayload(env, WC2026_TOURNAMENT_ID, {
      skipInlineFill: true,
    });
    expect(payload.meta.missingIds).toContain(FIXTURE_MATCH.id);
    await new Promise((r) => setTimeout(r, 20));
    expect(kv.put).toHaveBeenCalledWith('tournament-prob-gap-fill', 'running', { expirationTtl: 600 });
  });

  it('persistMissingTournamentProbabilities skips when KV lock present', async () => {
    const kv = createMockKv({ 'tournament-prob-gap-fill': 'running' });
    const env = createMockEnv({ KV: kv, DB: createMockDb() });
    await persistMissingTournamentProbabilities(env, [FIXTURE_MATCH.id]);
    expect(kv.delete).not.toHaveBeenCalled();
  });

  it('persistMissingTournamentProbabilities recomputes missing matches', async () => {
    const kv = createMockKv();
    const env = createMockEnv({
      KV: kv,
      DB: createMockDb({
        first: (sql) => {
          if (sql.includes('FROM matches WHERE id')) return FIXTURE_MATCH;
          if (sql.includes('FROM teams WHERE id')) return FIXTURE_TEAMS[0];
          if (sql.includes('SELECT year FROM tournaments')) return { year: 2026 };
          return null;
        },
        all: () => ({ results: [] }),
        run: () => ({ success: true, meta: { changes: 1 } }),
      }),
    });
    await persistMissingTournamentProbabilities(env, [FIXTURE_MATCH.id]);
    expect(kv.delete).toHaveBeenCalledWith('tournament-prob-gap-fill');
  });

  it('buildTournamentMatchProbabilitiesPayload fills missing inline within budget', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        all: (sql) => {
          if (sql.includes('FROM probability_snapshots')) return { results: [] };
          if (sql.includes('FROM matches WHERE tournament_id')) return { results: [FIXTURE_MATCH] };
          return { results: [] };
        },
        first: (sql, binds) => {
          if (sql.includes('FROM matches WHERE id')) return FIXTURE_MATCH;
          if (sql.includes('FROM teams WHERE id')) {
            return binds[0] === FIXTURE_MATCH.home_team_id ? FIXTURE_TEAMS[0] : FIXTURE_TEAMS[1];
          }
          if (sql.includes('SELECT year FROM tournaments')) return { year: 2026 };
          return null;
        },
        run: () => ({ success: true, meta: { changes: 1 } }),
      }),
    });
    const payload = await buildTournamentMatchProbabilitiesPayload(env, WC2026_TOURNAMENT_ID, {
      scheduleBackgroundFill: false,
    });
    expect(payload.data[FIXTURE_MATCH.id]?.homeWin).toBeGreaterThan(0);
    expect(payload.meta.withProbability).toBe(1);
  });

  it('buildTournamentMatchProbabilitiesPayload queues background fill after budget exceeded', async () => {
    const matches = Array.from({ length: 3 }, (_, i) => ({
      ...FIXTURE_MATCH,
      id: `m-gap-${i}`,
    }));
    const kv = createMockKv();
    const originalNow = Date.now;
    let tick = 0;
    Date.now = () => {
      tick += 1;
      return tick === 1 ? originalNow() : originalNow() + 10_000;
    };
    const env = createMockEnv({
      KV: kv,
      DB: createMockDb({
        all: (sql) => {
          if (sql.includes('FROM probability_snapshots')) return { results: [] };
          if (sql.includes('FROM matches WHERE tournament_id')) return { results: matches };
          return { results: [] };
        },
        first: (sql, binds) => {
          if (sql.includes('FROM matches WHERE id') && binds[0] === FIXTURE_MATCH.id) return FIXTURE_MATCH;
          if (sql.includes('FROM matches WHERE id')) return { ...FIXTURE_MATCH, id: binds[0] };
          if (sql.includes('FROM teams WHERE id')) {
            return binds[0] === FIXTURE_MATCH.home_team_id ? FIXTURE_TEAMS[0] : FIXTURE_TEAMS[1];
          }
          if (sql.includes('SELECT year FROM tournaments')) return { year: 2026 };
          return null;
        },
        run: () => ({ success: true, meta: { changes: 1 } }),
      }),
    });
    const payload = await buildTournamentMatchProbabilitiesPayload(env, WC2026_TOURNAMENT_ID, {
      scheduleBackgroundFill: true,
    });
    expect(payload.meta.missingIds.length).toBeGreaterThan(0);
    await new Promise((r) => setTimeout(r, 20));
    expect(kv.put).toHaveBeenCalledWith('tournament-prob-gap-fill', 'running', { expirationTtl: 600 });
    Date.now = originalNow;
  });

  it('buildTournamentMatchProbabilitiesPayload records preview misses and gap-fill errors', async () => {
    const matches = [{ ...FIXTURE_MATCH, id: 'm-miss' }];
    const kv = createMockKv();
    const env = createMockEnv({
      KV: kv,
      DB: createMockDb({
        all: (sql) => {
          if (sql.includes('FROM probability_snapshots')) return { results: [] };
          if (sql.includes('FROM matches WHERE tournament_id')) return { results: matches };
          return { results: [] };
        },
        first: (sql) => {
          if (sql.includes('FROM matches WHERE id')) return null;
          return null;
        },
      }),
    });
    const payload = await buildTournamentMatchProbabilitiesPayload(env, WC2026_TOURNAMENT_ID, {
      scheduleBackgroundFill: true,
    });
    expect(payload.meta.missingIds).toContain('m-miss');
    await new Promise((r) => setTimeout(r, 20));
  });

  it('persistMissingTournamentProbabilities continues after recompute errors', async () => {
    const { recomputeMatchProbability } = await import('../src/services/recomputeMatch');
    vi.mocked(recomputeMatchProbability).mockRejectedValueOnce(new Error('gap fill fail'));
    const kv = createMockKv();
    const env = createMockEnv({ KV: kv, DB: createMockDb({ first: () => null }) });
    await persistMissingTournamentProbabilities(env, [FIXTURE_MATCH.id, 'm-2']);
    expect(kv.delete).toHaveBeenCalledWith('tournament-prob-gap-fill');
  });
});
