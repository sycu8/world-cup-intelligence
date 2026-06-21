import { describe, expect, it, vi } from 'vitest';
import {
  buildMatchPreviewContext,
  getMatchPreviewAnalysis,
} from '../src/services/matchPreviewAnalysis';
import { createMockDb, createMockEnv, createMockKv } from './helpers/mockEnv';
import { FIXTURE_MATCH, FIXTURE_SNAPSHOT, FIXTURE_TEAMS, FIXTURE_TOURNAMENT } from './helpers/fixtures';

vi.mock('../src/ingestion/fifa/fifaLineupSync', () => ({
  syncFifaMatchLineupsByRef: vi.fn(async () => undefined),
}));

vi.mock('../src/services/officialLineupSync', () => ({
  syncOfficialSquadToMatch: vi.fn(async () => undefined),
}));

vi.mock('../src/services/matchGroupContext', () => ({
  getGroupContextForMatch: vi.fn(async () => ({ fixtures: [{ home: 'Mexico', away: 'Poland' }] })),
}));

vi.mock('../src/services/matchHistory', () => ({
  getHeadToHead: vi.fn(async () => ({
    summary: { recentFormHome: 'W D', recentFormAway: 'L W', totalMatches: 2 },
  })),
}));

vi.mock('../src/services/recomputeMatch', () => ({
  recomputeMatchProbability: vi.fn(async () => null),
}));

vi.mock('../src/ai/gatewayClient', () => ({
  isGatewayConfigured: vi.fn(() => false),
  gatewayChatJson: vi.fn(),
}));

function previewEnv() {
  const lineupId = 'lu-preview';
  return createMockEnv({
    KV: createMockKv(),
    DB: createMockDb({
      first: (sql, binds) => {
        if (sql.includes('SELECT * FROM matches WHERE id = ? AND tournament_id = ?')) {
          return binds[0] === FIXTURE_MATCH.id ? FIXTURE_MATCH : null;
        }
        if (sql.includes('SELECT * FROM teams WHERE id = ?')) {
          return binds[0] === FIXTURE_TEAMS[0].id ? FIXTURE_TEAMS[0] : FIXTURE_TEAMS[1];
        }
        if (sql.includes('FROM probability_snapshots') && sql.includes('match_id = ?')) {
          return FIXTURE_SNAPSHOT;
        }
        if (sql.includes('FROM lineups l')) {
          return {
            id: lineupId,
            formation: '4-3-3',
            is_official: 1,
            source_type: 'match_official',
            confidence: 0.9,
          };
        }
        if (sql.includes('SELECT year FROM tournaments')) return { year: FIXTURE_TOURNAMENT.year };
        if (sql.includes('home_team_id, away_team_id')) {
          return { home_team_id: FIXTURE_MATCH.home_team_id, away_team_id: FIXTURE_MATCH.away_team_id };
        }
        return null;
      },
      all: (sql) => {
        if (sql.includes('FROM lineup_players')) {
          return {
            results: Array.from({ length: 11 }, (_, i) => ({
              name: `Player ${i + 1}`,
              shirt_number: i + 1,
              position_slot: i === 0 ? 'GK' : 'CM',
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
}

describe('matchPreviewAnalysis', () => {
  it('buildMatchPreviewContext assembles sides and probability', async () => {
    const ctx = await buildMatchPreviewContext(previewEnv(), FIXTURE_MATCH.id);
    expect(ctx?.matchId).toBe(FIXTURE_MATCH.id);
    expect(ctx?.homeSide.teamName).toBe(FIXTURE_TEAMS[0].name);
    expect(ctx?.awaySide.teamName).toBe(FIXTURE_TEAMS[1].name);
    expect(ctx?.prob?.homeWin).toBe(FIXTURE_SNAPSHOT.home_win_prob);
  });

  it('getMatchPreviewAnalysis returns rule-based preview and caches in KV', async () => {
    const env = previewEnv();
    const analysis = await getMatchPreviewAnalysis(env, FIXTURE_MATCH.id);
    expect(analysis?.matchId).toBe(FIXTURE_MATCH.id);
    expect(analysis?.sections.context.vi).toContain('Bảng');
    expect(analysis?.summary.en).toContain('vs');
    expect(env.KV.put).toHaveBeenCalled();

    const cached = await getMatchPreviewAnalysis(env, FIXTURE_MATCH.id);
    expect(cached?.dataHash).toBe(analysis?.dataHash);
  });

  it('returns null for unknown match', async () => {
    expect(await buildMatchPreviewContext(previewEnv(), 'missing-match')).toBeNull();
  });
});
