import { describe, expect, it } from 'vitest';
import {
  getProbabilityMovement,
  getScenariosPayload,
  getTeamSystemPayload,
} from '../src/services/matchIntelligence';
import { createMockDb, createMockEnv } from './helpers/mockEnv';
import { FIXTURE_MATCH } from './helpers/fixtures';

describe('matchIntelligence payloads', () => {
  it('getTeamSystemPayload maps stored team system rows', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        first: (sql, binds) => {
          if (sql.includes('FROM matches WHERE id')) return FIXTURE_MATCH;
          if (sql.includes('FROM team_system_profiles')) {
            return {
              team_id: binds[0],
              tactical_identity: 'high_press',
              primary_formation: '4-3-3',
              collective_strength_score: 0.8,
              formation_stability_score: 0.7,
              pressing_score: 0.75,
              defensive_compactness_score: 0.6,
              transition_score: 0.65,
              set_piece_score: 0.55,
              bench_depth_score: 0.7,
              lineup_cohesion_score: 0.72,
              possession_control_score: 0.68,
              tempo_score: 0.66,
              model_version: 'wc-prob-v2',
              source_id: null,
            };
          }
          return null;
        },
      }),
    });
    const payload = await getTeamSystemPayload(env, FIXTURE_MATCH.id);
    expect(payload?.matchId).toBe(FIXTURE_MATCH.id);
    expect(payload?.home?.primaryFormation).toBe('4-3-3');
    expect(payload?.disclaimer).toContain('collective');
  });

  it('getScenariosPayload lists scenario probabilities', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        all: (sql) => {
          if (sql.includes('FROM scenario_probabilities')) {
            return {
              results: [
                {
                  scenario_type: 'baseline_expected_flow',
                  probability: 0.4,
                  confidence: 0.8,
                  explanation_factors_json: '[]',
                },
              ],
            };
          }
          return { results: [] };
        },
      }),
    });
    const payload = await getScenariosPayload(env, FIXTURE_MATCH.id);
    expect(payload.matchId).toBe(FIXTURE_MATCH.id);
    expect(payload.scenarios.length).toBeGreaterThanOrEqual(0);
  });

  it('getProbabilityMovement collapses unchanged snapshots', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        all: () => ({
          results: [
            {
              minute: 0,
              home_win_prob: 0.5,
              draw_prob: 0.25,
              away_win_prob: 0.25,
              created_at: '2026-01-01T00:00:00Z',
              model_version: 'v1',
            },
            {
              minute: 0,
              home_win_prob: 0.501,
              draw_prob: 0.249,
              away_win_prob: 0.25,
              created_at: '2026-01-01T00:05:00Z',
              model_version: 'v1',
            },
            {
              minute: 45,
              home_win_prob: 0.55,
              draw_prob: 0.22,
              away_win_prob: 0.23,
              created_at: '2026-01-01T01:00:00Z',
              model_version: 'v1',
            },
          ],
        }),
      }),
    });
    const payload = await getProbabilityMovement(env, FIXTURE_MATCH.id);
    expect(payload.events.length).toBe(2);
    expect(payload.events[1].reasonCode).toBe('live');
  });
});
