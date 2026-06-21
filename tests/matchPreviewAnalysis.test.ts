import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildMatchPreviewContext,
  getMatchPreviewAnalysis,
} from '../src/services/matchPreviewAnalysis';
import { createMockDb, createMockEnv, createMockKv } from './helpers/mockEnv';
import { FIXTURE_MATCH, FIXTURE_SNAPSHOT, FIXTURE_TEAMS, FIXTURE_TOURNAMENT } from './helpers/fixtures';
import { gatewayChatJson, isGatewayConfigured } from '../src/ai/gatewayClient';
import { getGroupContextForMatch } from '../src/services/matchGroupContext';
import { getHeadToHead } from '../src/services/matchHistory';
import * as probabilityRepo from '../src/db/repositories/probabilityRepo';

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

vi.mock('../src/ai/gatewayClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/ai/gatewayClient')>();
  return {
    ...actual,
    isGatewayConfigured: vi.fn(actual.isGatewayConfigured),
    gatewayChatJson: vi.fn(actual.gatewayChatJson),
  };
});

type PreviewEnvOpts = {
  match?: typeof FIXTURE_MATCH;
  snapshot?: typeof FIXTURE_SNAPSHOT | null;
  lineupSource?: string;
  lineupPlayers?: number;
  homeTeam?: typeof FIXTURE_TEAMS[0];
  awayTeam?: typeof FIXTURE_TEAMS[1];
  kvSeed?: Record<string, string>;
};

function previewEnv(opts: PreviewEnvOpts = {}) {
  const {
    match = FIXTURE_MATCH,
    snapshot = FIXTURE_SNAPSHOT,
    lineupSource = 'match_official',
    lineupPlayers = 11,
    homeTeam = FIXTURE_TEAMS[0],
    awayTeam = FIXTURE_TEAMS[1],
    kvSeed = {},
  } = opts;
  const lineupId = 'lu-preview';
  return createMockEnv({
    KV: createMockKv(kvSeed),
    DB: createMockDb({
      first: (sql, binds) => {
        if (sql.includes('SELECT * FROM matches WHERE id = ?')) {
          return binds[0] === match.id ? match : null;
        }
        if (sql.includes('SELECT * FROM teams WHERE id = ?')) {
          return binds[0] === homeTeam.id ? homeTeam : awayTeam;
        }
        if (sql.includes('FROM probability_snapshots') && sql.includes('match_id = ?')) {
          return snapshot;
        }
        if (sql.includes('FROM lineups l')) {
          return {
            id: lineupId,
            formation: '4-3-3',
            is_official: lineupSource.includes('official') ? 1 : 0,
            source_type: lineupSource,
            confidence: 0.9,
          };
        }
        if (sql.includes('SELECT year FROM tournaments')) return { year: FIXTURE_TOURNAMENT.year };
        if (sql.includes('home_team_id, away_team_id')) {
          return { home_team_id: match.home_team_id, away_team_id: match.away_team_id };
        }
        return null;
      },
      all: (sql) => {
        if (sql.includes('FROM lineup_players')) {
          return {
            results: Array.from({ length: lineupPlayers }, (_, i) => ({
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
  afterEach(() => {
    vi.mocked(isGatewayConfigured).mockReset();
    vi.mocked(gatewayChatJson).mockReset();
    vi.mocked(getGroupContextForMatch).mockReset();
    vi.mocked(getHeadToHead).mockReset();
  });

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

  it('covers knockout context, away favourite, and elo gap branches', async () => {
    vi.mocked(getGroupContextForMatch).mockResolvedValueOnce({ fixtures: [] });
    vi.mocked(getHeadToHead).mockResolvedValueOnce({
      summary: { recentFormHome: '—', recentFormAway: '—', totalMatches: 0 },
    } as never);
    const env = previewEnv({
      match: { ...FIXTURE_MATCH, stage: 'Quarter-final', group_code: null },
      snapshot: {
        ...FIXTURE_SNAPSHOT,
        home_win_prob: 0.25,
        away_win_prob: 0.55,
        draw_prob: 0.2,
        scoreline_json: '{"2-1":0.15,"1-1":0.12}',
        most_likely_score: '2-1',
      },
      homeTeam: { ...FIXTURE_TEAMS[0], elo_rating: 1600, collective_strength_rating: 0.55, fifa_ranking: null },
      awayTeam: { ...FIXTURE_TEAMS[1], elo_rating: 1900, collective_strength_rating: 0.88, fifa_ranking: 5 },
      lineupSource: 'squad_official',
    });
    const analysis = await getMatchPreviewAnalysis(env, FIXTURE_MATCH.id);
    expect(analysis?.sections.context.en).toContain('Quarter-final');
    expect(analysis?.sections.strength.en).toContain('Away side edges');
    expect(analysis?.sections.tactical.en).toContain('Model leans');
    expect(analysis?.probabilityNote?.en).toContain('ML 2-1');
  });

  it('covers pending lineups, balanced tactical view, and invalid scoreline json', async () => {
    vi.mocked(getHeadToHead).mockResolvedValueOnce({
      summary: { recentFormHome: 'W', recentFormAway: 'L', totalMatches: 1 },
    } as never);
    const env = previewEnv({
      snapshot: {
        ...FIXTURE_SNAPSHOT,
        home_win_prob: 0.34,
        away_win_prob: 0.33,
        draw_prob: 0.33,
        scoreline_json: '{bad json',
      },
      lineupPlayers: 5,
      lineupSource: 'projected',
      homeTeam: { ...FIXTURE_TEAMS[0], collective_strength_rating: 0.62 },
    });
    const analysis = await getMatchPreviewAnalysis(env, FIXTURE_MATCH.id);
    expect(analysis?.sections.lineup.en).toContain('No confirmed lineup');
    expect(analysis?.sections.tactical.en).toContain('Balanced shape battle');
    expect(analysis?.sections.form.en).toContain('H2H form');
  });

  it('recomputes probability when snapshot missing and uses AI enhancement', async () => {
    vi.mocked(isGatewayConfigured).mockReturnValue(true);
    vi.mocked(gatewayChatJson).mockResolvedValue({
      summaryVi: 'Tóm tắt AI',
      summary: 'AI summary',
      contextVi: 'Bối cảnh AI',
      context: 'AI context',
      strengthVi: 'Sức mạnh AI',
      strength: 'AI strength',
      lineupVi: 'ĐH AI',
      lineup: 'AI lineup',
      formVi: 'Phong độ AI',
      form: 'AI form',
      tacticalVi: 'Chiến thuật AI',
      tactical: 'AI tactical',
      insightsVi: ['Ghi chú 1'],
      insights: ['Note 1'],
    });
    const env = previewEnv({ snapshot: null });
    vi.spyOn(probabilityRepo, 'getLatestSnapshot')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(FIXTURE_SNAPSHOT);
    const analysis = await getMatchPreviewAnalysis(env, FIXTURE_MATCH.id);
    expect(analysis?.summary.vi).toBe('Tóm tắt AI');
    expect(analysis?.insights[0]?.en).toBe('Note 1');
  });

  it('returns cached analysis and ignores invalid cache JSON', async () => {
    const env = previewEnv({
      kvSeed: {
        [`preview:v4:${FIXTURE_MATCH.id}:${FIXTURE_SNAPSHOT.input_hash}`]: '{bad',
      },
    });
    const first = await getMatchPreviewAnalysis(env, FIXTURE_MATCH.id);
    const second = await getMatchPreviewAnalysis(env, FIXTURE_MATCH.id);
    expect(first?.matchId).toBe(FIXTURE_MATCH.id);
    expect(second?.summary.en).toBe(first?.summary.en);
  });

  it('aiEnhancePreview falls back when gateway throws', async () => {
    vi.mocked(isGatewayConfigured).mockReturnValue(true);
    vi.mocked(gatewayChatJson).mockRejectedValueOnce(new Error('gateway down'));
    const env = previewEnv();
    const analysis = await getMatchPreviewAnalysis(env, FIXTURE_MATCH.id);
    expect(analysis?.sections.context.vi).toContain('Bảng');
  });

  it('buildMatchPreviewContext returns null when team missing', async () => {
    const env = previewEnv();
    vi.spyOn(await import('../src/db/repositories/teamsRepo'), 'getTeam').mockResolvedValueOnce(null);
    expect(await buildMatchPreviewContext(env, FIXTURE_MATCH.id)).toBeNull();
  });

  it('covers home elo edge, group-without-fixtures, and AI insight fallbacks', async () => {
    vi.mocked(getGroupContextForMatch).mockResolvedValueOnce({ fixtures: [] });
    vi.mocked(isGatewayConfigured).mockReturnValue(true);
    vi.mocked(gatewayChatJson).mockResolvedValue({
      summaryVi: 'Tóm tắt',
      summary: 'Summary',
      contextVi: 'Ctx',
      context: 'Ctx EN',
      strengthVi: 'Str home edge',
      strength: 'Str EN home edge',
      lineupVi: 'LU',
      lineup: 'LU EN',
      formVi: 'Form',
      form: 'Form EN',
      tacticalVi: 'Tac',
      tactical: 'Tac EN',
      insightsVi: ['Insight A', 'Insight B'],
      insights: ['Only one EN insight'],
    });
    const env = previewEnv({
      match: { ...FIXTURE_MATCH, stage: 'Group', group_code: 'A' },
      homeTeam: { ...FIXTURE_TEAMS[0], elo_rating: 1900, collective_strength_rating: 0.85 },
      awayTeam: { ...FIXTURE_TEAMS[1], elo_rating: 1700, collective_strength_rating: 0.55 },
      snapshot: {
        ...FIXTURE_SNAPSHOT,
        home_win_prob: 0.55,
        away_win_prob: 0.2,
        draw_prob: 0.25,
      },
    });
    const analysis = await getMatchPreviewAnalysis(env, FIXTURE_MATCH.id);
    expect(analysis?.sections.strength.en).toMatch(/home edge|Home side edges/i);
    expect(analysis?.sections.context.en).toBe('Ctx EN');
    expect(analysis?.insights[1]?.en).toBe('Insight B');
  });

  it('covers away favourite and knockout context branches', async () => {
    vi.mocked(getHeadToHead).mockResolvedValueOnce({
      summary: { recentFormHome: '—', recentFormAway: '—', totalMatches: 0 },
    });
    const env = previewEnv({
      match: { ...FIXTURE_MATCH, stage: 'Quarter-final', group_code: null },
      homeTeam: { ...FIXTURE_TEAMS[0], elo_rating: 1650 },
      awayTeam: { ...FIXTURE_TEAMS[1], elo_rating: 1920, collective_strength_rating: 0.88 },
      snapshot: {
        ...FIXTURE_SNAPSHOT,
        home_win_prob: 0.22,
        away_win_prob: 0.58,
        draw_prob: 0.2,
      },
      lineupSource: 'match_official',
      lineupPlayers: 11,
    });
    const analysis = await getMatchPreviewAnalysis(env, FIXTURE_MATCH.id);
    expect(analysis?.sections.strength.en).toMatch(/Away side edges/i);
    expect(analysis?.sections.context.en).toMatch(/knockout|Quarter/i);
    expect(analysis?.sections.tactical.en).toMatch(/Model leans|leans/i);
  });

  it('uses pending lineup text when roster has fewer than seven players', async () => {
    const env = previewEnv({
      match: { ...FIXTURE_MATCH, stage: null, group_code: null },
      lineupPlayers: 5,
      lineupSource: 'projected',
    });
    const analysis = await getMatchPreviewAnalysis(env, FIXTURE_MATCH.id);
    expect(analysis?.sections.lineup.en).toMatch(/No confirmed lineup|pending/i);
    expect(analysis?.matchLabel.en).toMatch(/Mexico vs/i);
  });

  it('uses short-lineup fallback even for official sources', async () => {
    const env = previewEnv({
      lineupPlayers: 5,
      lineupSource: 'match_official',
    });
    const analysis = await getMatchPreviewAnalysis(env, FIXTURE_MATCH.id);
    expect(analysis?.sections.lineup.en).toContain('No confirmed lineup');
  });

  it('keeps rule-based insights when AI omits English insight lines', async () => {
    vi.mocked(isGatewayConfigured).mockReturnValue(true);
    vi.mocked(gatewayChatJson).mockResolvedValue({
      summaryVi: 'Tóm tắt AI',
      summary: 'AI summary',
      contextVi: 'Bối cảnh AI',
      context: 'AI context',
      strengthVi: 'Sức mạnh AI',
      strength: 'AI strength',
      lineupVi: 'Đội hình AI',
      lineup: 'AI lineup',
      formVi: 'Phong độ AI',
      form: 'AI form',
      tacticalVi: 'Chiến thuật AI',
      tactical: 'AI tactical',
      insightsVi: ['Chỉ có tiếng Việt'],
      insights: [],
    });
    const env = previewEnv();
    const analysis = await getMatchPreviewAnalysis(env, FIXTURE_MATCH.id);
    expect(analysis?.insights[0]?.en).toContain('Likely scores');
  });

  it('buildMatchPreviewContext handles missing probability snapshot', async () => {
    vi.spyOn(probabilityRepo, 'getLatestSnapshot').mockResolvedValue(null);
    const env = previewEnv({ snapshot: null });
    const ctx = await buildMatchPreviewContext(env, FIXTURE_MATCH.id);
    expect(ctx?.prob).toBeNull();
  });
});
