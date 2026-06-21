import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../src/db/client';
import { getMatchRecap } from '../src/services/matchRecap';
import { getMatchStats } from '../src/services/matchStats';
import { computeHotScore, mediumThumbnailUrl } from '../src/services/newsScoring';
import {
  normalizeArticleLink,
  normalizeFeedImageUrl,
} from '../src/services/newsImageUrls';
import { validateScenarioSet, assertValidScenarioSet } from '../src/models/scenarios/scenarioValidation';
import { explainScenarioPrediction } from '../src/ai/explainScenarioPrediction';
import { runBacktest } from '../src/models/backtesting/backtestRunner';
import { mirrorCoord } from '../src/lib/formationLayout';
import { createMockDb, createMockEnv, createMockKv } from './helpers/mockEnv';
import { FIXTURE_MATCH, FIXTURE_SNAPSHOT, FIXTURE_TEAMS } from './helpers/fixtures';
import { mockScenario } from './helpers/scenarioFixtures';

vi.mock('../src/ingestion/fifa/fifaLiveSync', () => ({
  shouldSyncFifaMatch: vi.fn(async () => false),
  syncFifaMatchByRef: vi.fn(async () => undefined),
}));

vi.mock('../src/ingestion/fifa/fifaLiveBlogSync', () => ({
  shouldSyncFifaBlogAndStats: vi.fn(async () => true),
  ensureFifaBlogAndStats: vi.fn(async () => undefined),
}));

vi.mock('../src/ingestion/fifa/teamMatchStatsComplete', () => ({
  loadTeamMatchStatsCompleteness: vi.fn(async () => ({ complete: true })),
}));

function matchRefDb(status: string) {
  return createMockDb({
    first: (sql, binds) => {
      if (sql.includes('FROM matches m')) {
        return { ...FIXTURE_MATCH, slug: FIXTURE_MATCH.id, status };
      }
      if (sql.includes('FROM teams WHERE id')) {
        return binds[0] === FIXTURE_MATCH.home_team_id
          ? { id: FIXTURE_MATCH.home_team_id, name: 'Mexico' }
          : { id: FIXTURE_MATCH.away_team_id, name: 'South Africa' };
      }
      if (sql.includes('FROM match_recaps')) {
        return {
          summary_vi: 'Tóm tắt',
          summary_en: 'Summary',
          source_id: 'fifa',
          updated_at: '2026-06-12T00:00:00Z',
        };
      }
      if (sql.includes('SELECT 1 FROM match_recaps')) return { '1': 1 };
      if (sql.includes('FROM match_events')) {
        return { goals: 1, yellow_cards: 0, red_cards: 0, substitutions: 0 };
      }
      if (sql.includes('SELECT status, minute')) {
        return { status, minute: 55, home_score: 1, away_score: 0, updated_at: '2026-06-11T20:00:00Z' };
      }
      return null;
    },
    all: (sql) => {
      if (sql.includes('FROM team_match_stats')) {
        return {
          results: [
            {
              team_id: FIXTURE_MATCH.home_team_id,
              possession: 55,
              shots: 8,
              shots_on_target: 3,
              xg: 1.2,
              passes: 420,
              pass_accuracy: 0.85,
              created_at: '2026-06-11T20:00:00Z',
            },
            {
              team_id: FIXTURE_MATCH.away_team_id,
              possession: 45,
              shots: 4,
              shots_on_target: 1,
              xg: 0.6,
              passes: 310,
              pass_accuracy: 0.78,
              created_at: '2026-06-11T20:00:00Z',
            },
          ],
        };
      }
      if (sql.includes('FROM match_commentary') || sql.includes('FROM player_match_stats')) {
        return { results: [] };
      }
      return { results: [] };
    },
  });
}

describe('coverage branches — round 3 backend', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('getDb returns env.DB binding', () => {
    const db = createMockDb();
    expect(getDb(createMockEnv({ DB: db }))).toBe(db);
  });

  it('getMatchRecap evaluates shouldSyncFifaBlogAndStats when stats are complete', async () => {
    const { shouldSyncFifaBlogAndStats } = await import('../src/ingestion/fifa/fifaLiveBlogSync');
    const { syncFifaMatchByRef } = await import('../src/ingestion/fifa/fifaLiveSync');
    const { loadTeamMatchStatsCompleteness } = await import('../src/ingestion/fifa/teamMatchStatsComplete');
    vi.mocked(loadTeamMatchStatsCompleteness).mockResolvedValueOnce({ complete: true });
    vi.mocked(shouldSyncFifaBlogAndStats).mockResolvedValueOnce(true);

    const env = createMockEnv({
      DB: matchRefDb('completed'),
      KV: createMockKv({
        [`cache:match-ref:${FIXTURE_MATCH.id}`]: JSON.stringify({
          ...FIXTURE_MATCH,
          slug: FIXTURE_MATCH.id,
          status: 'completed',
        }),
      }),
      FIFA_LIVE_ENABLED: 'true',
    });
    await getMatchRecap(env, FIXTURE_MATCH.id);
    expect(shouldSyncFifaBlogAndStats).toHaveBeenCalled();
    expect(syncFifaMatchByRef).toHaveBeenCalled();
  });

  it('getMatchStats evaluates shouldSyncFifaBlogAndStats and ESPN data source label', async () => {
    const { shouldSyncFifaBlogAndStats } = await import('../src/ingestion/fifa/fifaLiveBlogSync');
    const { loadTeamMatchStatsCompleteness } = await import('../src/ingestion/fifa/teamMatchStatsComplete');
    vi.mocked(loadTeamMatchStatsCompleteness).mockResolvedValueOnce({ complete: true });
    vi.mocked(shouldSyncFifaBlogAndStats).mockResolvedValueOnce(true);

    const env = createMockEnv({
      DB: createMockDb({
        first: (sql, binds) => {
          if (sql.includes('FROM matches m')) {
            return { ...FIXTURE_MATCH, slug: FIXTURE_MATCH.id, status: 'live' };
          }
          if (sql.includes('FROM teams WHERE id')) {
            return binds[0] === FIXTURE_MATCH.home_team_id
              ? { id: FIXTURE_MATCH.home_team_id, name: 'Mexico' }
              : { id: FIXTURE_MATCH.away_team_id, name: 'South Africa' };
          }
          if (sql.includes('SELECT 1 FROM match_recaps')) return null;
          if (sql.includes('FROM match_events')) {
            return { goals: 1, yellow_cards: 0, red_cards: 0, substitutions: 0 };
          }
          if (sql.includes('SELECT status, minute')) {
            return { status: 'live', minute: 55, home_score: 1, away_score: 0, updated_at: '2026-06-11T20:00:00Z' };
          }
          return null;
        },
        all: (sql) => {
          if (sql.includes('FROM team_match_stats')) {
            return {
              results: [
                {
                  team_id: FIXTURE_MATCH.home_team_id,
                  possession: 55,
                  shots: 8,
                  shots_on_target: 3,
                  xg: 1.2,
                  passes: 420,
                  pass_accuracy: 0.85,
                  created_at: '2026-06-11T20:00:00Z',
                },
                {
                  team_id: FIXTURE_MATCH.away_team_id,
                  possession: 45,
                  shots: 4,
                  shots_on_target: 1,
                  xg: 0.6,
                  passes: 310,
                  pass_accuracy: 0.78,
                  created_at: '2026-06-11T20:00:00Z',
                },
              ],
            };
          }
          return { results: [] };
        },
      }),
      KV: createMockKv({
        [`cache:match-ref:${FIXTURE_MATCH.id}`]: JSON.stringify({
          ...FIXTURE_MATCH,
          slug: FIXTURE_MATCH.id,
          status: 'live',
        }),
      }),
      FIFA_LIVE_ENABLED: 'true',
    });
    const payload = await getMatchStats(env, FIXTURE_MATCH.id);
    expect(shouldSyncFifaBlogAndStats).toHaveBeenCalled();
    expect(payload?.dataSourceLabel).toBe('FIFA Match Centre / ESPN');
  });

  it('getMatchStats uses FIFA-only label when passes are zero', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        first: (sql, binds) => {
          if (sql.includes('FROM matches m')) {
            return { ...FIXTURE_MATCH, slug: FIXTURE_MATCH.id, status: 'completed' };
          }
          if (sql.includes('FROM teams WHERE id')) {
            return binds[0] === FIXTURE_MATCH.home_team_id
              ? { id: FIXTURE_MATCH.home_team_id, name: 'Mexico' }
              : { id: FIXTURE_MATCH.away_team_id, name: 'South Africa' };
          }
          if (sql.includes('SELECT 1 FROM match_recaps')) return null;
          if (sql.includes('FROM match_events')) {
            return { goals: 0, yellow_cards: 0, red_cards: 0, substitutions: 0 };
          }
          if (sql.includes('SELECT status, minute')) {
            return { status: 'completed', minute: 90, home_score: 0, away_score: 0, updated_at: '2026-06-12T00:00:00Z' };
          }
          return null;
        },
        all: (sql) => {
          if (sql.includes('FROM team_match_stats')) {
            return {
              results: [
                {
                  team_id: FIXTURE_MATCH.home_team_id,
                  possession: 0,
                  shots: 2,
                  shots_on_target: 1,
                  xg: 0.3,
                  passes: 0,
                  pass_accuracy: null,
                  created_at: '2026-06-12T00:00:00Z',
                },
              ],
            };
          }
          return { results: [] };
        },
      }),
      KV: createMockKv({
        [`cache:match-ref:${FIXTURE_MATCH.id}`]: JSON.stringify({
          ...FIXTURE_MATCH,
          slug: FIXTURE_MATCH.id,
          status: 'completed',
        }),
      }),
      MOCK_SOURCES: 'true',
    });
    const payload = await getMatchStats(env, FIXTURE_MATCH.id);
    expect(payload?.dataSourceLabel).toBe('FIFA Match Centre');
  });

  it('newsScoring handles invalid dates and guardian URLs', () => {
    expect(computeHotScore('not-a-date', 0.7)).toBeCloseTo(0.42, 1);
    expect(mediumThumbnailUrl('https://www.theguardian.com/football/article')).toContain('width=460');
    expect(mediumThumbnailUrl('not-a-valid-url')).toBe('not-a-valid-url');
    expect(mediumThumbnailUrl(null)).toBeNull();
    expect(mediumThumbnailUrl('  ')).toBeNull();
  });

  it('newsImageUrls normalizes links and feed images with fallbacks', () => {
    expect(normalizeArticleLink('https://example.com/a?x=1#frag')).toBe('https://example.com/a');
    expect(normalizeArticleLink('not-a-url?x=1#y')).toBe('not-a-url');
    expect(normalizeFeedImageUrl(null)).toBeNull();
    expect(normalizeFeedImageUrl('not-a-url')).toBe('not-a-url');
    expect(
      normalizeFeedImageUrl('https://ichef.bbci.co.uk/ace/standard/976/cpsprodpb/x.jpg'),
    ).toContain('/standard/240/');
  });

  it('validateScenarioSet catches validation errors and prohibited phrases', () => {
    const baseline = mockScenario({ isBaseline: true });
    expect(validateScenarioSet([baseline])).toContain('At least two scenarios required.');
    expect(
      validateScenarioSet([
        { ...baseline, id: 's2', isBaseline: false },
        { ...baseline, id: 's3', isBaseline: false },
      ]),
    ).toContain('Baseline scenario missing.');
    const badProb = mockScenario({
      scenarioProbability: 1.5,
      scenarioName: 'sure bet winner',
    });
    const errors = validateScenarioSet([baseline, badProb]);
    expect(errors.some((e) => e.includes('probability out of range'))).toBe(true);
    expect(errors.some((e) => e.includes('Prohibited phrase'))).toBe(true);
    expect(() => assertValidScenarioSet([baseline])).toThrow();
  });

  it('explainScenarioPrediction covers missing-input branch', async () => {
    const scenario = mockScenario({
      keyDrivers: [],
      featureSelection: { ...mockScenario().featureSelection, missingInputs: ['lineup'] },
    });
    const result = await explainScenarioPrediction(createMockEnv(), FIXTURE_MATCH.id, scenario);
    expect(result.uncertaintyNotes.some((n) => n.includes('Missing inputs'))).toBe(true);
  });

  it('runBacktest handles draw, away win, and empty snapshot sets', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        all: () => ({
          results: [
            { id: 'm-draw', home_score: 1, away_score: 1, year: 2022 },
            { id: 'm-away', home_score: 0, away_score: 2, year: 2018 },
          ],
        }),
        first: (sql, binds) => {
          if (binds?.[0] === 'm-draw') {
            return { home_win_prob: 0.4, draw_prob: 0.3, away_win_prob: 0.3 };
          }
          if (binds?.[0] === 'm-away') {
            return { home_win_prob: 0.5, draw_prob: 0.25, away_win_prob: 0.25 };
          }
          return null;
        },
        run: () => ({ success: true }),
      }),
    });
    const metrics = await runBacktest(env.DB);
    expect(metrics.matchCount).toBe(2);
    expect(metrics.brierScore).not.toBeNull();

    const empty = createMockEnv({
      DB: createMockDb({
        all: () => ({ results: [] }),
        run: () => ({ success: true }),
      }),
    });
    const emptyMetrics = await runBacktest(empty.DB);
    expect(emptyMetrics.matchCount).toBe(0);
    expect(emptyMetrics.brierScore).toBeNull();
  });

  it('mirrorCoord flips away-side coordinates', () => {
    expect(mirrorCoord({ x: 0.2, y: 0.5 }, 'home')).toEqual({ x: 0.2, y: 0.5 });
    expect(mirrorCoord({ x: 0.2, y: 0.5 }, 'away')).toEqual({ x: 0.8, y: 0.5 });
  });
});
