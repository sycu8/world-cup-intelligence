import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockDb, createMockEnv } from './helpers/mockEnv';
import { FIXTURE_MATCH, FIXTURE_TEAMS } from './helpers/fixtures';
import {
  normalizeLineupPosition,
  lineupPositionGroup,
  formatLineupPlayerLine,
} from '../src/services/lineupDisplay';
import { normalizeMarketProbabilities } from '../src/market/calculations/normalizeOverround';
import { getMatchPreviewAnalysis } from '../src/services/matchPreviewAnalysis';
import { createMockKv } from './helpers/mockEnv';
import { FIXTURE_SNAPSHOT } from './helpers/fixtures';

vi.mock('../src/ingestion/fifa/fifaLineupSync', () => ({
  syncFifaMatchLineupsByRef: vi.fn(async () => undefined),
}));
vi.mock('../src/services/officialLineupSync', () => ({
  syncOfficialSquadToMatch: vi.fn(async () => undefined),
}));
vi.mock('../src/services/matchGroupContext', () => ({
  getGroupContextForMatch: vi.fn(async () => ({
    fixtures: [{ home: 'Mexico', away: 'Poland' }],
  })),
}));
vi.mock('../src/services/matchHistory', () => ({
  getHeadToHead: vi.fn(async () => ({
    summary: { recentFormHome: 'W', recentFormAway: 'L', totalMatches: 0 },
  })),
}));
vi.mock('../src/services/recomputeMatch', () => ({
  recomputeMatchProbability: vi.fn(async () => null),
}));
vi.mock('../src/ai/gatewayClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/ai/gatewayClient')>();
  return { ...actual, isGatewayConfigured: vi.fn(() => false), gatewayChatJson: vi.fn() };
});

describe('coverage branches — round 4 backend', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lineupDisplay normalizes varied position strings', () => {
    expect(normalizeLineupPosition(null, null, null)).toBe('—');
    expect(normalizeLineupPosition('goalkeeper', null, null)).toBe('GK');
    expect(normalizeLineupPosition('defender', null, null)).toBe('CB');
    expect(normalizeLineupPosition('midfielder', null, null)).toBe('CM');
    expect(normalizeLineupPosition('forward', null, null)).toBe('ST');
    expect(normalizeLineupPosition('winger', null, null)).toBe('WG');
    expect(normalizeLineupPosition('long position name', null, null)).toBe('LON');
    expect(lineupPositionGroup('GK')).toBe('GK');
    expect(lineupPositionGroup('CB')).toBe('DEF');
    expect(lineupPositionGroup('CM')).toBe('MID');
    expect(lineupPositionGroup('ST')).toBe('FWD');
    expect(lineupPositionGroup('UNKNOWN')).toBe('MID');
    expect(formatLineupPlayerLine({ shirtNumber: null, name: 'X', position: 'CM' })).toContain('(—)');
  });

  it('normalizeMarketProbabilities handles overround removal', () => {
    const result = normalizeMarketProbabilities({ home: 0.5, draw: 0.3, away: 0.3 });
    expect(result.normalized.home + result.normalized.draw + result.normalized.away).toBeCloseTo(1, 5);
    expect(result.overround).toBeGreaterThan(0);
  });

  it('matchPreviewAnalysis covers knockout stage and away-favourite branches', async () => {
    const env = createMockEnv({
      KV: createMockKv(),
      DB: createMockDb({
        first: (sql, binds) => {
          if (sql.includes('FROM matches WHERE id')) {
            return {
              ...FIXTURE_MATCH,
              stage: 'Round of 16',
              group_code: null,
            };
          }
          if (sql.includes('FROM teams WHERE id')) {
            return binds[0] === FIXTURE_TEAMS[0].id ? FIXTURE_TEAMS[0] : FIXTURE_TEAMS[1];
          }
          if (sql.includes('FROM probability_snapshots')) {
            return {
              ...FIXTURE_SNAPSHOT,
              home_win_prob: 0.25,
              away_win_prob: 0.55,
              draw_prob: 0.2,
            };
          }
          if (sql.includes('FROM lineups l')) {
            return {
              id: 'lu-x',
              formation: '4-4-2',
              is_official: 1,
              source_type: 'match_official',
              confidence: 0.9,
            };
          }
          return null;
        },
        all: (sql) => {
          if (sql.includes('FROM lineup_players')) {
            return {
              results: Array.from({ length: 11 }, (_, i) => ({
                name: `P${i}`,
                shirt_number: i + 1,
                position_slot: 'CM',
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
    const analysis = await getMatchPreviewAnalysis(env, FIXTURE_MATCH.id);
    expect(analysis?.sections.context.en).toMatch(/knockout|Round/i);
    expect(analysis?.sections.strength.en).toMatch(/Away side edges|edges underlying/i);
  });

});
