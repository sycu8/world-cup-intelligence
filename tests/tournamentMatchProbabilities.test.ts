import { describe, expect, it, vi } from 'vitest';
import {
  buildTournamentMatchProbabilitiesPayload,
  persistMissingTournamentProbabilities,
} from '../src/services/tournamentMatchProbabilities';
import { createMockDb, createMockEnv, createMockKv } from './helpers/mockEnv';
import { FIXTURE_MATCH, FIXTURE_SNAPSHOT } from './helpers/fixtures';
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
});
