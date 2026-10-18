import React, { type ReactElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockDb, createMockEnv, createMockKv } from './helpers/mockEnv';
import { FIXTURE_MATCH, FIXTURE_SNAPSHOT, FIXTURE_TEAMS } from './helpers/fixtures';
import { mockScenarioContext } from './helpers/scenarioFixtures';
import { selectScenarioFeatures } from '../src/models/scenarios/scenarioFeatureSelector';
import { runScenarioProbabilityModel } from '../src/models/scenarios/scenarioEngine';
import {
  buildCandidateScenarios,
  ensureAtLeastTwoScenarios,
} from '../src/models/scenarios/scenarioGenerator';
import {
  conditionLabel,
  scenarioStatusLabel,
  thresholdLabel,
  translateComparisonSummary,
  translateComparisonDifference,
} from '../app/lib/i18n/scenarioPredictionLabels';
import { mockScenario } from './helpers/scenarioFixtures';
import { sortStandingRows, buildGroupStandingsPayload } from '../src/services/tournamentStandings';
import { getLineupDisplayForMatch } from '../src/services/lineupDisplay';
import { getMatchPreviewAnalysis } from '../src/services/matchPreviewAnalysis';
import { classifyNewsImpact, processNewsDocumentImpact } from '../src/services/newsMatchImpact';
import {
  aggregateMovement,
  applySubstitutions,
  computePlayerRating,
  getPitchMapPayload,
} from '../src/services/pitchMap';
import { assignFormationCoords } from '../src/lib/formationLayout';
import { gameStateModifier } from '../src/models/probability/liveGameState';
import { applyRealtimeEventToScenarios } from '../src/models/scenarios/scenarioRealtimeUpdater';
import { compareScenarios } from '../src/models/scenarios/scenarioComparison';
import { buildLineupFeaturesFromPlayers } from '../src/services/lineupFeatures';
import { normalizeMarketProbabilities } from '../src/market/calculations/normalizeOverround';
import { explainScenarioPrediction } from '../src/ai/explainScenarioPrediction';
import { resolveTeamFlagSlug } from '../app/lib/nationFlags';
import { normalizeLineupPosition } from '../src/services/lineupDisplay';
import { ensureMatchLineups } from '../src/services/lineupDisplay';
import { getMatchStats } from '../src/services/matchStats';
import { getMatchRecap } from '../src/services/matchRecap';
import {
  getProbabilityMovement,
  getTeamSystemPayload,
  mapTeamSystemRow,
} from '../src/services/matchIntelligence';
import { validateScenarioSet } from '../src/models/scenarios/scenarioValidation';
import { jsonRoute } from './helpers/routeHarness';
import { createRouteTestEnv } from './helpers/mockRouteDb';
import { I18nProvider } from '../app/lib/i18n/I18nContext';
import { api } from '../app/lib/api';
import { MatchAnalyticsPanel } from '../app/components/match/MatchAnalyticsPanel';
import { MatchLineupSidePanel } from '../app/components/match/MatchLineupSidePanel';
import { MatchLiveStatsPanel } from '../app/components/match/MatchLiveStatsPanel';
import { PitchMap } from '../app/components/tactical/PitchMap';
import { appendFeedEvent, getLatestFeedCursor, queryFeed } from '../src/services/publicApi/feed';
import {
  backfillNewsThumbnails,
  imageUrlFromRaw,
  recompressNewsThumbnails,
  resolveNewsThumbSourceUrl,
} from '../src/services/newsThumbnailBackfill';
import { buildModelVsMarket } from '../src/market/services/marketSignalService';
import { refereeToFeatures } from '../src/services/matchStaff';
import * as marketRepo from '../src/db/repositories/marketRepo';
import * as probabilityRepo from '../src/db/repositories/probabilityRepo';

function renderWithAppProviders(ui: ReactElement) {
  return render(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(I18nProvider, null, ui),
    ),
  );
}

vi.mock('../src/ingestion/fifa/fifaLineupSync', () => ({
  syncFifaMatchLineupsByRef: vi.fn(async () => undefined),
}));
vi.mock('../src/services/officialLineupSync', () => ({
  syncOfficialSquadToMatch: vi.fn(async () => undefined),
}));
vi.mock('../src/services/matchGroupContext', () => ({
  getGroupContextForMatch: vi.fn(async () => ({ fixtures: [] })),
}));
vi.mock('../src/services/matchHistory', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/matchHistory')>();
  return {
    ...actual,
    getHeadToHead: vi.fn(async () => ({
      summary: { recentFormHome: 'W', recentFormAway: 'L', totalMatches: 1 },
    })),
    getWorldCupHeadToHeadBetween: vi.fn(async () => []),
  };
});
vi.mock('../src/services/recomputeMatch', () => ({
  recomputeMatchProbability: vi.fn(async () => null),
}));
vi.mock('../src/ai/gatewayClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/ai/gatewayClient')>();
  return { ...actual, isGatewayConfigured: vi.fn(() => false), gatewayChatJson: vi.fn() };
});
vi.mock('../src/db/repositories/teamsRepo', () => ({
  getTeamsByTournament: vi.fn(async () => [
    { id: 'team-usa', name: 'United States', short_name: 'USA', country_code: 'US' },
    { id: 'team-mex', name: 'Mexico', short_name: 'MEX', country_code: 'MX' },
  ]),
  getTeam: vi.fn(async (_db, id: string) => ({
    id,
    name: id.includes('usa') ? 'United States' : 'Mexico',
    short_name: id.includes('usa') ? 'USA' : 'MEX',
    country_code: id.includes('usa') ? 'US' : 'MX',
    elo_rating: 1800,
    fifa_ranking: 12,
    collective_strength_rating: 0.8,
  })),
}));
vi.mock('../src/ai/translateNews', () => ({
  translateNewsHeadline: vi.fn(async () => null),
}));
vi.mock('../src/services/newsImagePipeline', () => ({
  compressAndStoreNewsImage: vi.fn(async () => null),
  newsAssetPublicPath: vi.fn((id: string) => `/news/${id}.webp`),
  newsThumbnailR2Key: vi.fn((id: string) => `news/thumbs/${id}.webp`),
  thumbNeedsRecompress: vi.fn((_contentType: string | undefined, size: number | undefined) => size != null && size > 40_000),
}));
vi.mock('../src/services/newsSourceBackfill', () => ({
  registerNewsFeedSource: vi.fn(async () => 'source-1'),
}));
vi.mock('../src/db/repositories/lineupsRepo', () => ({
  getMatchLineupRow: vi.fn(async () => null),
  upsertMatchLineup: vi.fn(async () => undefined),
}));

describe('coverage final — remaining line gaps (backend)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('tournamentStandings — gf tiebreaker and third-place payload', async () => {
    const ranked = sortStandingRows([
      {
        teamId: 'a',
        teamName: 'Alpha',
        shortName: null,
        rank: 0,
        played: 2,
        points: 4,
        gf: 5,
        ga: 2,
        gd: 3,
      },
      {
        teamId: 'b',
        teamName: 'Beta',
        shortName: null,
        rank: 0,
        played: 2,
        points: 4,
        gf: 3,
        ga: 1,
        gd: 2,
      },
      {
        teamId: 'c',
        teamName: 'Charlie',
        shortName: null,
        rank: 0,
        played: 2,
        points: 4,
        gf: 3,
        ga: 1,
        gd: 2,
      },
      {
        teamId: 'd',
        teamName: 'Delta',
        shortName: null,
        rank: 0,
        played: 2,
        points: 0,
        gf: 0,
        ga: 4,
        gd: -4,
      },
    ]);
    expect(ranked[0]?.teamId).toBe('a');

    const env = createMockEnv({
      DB: createMockDb({
        all: (sql) => {
          if (sql.includes("stage = 'Group'") && sql.includes('home_team_id')) {
            return {
              results: [
                {
                  group_code: 'A',
                  home_team_id: 'team-usa',
                  away_team_id: 'team-mex',
                  home_score: 2,
                  away_score: 1,
                  status: 'completed',
                },
              ],
            };
          }
          if (sql.includes('GROUP BY group_code')) {
            return { results: [{ group_code: 'A', total: 1, done: 1 }] };
          }
          if (sql.includes('FROM teams WHERE id LIKE')) {
            return {
              results: [
                { id: 'team-usa', name: 'USA', short_name: 'USA', country_code: 'US' },
                { id: 'team-mex', name: 'Mexico', short_name: 'MEX', country_code: 'MX' },
              ],
            };
          }
          return { results: [] };
        },
      }),
    });
    const payload = await buildGroupStandingsPayload(env);
    expect(payload.thirdPlaceRanking.length).toBeGreaterThanOrEqual(0);
    expect(payload.groups.A?.rows.length).toBeGreaterThan(0);
  });

  it('tournamentStandings — third-place ranking falls back to team id when stats are tied', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        all: (sql) => {
          if (sql.includes("stage = 'Group'") && sql.includes('home_team_id')) {
            return {
              results: [
                { group_code: 'A', home_team_id: 'a1', away_team_id: 'a2', home_score: 1, away_score: 0, status: 'completed' },
                { group_code: 'A', home_team_id: 'a3', away_team_id: 'a1', home_score: 1, away_score: 0, status: 'completed' },
                { group_code: 'A', home_team_id: 'a2', away_team_id: 'a3', home_score: 1, away_score: 0, status: 'completed' },
                { group_code: 'B', home_team_id: 'b1', away_team_id: 'b2', home_score: 1, away_score: 0, status: 'completed' },
                { group_code: 'B', home_team_id: 'b3', away_team_id: 'b1', home_score: 1, away_score: 0, status: 'completed' },
                { group_code: 'B', home_team_id: 'b2', away_team_id: 'b3', home_score: 1, away_score: 0, status: 'completed' },
              ],
            };
          }
          if (sql.includes('GROUP BY group_code')) {
            return {
              results: [
                { group_code: 'A', total: 3, done: 3 },
                { group_code: 'B', total: 3, done: 3 },
              ],
            };
          }
          if (sql.includes('FROM teams WHERE id LIKE')) {
            return {
              results: [
                { id: 'a1', name: 'Alpha 1', short_name: 'A1', country_code: 'AA' },
                { id: 'a2', name: 'Alpha 2', short_name: 'A2', country_code: 'AA' },
                { id: 'a3', name: 'Alpha 3', short_name: 'A3', country_code: 'AA' },
                { id: 'b1', name: 'Beta 1', short_name: 'B1', country_code: 'BB' },
                { id: 'b2', name: 'Beta 2', short_name: 'B2', country_code: 'BB' },
                { id: 'b3', name: 'Beta 3', short_name: 'B3', country_code: 'BB' },
              ],
            };
          }
          return { results: [] };
        },
      }),
    });

    const payload = await buildGroupStandingsPayload(env);
    expect(payload.thirdPlaceRanking.slice(0, 2).map((row) => row.teamId)).toEqual(['a3', 'b3']);
  });

  it('scenarioEngine — default branch, missing inputs, and trigger statuses', () => {
    const ctx = mockScenarioContext({
      minute: 20,
      homeScore: 1,
      awayScore: 0,
      homeSystem: { ...mockScenarioContext().homeSystem, transitionScore: 0.62, tempoScore: 0.6 },
      awaySystem: { ...mockScenarioContext().awaySystem, transitionScore: 0.4, tempoScore: 0.5 },
    });
    const selectionMissing = {
      ...selectScenarioFeatures('baseline_expected_flow', ctx),
      missingInputs: ['marketImplied'],
    };
    const baseline = runScenarioProbabilityModel('baseline_expected_flow', ctx, selectionMissing);
    expect(baseline.riskFactors[0]).toContain('Missing inputs');

    const surprise = runScenarioProbabilityModel(
      'lineup_surprise',
      ctx,
      selectScenarioFeatures('lineup_surprise', ctx),
    );
    expect(surprise.scenarioProbability).toBeGreaterThan(0);
    expect(surprise.triggerConditions.some((t) => t.status === 'partially_triggered' || t.status === 'not_triggered')).toBe(
      true,
    );
  });

  it('scenarioGenerator — knockout flags and ensureAtLeastTwoScenarios fallback slice', () => {
    const ctx = mockScenarioContext({
      stage: 'Quarter-final',
      probability: {
        ...mockScenarioContext().probability,
        expectedHomeGoals: 3.0,
        expectedAwayGoals: 1.2,
        drawProb: 0.4,
      },
      homeLineupSource: 'projected',
      awayLineupSource: 'official',
    });
    const candidates = buildCandidateScenarios(ctx);
    expect(candidates.some((c) => c.scenarioType === 'penalty_shootout_path')).toBe(true);
    expect(candidates.some((c) => c.scenarioType === 'high_event_open_match')).toBe(true);

    const baselineOnly = {
      scenarioType: 'baseline_expected_flow' as const,
      scenarioName: 'Baseline',
      isBaseline: true,
      weight: 1,
      featureSelection: selectScenarioFeatures('baseline_expected_flow', ctx),
      output: runScenarioProbabilityModel(
        'baseline_expected_flow',
        ctx,
        selectScenarioFeatures('baseline_expected_flow', ctx),
      ),
    };
    const fallback = ensureAtLeastTwoScenarios([baselineOnly], ctx);
    expect(fallback.length).toBeGreaterThanOrEqual(2);
  });

  it('scenarioPredictionLabels — unknown keys and comparison translations', () => {
    expect(conditionLabel('Unknown condition key', 'en')).toBe('Unknown condition key');
    expect(thresholdLabel('custom-threshold', 'vi')).toBe('custom-threshold');
    expect(scenarioStatusLabel('custom_status', 'en')).toBe('custom_status');

    const scenarios = [mockScenario(), mockScenario({ id: 'alt', isBaseline: false, scenarioType: 'transition_dominance' })];
    const viSummary = translateComparisonSummary(
      'The baseline scenario remains more likely, but upset path materially shifts the away win path.',
      scenarios,
      'vi',
      'USA',
      '',
    );
    expect(viSummary).toContain('đội khách');

    const balanced = translateComparisonSummary(
      'Scenario likelihood is tightly balanced between baseline and alternative.',
      scenarios,
      'vi',
      'USA',
      'Mexico',
    );
    expect(balanced).toContain('cân bằng');

    expect(
      translateComparisonDifference('Home win delta: 3.5 pp', 'vi', 'USA', 'Mexico'),
    ).toContain('USA');
  });

  it('lineupDisplay — role-only position, unknown source, and empty fallback', async () => {
    expect(normalizeLineupPosition(null, 'DM', null)).toBe('DM');

    const unknownSourceEnv = createMockEnv({
      DB: createMockDb({
        first: (sql) => {
          if (sql.includes('FROM lineups l')) {
            return {
              id: 'lu-unk',
              formation: '4-3-3',
              is_official: 0,
              source_type: 'legacy_feed',
              confidence: 0.5,
            };
          }
          return null;
        },
        all: (sql) => {
          if (sql.includes('FROM lineup_players')) {
            return {
              results: Array.from({ length: 11 }, (_, i) => ({
                shirt_number: i + 1,
                name: `P${i}`,
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
    const unknown = await getLineupDisplayForMatch(
      unknownSourceEnv,
      FIXTURE_MATCH.id,
      FIXTURE_MATCH.home_team_id,
    );
    expect(unknown.source).toBe('unknown');

    const emptyEnv = createMockEnv({
      DB: createMockDb({ first: () => null, all: () => ({ results: [] }) }),
    });
    const empty = await getLineupDisplayForMatch(emptyEnv, 'm-none', 'team-unknown');
    expect(empty.players).toHaveLength(0);
    expect(empty.source).toBe('unknown');
  });

  it('matchPreviewAnalysis — invalid scoreline JSON and strength tiers', async () => {
    const env = createMockEnv({
      KV: createMockKv(),
      DB: createMockDb({
        first: (sql, binds) => {
          if (sql.includes('FROM matches WHERE id')) return FIXTURE_MATCH;
          if (sql.includes('FROM teams WHERE id')) {
            return binds[0] === FIXTURE_TEAMS[0].id ? FIXTURE_TEAMS[0] : FIXTURE_TEAMS[1];
          }
          if (sql.includes('FROM probability_snapshots')) {
            return { ...FIXTURE_SNAPSHOT, scoreline_json: '{bad', explanation_json: null };
          }
          if (sql.includes('FROM lineups l')) return null;
          return null;
        },
        all: () => ({ results: [] }),
      }),
    });
    const preview = await getMatchPreviewAnalysis(env, FIXTURE_MATCH.id);
    expect(preview.home.teamName).toBeTruthy();
    expect(preview.away.teamName).toBeTruthy();
  });

  it('newsMatchImpact — medium from formations and entity team resolution', async () => {
    expect(
      classifyNewsImpact('Tactical preview', {
        teams: ['United States', 'Mexico'],
        players: [],
        injuries: [],
        tacticalNotes: ['High press'],
        formations: [],
      }),
    ).toBe('medium');

    expect(
      classifyNewsImpact('Squad news', {
        teams: ['United States', 'Mexico'],
        players: [],
        injuries: [],
        tacticalNotes: [],
        formations: ['4-3-3'],
      }),
    ).toBe('medium');

    const env = createMockEnv({
      DB: createMockDb({
        all: (sql) => {
          if (sql.includes("GLOB 'team-w26-")) {
            return {
              results: [
                { id: 'team-usa', name: 'United States', short_name: 'USA', country_code: 'US' },
                { id: 'team-mex', name: 'Mexico', short_name: 'MEX', country_code: 'MX' },
              ],
            };
          }
          if (sql.includes('SELECT id FROM matches') && sql.includes('home_team_id IN')) {
            return { results: [{ id: FIXTURE_MATCH.id }] };
          }
          return { results: [] };
        },
        first: () => null,
        run: () => ({ success: true, meta: { changes: 1 } }),
      }),
      MODEL_QUEUE: { send: vi.fn(async () => undefined) } as never,
    });
    const impact = await processNewsDocumentImpact(
      env,
      'doc-entity',
      'United States tactical shift',
      { teams: ['United States'], players: [], injuries: [], tacticalNotes: [], formations: [] },
    );
    expect(impact.matchIds.length).toBeGreaterThan(0);
  });

  it('pitchMap — rating edge cases, sub in-only, movement skip', async () => {
    const low = computePlayerRating({
      player_id: 'p',
      team_id: 't',
      minutes_played: 10,
      goals: 0,
      assists: 0,
      shots: 0,
      shots_on_target: 0,
      xg: 0,
      passes: 5,
      pass_accuracy: 50,
      yellow_cards: 2,
      red_cards: 1,
    });
    expect(low).toBeLessThan(6);

    const onPitch = new Set(['a']);
    const marks = applySubstitutions(
      new Set(['a']),
      onPitch,
      [{ minute: 70, player_id: 'b', related_player_id: null, team_id: 't1' }],
      90,
    );
    expect(onPitch.has('b')).toBe(true);
    expect(marks.get('b')?.subType).toBe('in');

    expect(
      aggregateMovement([
        { player_id: 'p1', team_id: 't', x: 0.1, y: 0.2, end_x: null, end_y: null },
      ]).size,
    ).toBe(0);

    const payload = await getPitchMapPayload(
      createMockEnv({
        DB: createMockDb({
          first: (sql) => {
            if (sql.includes('FROM matches m')) {
              return { ...FIXTURE_MATCH, status: 'scheduled', minute: 0, slug: FIXTURE_MATCH.id };
            }
            if (sql.includes('SELECT name FROM teams')) return { name: 'Team' };
            return null;
          },
          all: (sql) => {
            if (sql.includes('FROM lineups l')) return { results: [] };
            return { results: [] };
          },
        }),
      }),
      FIXTURE_MATCH.id,
    );
    expect(payload).toBeNull();
  });

  it('misc backend line gaps', async () => {
    expect(gameStateModifier(80, 0, 2)).toEqual(
      expect.objectContaining({ home: expect.any(Number), away: expect.any(Number) }),
    );

    const ctx = mockScenarioContext({ minute: 55, homeScore: 1, awayScore: 1 });
    const scenarios = [mockScenario(), mockScenario({ id: 'alt-2', isBaseline: false })];
    const rt = applyRealtimeEventToScenarios(ctx, scenarios, {
      matchId: 'm-1',
      eventId: 'e1',
      eventType: 'goal',
      minute: 55,
    });
    expect(rt.scenarios.length).toBeGreaterThan(0);

    const comparison = compareScenarios(scenarios);
    expect(comparison.summary.length).toBeGreaterThan(10);

    const lineupFeatures = buildLineupFeaturesFromPlayers(
      '4-3-3',
      Array.from({ length: 11 }, (_, i) => ({
        is_starter: 1,
        position_slot: i === 0 ? 'GK' : 'CM',
        role: null,
      })),
      true,
    );
    expect(lineupFeatures?.formation).toBe('4-3-3');

    expect(() => normalizeMarketProbabilities({ home: 0, draw: 0, away: 0 })).toThrow();

    const explained = await explainScenarioPrediction(createMockEnv(), 'm-1', {
      ...scenarios[0]!,
      featureSelection: { ...scenarios[0]!.featureSelection, missingInputs: ['marketImplied'] },
    });
    expect(explained.uncertaintyNotes[1]).toContain('Missing inputs');

    expect(resolveTeamFlagSlug({ countryCode: 'GB', teamName: 'Scotland' })).toBe('gb-sct');
    expect(resolveTeamFlagSlug({ countryCode: null, teamName: 'England' })).toBe('gb-eng');

    const fourBack = assignFormationCoords('4-2-3-1', [{ playerId: 'd1', position: 'CB' }], 'home');
    expect(fourBack.get('d1')).toBeTruthy();
  });
});

describe('coverage final — branch-heavy modules', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('matchPreviewAnalysis — lineup source labels and AI path branches', async () => {
    const lineupId = 'lu-br';
    const makeEnv = (lineupSource: string, players: number, gateway = false) =>
      createMockEnv({
        KV: createMockKv(),
        AI_GATEWAY_ENABLED: gateway ? 'true' : 'false',
        AI_GATEWAY_ACCOUNT_ID: gateway ? 'acct' : undefined,
        OPENAI_API_KEY: gateway ? 'sk' : undefined,
        DB: createMockDb({
          first: (sql, binds) => {
            if (sql.includes('FROM matches WHERE id')) {
              return { ...FIXTURE_MATCH, stage: 'Round of 16', group_code: null };
            }
            if (sql.includes('FROM teams WHERE id')) {
              return binds[0] === FIXTURE_TEAMS[0].id
                ? { ...FIXTURE_TEAMS[0], collective_strength_rating: 0.9 }
                : { ...FIXTURE_TEAMS[1], collective_strength_rating: 0.55 };
            }
            if (sql.includes('FROM probability_snapshots')) return FIXTURE_SNAPSHOT;
            if (sql.includes('FROM lineups l')) {
              return {
                id: lineupId,
                formation: '4-3-3',
                is_official: lineupSource === 'match_official' ? 1 : 0,
                source_type: lineupSource,
                confidence: 0.8,
              };
            }
            return null;
          },
          all: (sql) => {
            if (sql.includes('FROM lineup_players')) {
              return {
                results: Array.from({ length: players }, (_, i) => ({
                  shirt_number: i + 1,
                  name: `P${i}`,
                  position_slot: 'CM',
                  role: null,
                  position: 'CM',
                  is_starter: 1,
                })),
              };
            }
            if (sql.includes('FROM squad_players')) return { results: [] };
            if (sql.includes('FROM players WHERE primary_team_id')) return { results: [] };
            return { results: [] };
          },
        }),
      });

    const projected = await getMatchPreviewAnalysis(
      makeEnv('projected', 11),
      FIXTURE_MATCH.id,
    );
    expect(projected.home.lineupSource).toBe('projected');

    const squad = await getMatchPreviewAnalysis(makeEnv('squad_official', 11), FIXTURE_MATCH.id);
    expect(squad.home.lineupSource).toBe('squad');

    const pendingEnv = makeEnv('projected', 0);
    const pending = await getMatchPreviewAnalysis(pendingEnv, FIXTURE_MATCH.id);
    expect(pending.home.lineupSource).toBe('projected');
    expect(pending.home.fullLineup.length).toBeGreaterThan(0);
  });

  it('fifaLiveSync — shouldSyncFifaMatch for live matches', async () => {
    const { shouldSyncFifaMatch } = await import('../src/ingestion/fifa/fifaLiveSync');
    const env = createMockEnv();
    expect(await shouldSyncFifaMatch(env, FIXTURE_MATCH.id, 'live')).toBe(true);
    expect(await shouldSyncFifaMatch(env, FIXTURE_MATCH.id, 'scheduled')).toBe(false);
  });
});

describe('coverage final — additional line and branch gaps', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('flags, timeline, team flags, and scenario paths', async () => {
    const { resolveTeamFlag, resolveTeamFlagSlug } = await import('../app/lib/nationFlags');
    const { resolveTeamFlagSlug: resolveSrcFlag } = await import('../src/lib/teamFlags');
    const { timelinePeriodLabel } = await import('../src/ingestion/fifa/parseFifaTimeline');

    expect(resolveTeamFlagSlug({ teamName: 'England' })).toBe('gb-eng');
    expect(resolveSrcFlag({ teamName: 'Scotland' })).toBe('gb-sct');
    expect(resolveTeamFlag({ countryCode: 'GB', teamName: 'Scotland' })).toBeTruthy();
    expect(resolveTeamFlag({ teamName: 'ZZ_Invalid_Nation_XYZ' })).toBe('');

    expect(timelinePeriodLabel(4)).toBe('HT');
    expect(timelinePeriodLabel(5)).toBe('2H');

    const ctx = mockScenarioContext({ stage: 'Semi-final' });
    const candidates = buildCandidateScenarios(ctx);
    expect(candidates.some((c) => c.scenarioType === 'extra_time_path')).toBe(true);

    const output = runScenarioProbabilityModel(
      'lineup_surprise',
      ctx,
      selectScenarioFeatures('lineup_surprise', ctx),
    );
    expect(output.scenarioProbability).toBeGreaterThan(0);
  });

  it('tournamentStandings compareStandings gf tie via third place', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        all: (sql) => {
          if (sql.includes("stage = 'Group'") && sql.includes('home_team_id')) {
            return {
              results: [
                {
                  group_code: 'A',
                  home_team_id: 'team-a1',
                  away_team_id: 'team-a2',
                  home_score: 1,
                  away_score: 0,
                  status: 'completed',
                },
                {
                  group_code: 'A',
                  home_team_id: 'team-a3',
                  away_team_id: 'team-a4',
                  home_score: 1,
                  away_score: 0,
                  status: 'completed',
                },
                {
                  group_code: 'B',
                  home_team_id: 'team-b1',
                  away_team_id: 'team-b2',
                  home_score: 2,
                  away_score: 2,
                  status: 'completed',
                },
              ],
            };
          }
          if (sql.includes('GROUP BY group_code')) {
            return {
              results: [
                { group_code: 'A', total: 2, done: 2 },
                { group_code: 'B', total: 1, done: 1 },
              ],
            };
          }
          if (sql.includes('FROM teams WHERE id LIKE')) {
            return {
              results: [
                { id: 'team-a1', name: 'A1', short_name: 'A1', country_code: 'US' },
                { id: 'team-a2', name: 'A2', short_name: 'A2', country_code: 'MX' },
                { id: 'team-a3', name: 'A3', short_name: 'A3', country_code: 'CA' },
                { id: 'team-a4', name: 'A4', short_name: 'A4', country_code: 'BR' },
                { id: 'team-b1', name: 'B1', short_name: 'B1', country_code: 'GB' },
                { id: 'team-b2', name: 'B2', short_name: 'B2', country_code: 'FR' },
              ],
            };
          }
          return { results: [] };
        },
      }),
    });
    const payload = await buildGroupStandingsPayload(env);
    expect(payload.thirdPlaceRanking.length).toBeGreaterThan(0);
  });

  it('pitchMap loadLineupRows via full payload', async () => {
    const homePlayers = Array.from({ length: 11 }, (_, i) => `p-h${i}`);
    const awayPlayers = Array.from({ length: 11 }, (_, i) => `p-a${i}`);
    const env = createMockEnv({
      DB: createMockDb({
        first: (sql) => {
          if (sql.includes('FROM matches m')) {
            return {
              ...FIXTURE_MATCH,
              status: 'live',
              minute: 70,
              slug: FIXTURE_MATCH.id,
              home_name: 'Mexico',
              away_name: 'South Africa',
            };
          }
          if (sql.includes('SELECT name FROM teams')) {
            return { name: 'Mexico' };
          }
          return null;
        },
        all: (sql) => {
          if (sql.includes('FROM lineups l')) {
            const row = (teamId: string, teamName: string, pid: string, i: number, starter: number) => ({
              lineup_id: `lu-${teamId}`,
              team_id: teamId,
              team_name: teamName,
              formation: '4-3-3',
              source_type: 'match_official',
              player_id: pid,
              player_name: `Player ${pid}`,
              shirt_number: i + 1,
              position_slot: i === 0 ? 'GK' : 'CM',
              role: null,
              player_position: null,
              is_starter: starter,
              x: 0.2,
              y: 0.5,
            });
            return {
              results: [
                ...homePlayers.map((id, i) => row(FIXTURE_MATCH.home_team_id, 'Mexico', id, i, 1)),
                ...awayPlayers.map((id, i) => row(FIXTURE_MATCH.away_team_id, 'South Africa', id, i, 1)),
              ],
            };
          }
          if (sql.includes("event_type = 'substitution'")) {
            return {
              results: [
                {
                  minute: 60,
                  player_id: 'p-h-sub',
                  related_player_id: 'p-h10',
                  team_id: FIXTURE_MATCH.home_team_id,
                },
              ],
            };
          }
          if (sql.includes('FROM player_match_stats')) {
            return { results: [] };
          }
          if (sql.includes('FROM player_movement')) {
            return {
              results: [
                {
                  player_id: 'p-h0',
                  team_id: FIXTURE_MATCH.home_team_id,
                  x: 0.2,
                  y: 0.5,
                  end_x: 0.3,
                  end_y: 0.5,
                },
              ],
            };
          }
          return { results: [] };
        },
      }),
    });
    const payload = await getPitchMapPayload(env, FIXTURE_MATCH.id);
    expect(payload?.home.players.length).toBeGreaterThan(0);
  });

  it('newsPublish, officialLineupSync, and scenario comparison', async () => {
    const publishEnv = createMockEnv({
      DB: createMockDb({
        first: () => null,
        run: () => ({ success: true, meta: { changes: 1 } }),
      }),
      R2_RAW: { put: vi.fn(async () => undefined) } as never,
    });
    const { publishNewsArticle } = await import('../src/services/newsPublish');
    const docId = await publishNewsArticle(
      publishEnv,
      { id: 'feed-1', name: 'Feed', url: 'https://example.com/rss' },
      {
        title: 'Breaking',
        link: 'https://example.com/a1',
        description: 'Story body',
        pubDate: '2026-01-01',
        imageUrl: 'https://example.com/img.jpg',
      },
    );
    expect(docId).toBeTruthy();

    const scenarios = [
      mockScenario({ id: 's1', scenarioProbability: 0.5, isBaseline: true }),
      mockScenario({ id: 's2', scenarioProbability: 0.35, isBaseline: false, scenarioName: 'Alt path' }),
    ];
    const comparison = compareScenarios(scenarios);
    expect(comparison.summary).toContain('baseline');
  });

  it('scenarioGenerator ensureAtLeastTwoScenarios slice fallback', () => {
    const ctx = mockScenarioContext();
    const lowOnly = {
      scenarioType: 'pressing_breakthrough' as const,
      scenarioName: 'Press',
      isBaseline: false,
      weight: 0.5,
      featureSelection: selectScenarioFeatures('pressing_breakthrough', ctx),
      output: {
        ...runScenarioProbabilityModel(
          'pressing_breakthrough',
          ctx,
          selectScenarioFeatures('pressing_breakthrough', ctx),
        ),
        scenarioConfidence: 0.1,
      },
    };
    const picked = ensureAtLeastTwoScenarios([lowOnly], ctx);
    expect(picked.length).toBeGreaterThanOrEqual(1);
  });

  it('matchPreviewAnalysis parseScorelineJson and newsMatchImpact entity alias', async () => {
    const env = createMockEnv({
      KV: createMockKv(),
      DB: createMockDb({
        first: (sql, binds) => {
          if (sql.includes('FROM matches WHERE id')) return FIXTURE_MATCH;
          if (sql.includes('FROM teams WHERE id')) {
            return binds[0] === FIXTURE_TEAMS[0].id ? FIXTURE_TEAMS[0] : FIXTURE_TEAMS[1];
          }
          if (sql.includes('FROM probability_snapshots')) {
            return { ...FIXTURE_SNAPSHOT, scoreline_json: '{}' };
          }
          if (sql.includes('FROM lineups l')) return null;
          return null;
        },
        all: () => ({ results: [] }),
      }),
    });
    const preview = await getMatchPreviewAnalysis(env, FIXTURE_MATCH.id);
    expect(preview.away.teamName).toBeTruthy();

    expect(
      classifyNewsImpact('Preview', {
        teams: ['Mexico'],
        players: [],
        injuries: [],
        tacticalNotes: ['High line'],
        formations: [],
      }),
    ).toBe('medium');
  });
});

describe('coverage final — targeted branch additions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('lineupDisplay covers club fallback defaults and skips official squad sync for match_official rows', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        first: (sql) => {
          if (sql.includes('FROM lineups l')) {
            return {
              id: 'lu-official-null-source',
              formation: '4-4-2',
              is_official: 1,
              source_type: null,
              confidence: 0.77,
            };
          }
          if (sql.includes('home_team_id, away_team_id')) {
            return {
              home_team_id: FIXTURE_MATCH.home_team_id,
              away_team_id: FIXTURE_MATCH.away_team_id,
            };
          }
          return null;
        },
        all: (sql) => {
          if (sql.includes('FROM lineup_players')) {
            return {
              results: Array.from({ length: 11 }, (_, i) => ({
                name: `Starter ${i + 1}`,
                shirt_number: i + 1,
                position_slot: i === 0 ? 'GK' : i < 5 ? 'CB' : i < 9 ? 'CM' : 'ST',
                role: null,
                position: null,
                is_starter: 1,
              })),
            };
          }
          if (sql.includes('FROM squad_players')) return { results: [] };
          if (sql.includes('FROM players WHERE primary_team_id')) {
            return {
              results: Array.from({ length: 13 }, (_, i) => ({
                name: `Club ${i + 1}`,
                position: null,
              })),
            };
          }
          return { results: [] };
        },
      }),
    });

    const official = await getLineupDisplayForMatch(env, FIXTURE_MATCH.id, FIXTURE_MATCH.home_team_id);
    expect(official.source).toBe('official');
    expect(official.hasAccurateLineup).toBe(true);

    const clubEnv = createMockEnv({
      DB: createMockDb({
        first: () => null,
        all: (sql) => {
          if (sql.includes('FROM squad_players')) return { results: [] };
          if (sql.includes('FROM players WHERE primary_team_id')) {
            return {
              results: Array.from({ length: 13 }, (_, i) => ({
                name: `Club ${i + 1}`,
                position: null,
              })),
            };
          }
          return { results: [] };
        },
      }),
    });
    const club = await getLineupDisplayForMatch(clubEnv, 'm-club', 'team-club');
    expect(club.starters[0]?.position).toBe('GK');
    expect(club.substitutes[0]?.position).toBe('CM');

    const { syncOfficialSquadToMatch } = await import('../src/services/officialLineupSync');
    const lineupsRepo = await import('../src/db/repositories/lineupsRepo');
    vi.mocked(syncOfficialSquadToMatch).mockClear();
    vi.mocked(lineupsRepo.getMatchLineupRow)
      .mockResolvedValueOnce({ source_type: 'match_official' } as never)
      .mockResolvedValueOnce({ source_type: 'projected' } as never);
    await ensureMatchLineups(env, FIXTURE_MATCH.id);
    expect(syncOfficialSquadToMatch).toHaveBeenCalledTimes(1);
    expect(syncOfficialSquadToMatch).toHaveBeenCalledWith(
      env,
      FIXTURE_MATCH.id,
      FIXTURE_MATCH.away_team_id,
    );
  });

  it('pitchMap covers computed coords, away substitutions, and hidden ratings before halftime', async () => {
    const homeIds = Array.from({ length: 11 }, (_, i) => `p-h${i + 1}`);
    const awayIds = Array.from({ length: 11 }, (_, i) => `p-a${i + 1}`);
    const row = (
      teamId: string,
      teamName: string,
      playerId: string,
      index: number,
      starter: number,
      x: number | null,
      y: number | null,
    ) => ({
      lineup_id: `lu-${teamId}`,
      team_id: teamId,
      team_name: teamName,
      formation: '4-3-3',
      source_type: 'match_official',
      player_id: playerId,
      player_name: `Player ${playerId}`,
      shirt_number: index + 1,
      position_slot: index === 0 ? 'GK' : index < 5 ? 'CB' : index < 8 ? 'CM' : 'ST',
      role: null,
      player_position: null,
      is_starter: starter,
      x,
      y,
    });
    const kv = createMockKv({
      [`cache:match-ref:${FIXTURE_MATCH.id}`]: JSON.stringify({
        ...FIXTURE_MATCH,
        slug: FIXTURE_MATCH.id,
        status: 'live',
        minute: 30,
      }),
    });
    const env = createMockEnv({
      KV: kv,
      MOCK_SOURCES: 'true',
      DB: createMockDb({
        first: (sql, binds) => {
          if (sql.includes('FROM matches m') && sql.includes('m.id = ?')) {
            return {
              ...FIXTURE_MATCH,
              slug: FIXTURE_MATCH.id,
              status: 'live',
              minute: 30,
              home_name: 'Mexico',
              away_name: 'South Africa',
            };
          }
          if (sql.includes('SELECT name FROM teams')) {
            return {
              name: binds[0] === FIXTURE_MATCH.home_team_id ? 'Mexico' : 'South Africa',
            };
          }
          return null;
        },
        all: (sql) => {
          if (sql.includes('FROM lineups l')) {
            return {
              results: [
                ...homeIds.map((id, i) =>
                  row(
                    FIXTURE_MATCH.home_team_id,
                    'Mexico',
                    id,
                    i,
                    1,
                    i === 0 ? null : 0.2 + i * 0.03,
                    i === 0 ? null : 0.5,
                  ),
                ),
                ...awayIds.map((id, i) =>
                  row(FIXTURE_MATCH.away_team_id, 'South Africa', id, i, 1, 0.75, 0.45),
                ),
                row(FIXTURE_MATCH.away_team_id, 'South Africa', 'p-a-sub', 11, 0, 0.8, 0.52),
              ],
            };
          }
          if (sql.includes("event_type = 'substitution'")) {
            return {
              results: [
                {
                  minute: 25,
                  player_id: 'p-a-sub',
                  related_player_id: 'p-a11',
                  team_id: FIXTURE_MATCH.away_team_id,
                },
              ],
            };
          }
          if (sql.includes('FROM player_match_stats')) {
            return {
              results: [
                {
                  player_id: 'p-a1',
                  team_id: FIXTURE_MATCH.away_team_id,
                  minutes_played: 30,
                  goals: 0,
                  assists: 0,
                  shots: 1,
                  shots_on_target: 0,
                  xg: 0.1,
                  passes: 10,
                  pass_accuracy: 80,
                  yellow_cards: 0,
                  red_cards: 0,
                },
              ],
            };
          }
          if (sql.includes('FROM match_events') && sql.includes('player_id IS NOT NULL')) {
            return { results: [] };
          }
          if (sql.includes('FROM match_events') && sql.includes('event_type')) {
            return { results: [] };
          }
          return { results: [] };
        },
      }),
    });

    const payload = await getPitchMapPayload(env, FIXTURE_MATCH.id);
    expect(payload?.showRatings).toBe(false);
    expect(payload?.home.players[0]?.x).toBeGreaterThan(0);
    expect(payload?.away.players.some((p) => p.playerId === 'p-a-sub')).toBe(true);
    expect(payload?.away.bench.some((p) => p.playerId === 'p-a11' && p.subType === 'out')).toBe(
      true,
    );
    expect(payload?.away.players.find((p) => p.playerId === 'p-a1')?.rating).toBeNull();
  });

  it('matchStats and matchRecap cover nullish fallbacks and commentary-only payloads', async () => {
    const statsEnv = createMockEnv({
      MOCK_SOURCES: 'true',
      DB: createMockDb({
        first: (sql) => {
          if (sql.includes('FROM matches m') && sql.includes('m.id = ?')) {
            return {
              ...FIXTURE_MATCH,
              slug: FIXTURE_MATCH.id,
              status: 'scheduled',
              minute: null,
              home_name: 'Mexico',
              away_name: 'South Africa',
            };
          }
          if (sql.includes('FROM teams WHERE id')) return null;
          if (sql.includes('SELECT 1 FROM match_recaps')) return null;
          if (sql.includes('FROM match_events WHERE match_id') && sql.includes('SUM(CASE')) return null;
          if (sql.includes('SELECT status, minute, home_score, away_score, updated_at FROM matches')) {
            return null;
          }
          return null;
        },
        all: (sql) => {
          if (sql.includes('FROM team_match_stats')) {
            return {
              results: [
                {
                  team_id: FIXTURE_MATCH.away_team_id,
                  possession: null,
                  shots: 4,
                  shots_on_target: null,
                  xg: null,
                  passes: null,
                  pass_accuracy: null,
                  created_at: null,
                },
              ],
            };
          }
          return { results: [] };
        },
      }),
    });
    const stats = await getMatchStats(statsEnv, FIXTURE_MATCH.id);
    expect(stats?.home.teamName).toBe('');
    expect(stats?.away.teamName).toBe('');
    expect(stats?.minute).toBeNull();
    expect(stats?.events).toEqual({ goals: 0, yellowCards: 0, redCards: 0, substitutions: 0 });
    expect(stats?.updatedAt).toBeNull();
    expect(stats?.dataSourceLabel).toBe('FIFA Match Centre');

    const recapEnv = createMockEnv({
      MOCK_SOURCES: 'true',
      DB: createMockDb({
        first: (sql) => {
          if (sql.includes('FROM matches m') && sql.includes('m.id = ?')) {
            return { ...FIXTURE_MATCH, slug: FIXTURE_MATCH.id, status: 'completed' };
          }
          if (sql.includes('FROM match_recaps')) return null;
          return null;
        },
        all: (sql) => {
          if (sql.includes('FROM match_commentary')) {
            return {
              results: [
                {
                  id: 'c-only',
                  minute: 11,
                  period: '1H',
                  text_vi: 'Tạo cơ hội',
                  text_en: 'Chance created',
                  event_type: 'shot',
                },
              ],
            };
          }
          if (sql.includes('FROM player_match_stats')) {
            return {
              results: [
                {
                  player_id: 'p1',
                  player_name: 'Impact Player',
                  team_id: FIXTURE_MATCH.home_team_id,
                  shirt_number: null,
                  minutes_played: 25,
                  goals: 0,
                  assists: 1,
                  shots: 1,
                  shots_on_target: 1,
                  xg: 0.12,
                  yellow_cards: 1,
                  red_cards: 0,
                },
              ],
            };
          }
          return { results: [] };
        },
      }),
    });
    const recap = await getMatchRecap(recapEnv, FIXTURE_MATCH.id);
    expect(recap?.summaryVi).toBe('');
    expect(recap?.sourceId).toBeNull();
    expect(recap?.commentary[0]?.textEn).toBe('Chance created');
    expect(recap?.playerStats[0]?.assists).toBe(1);
  });

  it('matchIntelligence covers fallback mapping, missing match, and recalc movement', async () => {
    const fallbackProfile = mockScenarioContext().homeSystem;
    expect(mapTeamSystemRow(null, fallbackProfile)?.teamId).toBe(fallbackProfile.teamId);
    expect(mapTeamSystemRow(null)).toBeNull();

    const missingTeamSystemEnv = createMockEnv({
      DB: createMockDb({
        first: () => null,
        all: () => ({ results: [] }),
      }),
    });
    expect(await getTeamSystemPayload(missingTeamSystemEnv, 'missing')).toBeNull();

    const movementEnv = createMockEnv({
      DB: createMockDb({
        all: () => ({
          results: [
            {
              minute: 0,
              home_win_prob: 0.4,
              draw_prob: 0.3,
              away_win_prob: 0.3,
              created_at: '2026-01-01T00:00:00Z',
              model_version: 'v1',
            },
            {
              minute: 0,
              home_win_prob: 0.5,
              draw_prob: 0.25,
              away_win_prob: 0.25,
              created_at: '2026-01-01T00:05:00Z',
              model_version: 'v1',
            },
          ],
        }),
      }),
    });
    const movement = await getProbabilityMovement(movementEnv, FIXTURE_MATCH.id);
    expect(movement.events[1]?.reasonCode).toBe('recalc');
  });

  it('probability route returns 404 when recompute cannot load both teams', async () => {
    const teamsRepo = await import('../src/db/repositories/teamsRepo');
    vi.mocked(teamsRepo.getTeam).mockResolvedValueOnce(null);
    const env = createRouteTestEnv({
      DB: createMockDb({
        first: (sql, binds) => {
          if (sql.includes('FROM matches m') && sql.includes('m.id = ?')) {
            return {
              ...FIXTURE_MATCH,
              home_name: 'Mexico',
              away_name: 'South Africa',
              home_short: 'MEX',
              away_short: 'RSA',
              home_country_code: 'MEX',
              away_country_code: 'RSA',
            };
          }
          if (sql.includes('SELECT year FROM tournaments WHERE id')) return { year: 2026 };
          return null;
        },
        all: () => ({ results: [] }),
      }),
    });
    const { probabilityRoutes } = await import('../src/routes/probability');
    const { res } = await jsonRoute(probabilityRoutes, `/${FIXTURE_MATCH.id}/probability?recompute=1`, {
      env,
    });
    expect(res.status).toBe(404);
  });

  it('probability routes return 404 for scoreline, intervals, and tactical briefing when probability resolution fails', async () => {
    const teamsRepo = await import('../src/db/repositories/teamsRepo');
    const { probabilityRoutes } = await import('../src/routes/probability');

    vi.mocked(teamsRepo.getTeam).mockResolvedValueOnce(null);
    expect((await jsonRoute(probabilityRoutes, `/${FIXTURE_MATCH.id}/scoreline?recompute=1`)).res.status).toBe(
      404,
    );

    vi.mocked(teamsRepo.getTeam).mockResolvedValueOnce(null);
    expect((await jsonRoute(probabilityRoutes, `/${FIXTURE_MATCH.id}/intervals?recompute=1`)).res.status).toBe(
      404,
    );

    vi.mocked(teamsRepo.getTeam).mockResolvedValueOnce(null);
    expect(
      (await jsonRoute(probabilityRoutes, `/${FIXTURE_MATCH.id}/tactical-briefing?recompute=1`)).res.status,
    ).toBe(404);
  });

  it('scenario modules cover remaining switch cases, fallback selection, and validation metadata', () => {
    const lowEventCtx = mockScenarioContext({
      stage: 'Final',
      probability: {
        ...mockScenarioContext().probability,
        expectedHomeGoals: 0.8,
        expectedAwayGoals: 0.7,
        drawProb: 0.42,
      },
      homeSystem: {
        ...mockScenarioContext().homeSystem,
        pressingScore: 0.4,
        transitionScore: 0.32,
        setPieceScore: 0.66,
        benchDepthScore: 0.74,
      },
      awaySystem: {
        ...mockScenarioContext().awaySystem,
        transitionScore: 0.68,
        defensiveCompactnessScore: 0.71,
        benchDepthScore: 0.42,
      },
    });

    const lowBlock = runScenarioProbabilityModel(
      'low_block_frustration',
      lowEventCtx,
      selectScenarioFeatures('low_block_frustration', lowEventCtx),
    );
    const setPiece = runScenarioProbabilityModel(
      'set_piece_decider',
      lowEventCtx,
      selectScenarioFeatures('set_piece_decider', lowEventCtx),
    );
    const controlled = runScenarioProbabilityModel(
      'low_event_controlled_match',
      lowEventCtx,
      selectScenarioFeatures('low_event_controlled_match', lowEventCtx),
    );
    const redCard = runScenarioProbabilityModel(
      'red_card_disruption',
      lowEventCtx,
      selectScenarioFeatures('red_card_disruption', lowEventCtx),
    );
    const benchImpact = runScenarioProbabilityModel(
      'late_bench_impact',
      lowEventCtx,
      selectScenarioFeatures('late_bench_impact', lowEventCtx),
    );
    const extraTime = runScenarioProbabilityModel(
      'extra_time_path',
      lowEventCtx,
      selectScenarioFeatures('extra_time_path', lowEventCtx),
    );
    const penalties = runScenarioProbabilityModel(
      'penalty_shootout_path',
      lowEventCtx,
      selectScenarioFeatures('penalty_shootout_path', lowEventCtx),
    );
    const surprise = runScenarioProbabilityModel(
      'lineup_surprise',
      lowEventCtx,
      selectScenarioFeatures('lineup_surprise', lowEventCtx),
    );

    expect(lowBlock.drawProb).toBeGreaterThan(lowEventCtx.probability.drawProb);
    expect(setPiece.expectedHomeGoals).toBeGreaterThan(lowEventCtx.probability.expectedHomeGoals);
    expect(controlled.expectedHomeGoals).toBeLessThan(lowEventCtx.probability.expectedHomeGoals);
    expect(redCard.scenarioProbability).toBeGreaterThan(0);
    expect(benchImpact.homeWinProb).not.toBe(lowEventCtx.probability.homeWinProb);
    expect(extraTime.drawProb).toBeGreaterThan(lowEventCtx.probability.drawProb);
    expect(penalties.drawProb).toBeGreaterThan(penalties.awayWinProb);
    expect(surprise.scenarioProbability).toBeCloseTo(0.25, 5);

    const baselineOnly = {
      scenarioType: 'baseline_expected_flow' as const,
      scenarioName: 'Baseline',
      isBaseline: true,
      weight: 1,
      featureSelection: selectScenarioFeatures('baseline_expected_flow', lowEventCtx),
      output: runScenarioProbabilityModel(
        'baseline_expected_flow',
        lowEventCtx,
        selectScenarioFeatures('baseline_expected_flow', lowEventCtx),
      ),
    };
    const ensured = ensureAtLeastTwoScenarios([baselineOnly], lowEventCtx);
    expect(ensured.some((s) => s.scenarioType === 'transition_dominance')).toBe(true);

    const comparison = compareScenarios([mockScenario()]);
    expect(comparison.primaryScenarioId).toBe(comparison.alternativeScenarioId);

    const realtime = applyRealtimeEventToScenarios(
      lowEventCtx,
      [
        mockScenario({
          id: 'sc-base',
          isBaseline: true,
          scenarioType: 'baseline_expected_flow',
          scenarioProbability: 0.34,
        }),
        mockScenario({
          id: 'sc-red',
          isBaseline: false,
          scenarioType: 'red_card_disruption',
          scenarioProbability: 0.1,
        }),
      ],
      {
        matchId: lowEventCtx.matchId,
        eventId: 'evt-red',
        eventType: 'red_card',
        minute: 50,
      },
    );
    expect(
      realtime.scenarios.find((s) => s.scenarioType === 'red_card_disruption')?.scenarioProbability,
    ).toBeGreaterThan(0.1);
    expect(realtime.explanationRequired).toBe(true);

    const validation = validateScenarioSet([
      mockScenario({ id: 'sc-a', isBaseline: true, modelVersion: '', inputHash: '' }),
      mockScenario({ id: 'sc-b', isBaseline: false }),
    ]);
    expect(validation.some((e) => e.includes('missing modelVersion'))).toBe(true);
    expect(validation.some((e) => e.includes('missing inputHash'))).toBe(true);
  });

  it('scenarioGenerator and matchIntelligence cover remaining fallback branches', async () => {
    const homeEdgeCtx = mockScenarioContext({
      homeSystem: { ...mockScenarioContext().homeSystem, transitionScore: 0.82 },
      awaySystem: { ...mockScenarioContext().awaySystem, transitionScore: 0.2 },
    });
    const baselineOnly = {
      scenarioType: 'baseline_expected_flow' as const,
      scenarioName: 'Baseline',
      isBaseline: true,
      weight: 1,
      featureSelection: selectScenarioFeatures('baseline_expected_flow', homeEdgeCtx),
      output: runScenarioProbabilityModel(
        'baseline_expected_flow',
        homeEdgeCtx,
        selectScenarioFeatures('baseline_expected_flow', homeEdgeCtx),
      ),
    };
    const ensured = ensureAtLeastTwoScenarios([baselineOnly], homeEdgeCtx);
    expect(ensured.some((s) => s.scenarioType === 'early_goal_swing')).toBe(true);
    expect(ensureAtLeastTwoScenarios([], homeEdgeCtx)).toEqual([]);

    const mapped = mapTeamSystemRow({
      team_id: 'team-x',
      source_id: 'src-1',
      tactical_identity: null,
      primary_formation: null,
      model_version: null,
    });
    expect(mapped?.tacticalIdentity).toBe('balanced_block');
    expect(mapped?.primaryFormation).toBe('4-3-3');
    expect(mapped?.sourceId).toBe('src-1');

    const emptyMovement = await getProbabilityMovement(
      createMockEnv({
        DB: createMockDb({
          all: () => ({ results: undefined as unknown as [] }),
        }),
      }),
      FIXTURE_MATCH.id,
    );
    expect(emptyMovement.events).toEqual([]);
    expect(emptyMovement.modelVersion).toBeNull();
  });

  it('lineupDisplay and pitchMap cover missing-match and fallback label branches', async () => {
    const squadEnv = createMockEnv({
      DB: createMockDb({
        first: (sql) => {
          if (sql.includes('FROM squads')) return { id: 'sq-no-gk', confidence: 0.6 };
          return null;
        },
        all: (sql) => {
          if (sql.includes('FROM squad_players')) {
            return {
              results: Array.from({ length: 12 }, (_, i) => ({
                name: `Squad ${i + 1}`,
                shirt_number: i + 1,
                listed_position: i < 4 ? 'CB' : i < 8 ? 'CM' : 'ST',
                position: i < 4 ? 'DEF' : i < 8 ? 'MID' : 'FW',
              })),
            };
          }
          return { results: [] };
        },
      }),
    });
    const squad = await getLineupDisplayForMatch(squadEnv, 'm-squad', 'team-squad');
    expect(squad.source).toBe('squad');
    expect(squad.starters[0]?.name).toBe('Squad 1');
    expect(squad.substitutes.length).toBeGreaterThan(0);

    const { syncFifaMatchLineupsByRef } = await import('../src/ingestion/fifa/fifaLineupSync');
    const { syncOfficialSquadToMatch } = await import('../src/services/officialLineupSync');
    vi.mocked(syncFifaMatchLineupsByRef).mockClear();
    vi.mocked(syncOfficialSquadToMatch).mockClear();
    await ensureMatchLineups(
      createMockEnv({
        DB: createMockDb({
          first: () => null,
        }),
      }),
      'missing-match',
    );
    expect(syncFifaMatchLineupsByRef).toHaveBeenCalled();
    expect(syncOfficialSquadToMatch).not.toHaveBeenCalled();

    const pitchEnv = createMockEnv({
      MOCK_SOURCES: 'true',
      DB: createMockDb({
        first: (sql) => {
          if (sql.includes('FROM matches m') && sql.includes('m.id = ?')) {
            return {
              ...FIXTURE_MATCH,
              slug: FIXTURE_MATCH.id,
              status: 'completed',
              minute: null,
              updated_at: null,
              home_name: 'Mexico',
              away_name: 'South Africa',
            };
          }
          if (sql.includes('SELECT name FROM teams')) return null;
          return null;
        },
        all: (sql) => {
          if (sql.includes('FROM lineups l')) {
            return {
              results: [
                {
                  lineup_id: 'lu-h',
                  team_id: FIXTURE_MATCH.home_team_id,
                  team_name: 'Mexico',
                  formation: '4-3-3',
                  source_type: null,
                  player_id: 'p-home',
                  player_name: 'Home Player',
                  shirt_number: 1,
                  position_slot: 'GK',
                  role: null,
                  player_position: null,
                  is_starter: 1,
                  x: null,
                  y: null,
                },
                {
                  lineup_id: 'lu-a',
                  team_id: FIXTURE_MATCH.away_team_id,
                  team_name: 'South Africa',
                  formation: '4-3-3',
                  source_type: null,
                  player_id: 'p-away',
                  player_name: 'Away Player',
                  shirt_number: 1,
                  position_slot: 'GK',
                  role: null,
                  player_position: null,
                  is_starter: 1,
                  x: null,
                  y: null,
                },
              ],
            };
          }
          return { results: undefined as unknown as [] };
        },
      }),
    });
    const pitch = await getPitchMapPayload(pitchEnv, FIXTURE_MATCH.id);
    expect(pitch?.home.teamName).toBe('Home');
    expect(pitch?.away.teamName).toBe('Away');
    expect(pitch?.events).toEqual([]);
    expect(pitch?.updatedAt).toBeNull();
  });

  it('matchPreviewAnalysis keeps rule-based copy when AI payload lacks summaryVi', async () => {
    const { gatewayChatJson, isGatewayConfigured } = await import('../src/ai/gatewayClient');
    vi.mocked(isGatewayConfigured).mockReturnValue(true);
    vi.mocked(gatewayChatJson).mockResolvedValue({ summary: 'Only EN summary' } as never);

    const env = createMockEnv({
      KV: createMockKv(),
      AI_GATEWAY_ENABLED: 'true',
      AI_GATEWAY_ACCOUNT_ID: 'acct',
      OPENAI_API_KEY: 'sk',
      DB: createMockDb({
        first: (sql, binds) => {
          if (sql.includes('FROM matches WHERE id')) {
            return { ...FIXTURE_MATCH, stage: null, group_code: null };
          }
          if (sql.includes('FROM teams WHERE id')) {
            return binds[0] === FIXTURE_TEAMS[0].id ? FIXTURE_TEAMS[0] : FIXTURE_TEAMS[1];
          }
          if (sql.includes('FROM probability_snapshots')) return FIXTURE_SNAPSHOT;
          if (sql.includes('FROM lineups l')) return null;
          return null;
        },
        all: () => ({ results: [] }),
      }),
    });

    const preview = await getMatchPreviewAnalysis(env, FIXTURE_MATCH.id);
    expect(preview?.summary.en).toContain('vs');
    expect(preview?.sections.context.en).toContain('World Cup 2026 fixture');
  });
});

describe('coverage final — additional component and utility branches', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('covers analytics, lineup, stats, and pitch map UI branch paths', async () => {
    vi.spyOn(api, 'matchProbabilityMovement')
      .mockResolvedValueOnce({
        data: {
          events: [
            {
              minute: 5,
              reasonCode: 'goal',
              homeWinBefore: 0.4,
              drawBefore: 0.3,
              awayBefore: 0.3,
              homeWinAfter: 0.15,
              drawAfter: 0.3,
              awayAfter: 0.55,
            },
            {
              minute: 12,
              reasonCode: 'red_card',
              homeWinBefore: 0.15,
              drawBefore: 0.3,
              awayBefore: 0.55,
              homeWinAfter: 0.1,
              drawAfter: 0.3,
              awayAfter: 0.6,
            },
          ],
          modelVersion: 'v1',
        },
      } as never)
      .mockRejectedValueOnce(new Error('movement down'));

    const analyticsNegative = renderWithAppProviders(
      React.createElement(MatchAnalyticsPanel, { matchId: 'match-neg' }),
    );
    await waitFor(() => expect(screen.getByText('-60.0%')).toBeTruthy());
    analyticsNegative.unmount();

    renderWithAppProviders(
      React.createElement(MatchAnalyticsPanel, {
        matchId: 'match-pos',
        homeWin: 0.7,
        awayWin: 0.1,
      }),
    );
    await waitFor(() => expect(screen.getByText('+60.0%')).toBeTruthy());
    cleanup();

    renderWithAppProviders(
      React.createElement(MatchLineupSidePanel, {
        label: 'Grouped',
        matchRef: 'mx-vs-rsa',
        side: {
          teamName: 'Grouped FC',
          formation: '3-4-3',
          hasAccurateLineup: false,
          hasLineup: undefined,
          source: 'projected',
          starters: undefined,
          substitutes: [],
          grouped: {
            DEF: [{ shirtNumber: null, name: 'Null Number', position: 'CB' }],
          },
          lineupPlayers: undefined,
          players: Array.from({ length: 7 }, (_, i) => ({
            shirtNumber: i + 1,
            name: `Player ${i + 1}`,
            position: 'CM',
          })),
        },
      } as never),
    );
    expect(document.body.textContent).toContain('—');
    cleanup();

    renderWithAppProviders(
      React.createElement(MatchLineupSidePanel, {
        label: 'Compact',
        compact: true,
        side: {
          teamName: 'Compact FC',
          formation: null,
          hasAccurateLineup: false,
          hasLineup: undefined,
          source: null,
          starters: Array.from({ length: 7 }, (_, i) => ({
            shirtNumber: i === 0 ? null : i,
            name: `Starter ${i + 1}`,
            position: 'CM',
          })),
          substitutes: [],
          grouped: null,
          lineupPlayers: undefined,
          players: [],
        },
      } as never),
    );
    expect(document.body.textContent).toContain('Compact FC');
    cleanup();

    vi.spyOn(api, 'matchStats')
      .mockResolvedValueOnce({
        data: {
          matchId: 'stats-null',
          slug: 'stats-null',
          status: 'live',
          minute: 20,
          homeScore: 0,
          awayScore: 0,
          updatedAt: null,
          dataSource: 'fifa_live',
          home: {
            teamId: 'h',
            teamName: 'Home',
            possession: null,
            shots: 7,
            shotsOnTarget: 2,
            xg: null,
            passes: 320,
            passAccuracy: 80,
          },
          away: {
            teamId: 'a',
            teamName: 'Away',
            possession: 10,
            shots: 4,
            shotsOnTarget: 2,
            xg: null,
            passes: 400,
            passAccuracy: 75,
          },
          events: { goals: 0, yellowCards: 1, redCards: 0, substitutions: 2 },
          xgEstimateNote: 'Estimated from event data',
        },
      } as never)
      .mockResolvedValueOnce({
        data: {
          matchId: 'stats-zero',
          slug: 'stats-zero',
          status: 'completed',
          minute: 90,
          homeScore: 1,
          awayScore: 1,
          updatedAt: '2026-01-01T00:00:00Z',
          dataSource: 'recorded',
          dataSourceLabel: 'FIFA Match Centre',
          home: {
            teamId: 'h',
            teamName: 'Home',
            possession: 0,
            shots: 1,
            shotsOnTarget: 0,
            xg: 0.1,
            passes: 0,
            passAccuracy: 0,
          },
          away: {
            teamId: 'a',
            teamName: 'Away',
            possession: 0,
            shots: 1,
            shotsOnTarget: 0,
            xg: 0.1,
            passes: 0,
            passAccuracy: 0,
          },
          events: { goals: 2, yellowCards: 0, redCards: 0, substitutions: 6 },
          xgEstimateNote: 'Recorded feed',
        },
      } as never);

    renderWithAppProviders(
      React.createElement(MatchLiveStatsPanel, {
        matchId: 'stats-null',
        homeLabel: 'Home',
        awayLabel: 'Away',
      }),
    );
    await waitFor(() => expect(document.body.textContent).toContain('7'));
    cleanup();

    renderWithAppProviders(
      React.createElement(MatchLiveStatsPanel, {
        matchId: 'stats-zero',
        homeLabel: 'Home',
        awayLabel: 'Away',
      }),
    );
    await waitFor(() => expect(document.body.textContent).toContain('FIFA Match Centre'));
    cleanup();

    renderWithAppProviders(React.createElement(PitchMap, { data: null, loading: false }));
    expect(document.body.textContent?.length).toBeGreaterThan(0);
    cleanup();

    renderWithAppProviders(
      React.createElement(PitchMap, {
        loading: false,
        data: {
          matchId: 'pitch-1',
          slug: 'pitch-1',
          status: 'live',
          minute: 61,
          home: {
            teamId: 'home',
            teamName: 'Home Data',
            formation: null,
            source: 'projected',
            players: [
              {
                playerId: 'hp1',
                name: 'Home Player',
                shirtNumber: 9,
                position: 'ST',
                x: 0.2,
                y: 0.4,
                isOnPitch: true,
                isStarter: true,
                subMinute: null,
                subType: null,
                rating: 7.2,
                movement: null,
              },
            ],
            bench: [
              {
                playerId: 'hb1',
                name: 'Bench Home',
                shirtNumber: null,
                position: 'CM',
                x: 0.25,
                y: 0.5,
                isOnPitch: false,
                isStarter: false,
                subMinute: 60,
                subType: 'out',
                rating: 6.5,
                movement: null,
              },
            ],
          },
          away: {
            teamId: 'away',
            teamName: 'Away Data',
            formation: null,
            source: 'unknown',
            players: [],
            bench: [],
          },
          events: [
            {
              id: 'evt-1',
              x: 0.4,
              y: 0.3,
              endX: 0.6,
              endY: 0.35,
              eventType: 'shot',
              teamId: null,
              playerId: null,
              minute: 5,
            },
          ],
          showRatings: true,
          updatedAt: null,
        },
      } as never),
    );
    expect(document.body.textContent).toContain('Bench Home');
    expect(document.body.textContent).toContain('—');
  });

  it('covers feed, formation, and scenario utility branches', async () => {
    const nullInsertEnv = createMockEnv({
      DB: createMockDb({
        run: () => ({ success: true, meta: { last_row_id: 0 } } as never),
      }),
    });
    expect(await appendFeedEvent(nullInsertEnv, 'match.score_updated', null, { ok: true })).toBeNull();

    const pagedEnv = createMockEnv({
      DB: createMockDb({
        all: () => ({
          results: [
            {
              id: 5,
              event_type: 'match.score_updated',
              match_id: FIXTURE_MATCH.id,
              payload_json: '{"homeScore":2}',
              created_at: '2026-01-01T00:00:00Z',
            },
            {
              id: 6,
              event_type: 'match.status_changed',
              match_id: FIXTURE_MATCH.id,
              payload_json: '{"status":"live"}',
              created_at: '2026-01-01T00:01:00Z',
            },
          ],
        }),
        first: () => null,
      }),
    });
    const page = await queryFeed(pagedEnv, { limit: 1 });
    expect(page.events).toHaveLength(1);
    expect(page.nextCursor).toBe(5);
    expect(await getLatestFeedCursor(pagedEnv)).toBe(0);

    const emptyFeedEnv = createMockEnv({
      DB: createMockDb({
        all: () => ({ results: undefined }),
      }),
    });
    expect(await queryFeed(emptyFeedEnv, {})).toEqual({ events: [], nextCursor: null });

    const coords = assignFormationCoords(
      '4-3-3',
      [
        { playerId: 'lb', position: 'LB' },
        { playerId: 'rcb', position: 'RCB' },
        { playerId: 'cm', position: 'CM' },
        { playerId: 'unk', position: 'SW' },
      ],
      'home',
    );
    expect(coords.get('lb')?.y).toBeLessThan(coords.get('rcb')?.y ?? 1);
    expect(coords.get('cm')?.y).toBe(0.5);
    expect(coords.get('unk')?.x).toBeGreaterThan(0);

    const baselineCtx = mockScenarioContext({
      minute: 35,
      homeLineupSource: 'official',
      awayLineupSource: 'projected',
      probability: {
        ...mockScenarioContext().probability,
        expectedAwayGoals: 0.2,
        scorelineDistribution: {},
      },
      homeSystem: {
        ...mockScenarioContext().homeSystem,
        possessionControlScore: 0.42,
      },
      awaySystem: {
        ...mockScenarioContext().awaySystem,
        possessionControlScore: 0.61,
      },
    });
    const baseline = runScenarioProbabilityModel(
      'baseline_expected_flow',
      baselineCtx,
      selectScenarioFeatures('baseline_expected_flow', baselineCtx),
    );
    expect(baseline.initialConditions[0]?.confidence).toBe(0.9);
    expect(baseline.initialConditions[3]?.value).toBe(baselineCtx.awayTeamName);
    expect(baseline.triggerConditions[1]?.status).toBe('triggered');

    const negativePressCtx = mockScenarioContext({
      probability: {
        ...mockScenarioContext().probability,
        scorelineDistribution: {},
      },
      homeSystem: {
        ...mockScenarioContext().homeSystem,
        pressingScore: 0.25,
      },
      awaySystem: {
        ...mockScenarioContext().awaySystem,
        pressingScore: 0.72,
      },
    });
    const pressing = runScenarioProbabilityModel(
      'pressing_breakthrough',
      negativePressCtx,
      selectScenarioFeatures('pressing_breakthrough', negativePressCtx),
    );
    expect(pressing.expectedHomeGoals).toBeLessThan(negativePressCtx.probability.expectedHomeGoals);
    expect(pressing.mostLikelyScore).toBe('1-1');
  });

  it('covers thumbnail backfill, market signal, standings, and history fallback branches', async () => {
    const {
      getTeamWorldCupHeadToHead,
      resolveTeamIdsForWcHistory,
      summarizePairFromPerspective,
    } = await vi.importActual<typeof import('../src/services/matchHistory')>(
      '../src/services/matchHistory',
    );

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          `<rss><channel><item><link>https://unknown.example/no-image</link></item></channel></rss>`,
          {
            status: 200,
            headers: { 'content-type': 'application/rss+xml' },
          },
        ),
      ),
    );

    const rawMissEnv = createMockEnv({
      R2_RAW: { get: vi.fn(async () => null) } as never,
    });
    expect(await imageUrlFromRaw(rawMissEnv, 'missing/raw.json')).toBeNull();

    const rssMissEnv = createMockEnv({
      DB: createMockDb({
        first: () => ({
          source_url: 'https://unknown.example/no-image',
          content_r2_key: 'raw/missing.json',
        }),
      }),
      R2_RAW: { get: vi.fn(async () => null) } as never,
    });
    expect(await resolveNewsThumbSourceUrl(rssMissEnv, 'doc-missing-thumb')).toBeNull();

    const { compressAndStoreNewsImage } = await import('../src/services/newsImagePipeline');
    vi.mocked(compressAndStoreNewsImage).mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    const backfillEnv = createMockEnv({
      DB: createMockDb({
        all: () => ({
          results: [
            {
              id: 'doc-skip',
              source_url: 'https://unknown.example/no-image',
              content_r2_key: null,
            },
            {
              id: 'doc-raw-hit',
              source_url: 'https://unknown.example/raw-hit',
              content_r2_key: 'raw/hit.json',
            },
          ],
        }),
        run: () => ({ success: true }),
      }),
      R2_RAW: {
        get: vi.fn(async (key: string) =>
          key === 'raw/hit.json'
            ? {
                text: async () =>
                  JSON.stringify({ imageUrl: 'https://cdn.example.com/raw-hit.jpg' }),
              }
            : null,
        ),
      } as never,
    });
    expect(await backfillNewsThumbnails(backfillEnv, 5)).toBe(1);

    const recompressEnv = createMockEnv({
      DB: createMockDb({
        all: () => ({
          results: [
            {
              id: 'doc-no-head',
              source_url: 'https://unknown.example/no-image',
              content_r2_key: null,
              thumbnail_r2_key: 'thumb-missing',
            },
            {
              id: 'doc-not-legacy',
              source_url: 'https://unknown.example/no-image',
              content_r2_key: null,
              thumbnail_r2_key: 'thumb-small',
            },
            {
              id: 'doc-no-image',
              source_url: 'https://unknown.example/no-image',
              content_r2_key: null,
              thumbnail_r2_key: 'thumb-large',
            },
            {
              id: 'doc-no-store',
              source_url: 'https://unknown.example/raw-hit',
              content_r2_key: 'raw/hit.json',
              thumbnail_r2_key: 'thumb-large-2',
            },
          ],
        }),
        run: () => ({ success: true }),
      }),
      R2_ARTIFACTS: {
        head: vi.fn(async (key: string) => {
          if (key === 'thumb-missing') return null;
          if (key === 'thumb-small') return { httpMetadata: { contentType: 'image/webp' }, size: 2048 };
          return { httpMetadata: { contentType: 'image/jpeg' }, size: 90_000 };
        }),
      } as never,
      R2_RAW: {
        get: vi.fn(async (key: string) =>
          key === 'raw/hit.json'
            ? {
                text: async () =>
                  JSON.stringify({ imageUrl: 'https://cdn.example.com/raw-hit.jpg' }),
              }
            : null,
        ),
      } as never,
    });
    expect(await recompressNewsThumbnails(recompressEnv, 10)).toBe(0);

    vi.spyOn(probabilityRepo, 'getLatestSnapshot').mockResolvedValue({
      home_win_prob: 0.45,
      draw_prob: 0.25,
      away_win_prob: 0.3,
    } as never);
    vi.spyOn(marketRepo, 'getLatestMarketOdds').mockResolvedValue([
      { selection: 'home', normalized_probability: 0.5, source_id: null, retrieved_at: null },
    ] as never);
    vi.spyOn(marketRepo, 'saveMarketSignalAnalysis').mockResolvedValue(undefined as never);
    const marketSignals = await buildModelVsMarket(
      createMockEnv({
        DB: createMockDb({ first: () => null }),
      }),
      'market-1',
    );
    expect(marketSignals?.market.draw).toBe(0.33);
    expect(marketSignals?.market.away).toBe(0.34);
    expect(marketSignals?.sourceId).toBe('mkt-manual');
    expect(marketSignals?.sourceName).toBe('Market source');
    expect(refereeToFeatures({ role: 'referee', name: 'Ref', nationality: null, fifaCategory: null, strictness: 0.5 }))
      .toEqual(expect.objectContaining({ avgYellowCards: 4.5, avgRedCards: 0.11 }));

    const sparseStandings = await buildGroupStandingsPayload(
      createMockEnv({
        DB: createMockDb({
          all: (sql) => {
            if (sql.includes('WHERE tournament_id = ? AND stage = \'Group\'')) return {} as never;
            if (sql.includes('GROUP BY group_code')) return {} as never;
            if (sql.includes('FROM teams WHERE id LIKE')) return {} as never;
            return { results: [] };
          },
        }),
      }),
    );
    expect(sparseStandings.groups.A?.rows).toEqual([]);

    const gdAndGfRanked = sortStandingRows([
      {
        teamId: 'one',
        teamName: 'One',
        shortName: null,
        rank: 0,
        played: 3,
        points: 4,
        gf: 2,
        ga: 1,
        gd: 1,
      },
      {
        teamId: 'two',
        teamName: 'Two',
        shortName: null,
        rank: 0,
        played: 3,
        points: 4,
        gf: 4,
        ga: 2,
        gd: 2,
      },
      {
        teamId: 'three',
        teamName: 'Three',
        shortName: null,
        rank: 0,
        played: 3,
        points: 4,
        gf: 3,
        ga: 1,
        gd: 2,
      },
    ]);
    expect(gdAndGfRanked.map((row) => row.teamId)).toEqual(['two', 'three', 'one']);

    const mixedSummary = summarizePairFromPerspective(
      [
        {
          id: 'h-win',
          kickoff_utc: '2018-06-01T12:00:00Z',
          stage: 'Group',
          status: 'completed',
          home_team_id: 'home',
          away_team_id: 'away',
          home_name: 'Home',
          away_name: 'Away',
          home_short: 'H',
          away_short: 'A',
          home_score: 2,
          away_score: 1,
          home_xg: 1,
          away_xg: 1,
        },
        {
          id: 'draw',
          kickoff_utc: '2014-06-01T12:00:00Z',
          stage: 'Group',
          status: 'completed',
          home_team_id: 'away',
          away_team_id: 'home',
          home_name: 'Away',
          away_name: 'Home',
          home_short: 'A',
          away_short: 'H',
          home_score: 1,
          away_score: 1,
          home_xg: 1,
          away_xg: 1,
        },
      ] as never,
      'home',
      'away',
    );
    expect(mixedSummary.homeTeamWins).toBe(1);
    expect(mixedSummary.draws).toBe(1);

    const historyEnv = createMockEnv({
      DB: createMockDb({
        first: (sql) => {
          if (sql.includes('country_code FROM teams WHERE id')) {
            return { id: 'team-home', name: 'Home', country_code: 'HOM' };
          }
          if (sql.includes('SELECT id FROM teams WHERE id = ?')) return { id: 'team-home' };
          return null;
        },
        all: (sql) => {
          if (sql.includes('SELECT id FROM teams WHERE country_code = ?')) return {} as never;
          if (sql.includes('WHERE m.home_team_id = ? OR m.away_team_id = ?')) return {} as never;
          return { results: [] };
        },
      }),
    });
    expect(await resolveTeamIdsForWcHistory(historyEnv, 'team-home')).toEqual(['team-home']);
    const groupedHistory = await getTeamWorldCupHeadToHead(historyEnv, 'team-home');
    expect(groupedHistory?.opponents).toEqual([]);
  });
});

describe('coverage final — broad branch pass', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('covers multi-variable analysis cache hits and null exits', async () => {
    const { runMultiVariableAnalysis } = await import('../src/ai/multiVariableAnalysis');
    const gatewayClient = await import('../src/ai/gatewayClient');
    const matchesRepo = await import('../src/db/repositories/matchesRepo');
    const teamsRepo = await import('../src/db/repositories/teamsRepo');
    const probabilityRepo = await import('../src/db/repositories/probabilityRepo');
    const eventsRepo = await import('../src/db/repositories/eventsRepo');

    const cached = {
      matchId: 'match-cached',
      generatedAt: '2026-01-01T00:00:00Z',
      executiveSummary: 'Cached analysis',
      variableInsights: [],
      tacticalRecommendations: [],
      riskFactors: [],
      confidence: 0.7,
      modelsUsed: [],
    };
    expect(
      await runMultiVariableAnalysis(
        createMockEnv({
          KV: createMockKv({ 'analysis:match-cached': JSON.stringify(cached) }),
        }),
        'match-cached',
      ),
    ).toEqual(cached);

    vi.mocked(gatewayClient.isGatewayConfigured).mockReturnValue(true);

    vi.spyOn(matchesRepo, 'getMatch').mockResolvedValueOnce(null as never);
    expect(await runMultiVariableAnalysis(createMockEnv({ KV: createMockKv() }), 'missing-match')).toBeNull();

    const liveMatch = {
      ...FIXTURE_MATCH,
      tournament_id: 't-wc',
      status: 'live',
      minute: 12,
      home_score: 1,
      away_score: 0,
      group_code: 'A',
    };
    vi.spyOn(matchesRepo, 'getMatch').mockResolvedValueOnce(liveMatch as never);
    vi.mocked(teamsRepo.getTeam).mockResolvedValueOnce(null as never);
    expect(await runMultiVariableAnalysis(createMockEnv({ KV: createMockKv() }), liveMatch.id)).toBeNull();

    const env = createMockEnv({
      KV: createMockKv(),
      DB: createMockDb({
        first: () => null,
        all: () => ({ results: [] }),
      }),
    });
    vi.spyOn(matchesRepo, 'getMatch').mockResolvedValueOnce(liveMatch as never);
    vi.mocked(teamsRepo.getTeam)
      .mockResolvedValueOnce({ ...FIXTURE_TEAMS[0], country_code: 'MX' } as never)
      .mockResolvedValueOnce({ ...FIXTURE_TEAMS[1], country_code: 'ZA' } as never);
    vi.spyOn(probabilityRepo, 'getLatestSnapshot').mockResolvedValueOnce(null as never);
    vi.spyOn(eventsRepo, 'getMatchEvents').mockResolvedValueOnce([] as never);
    vi.mocked(gatewayClient.gatewayChatJson).mockResolvedValueOnce(null as never);

    expect(await runMultiVariableAnalysis(env, liveMatch.id)).toBeNull();
    expect(vi.mocked(gatewayClient.gatewayChatJson)).toHaveBeenCalledWith(
      env,
      'multi_variable_synthesis',
      expect.any(Array),
    );
  });

  it('covers english UI branches for schedule, recap, and SEO landing pages', async () => {
    localStorage.setItem('wc-display-mode', 'en');

    const { MatchScheduleCalendar } = await import('../app/components/home/MatchScheduleCalendar');
    const { MatchRecapPanel } = await import('../app/components/match/MatchRecapPanel');
    const { SeoLandingPage } = await import('../app/pages/SeoLandingPage');

    renderWithAppProviders(
      React.createElement(MatchScheduleCalendar, {
        totalExpected: 2,
        matches: [
          {
            id: 'sched-1',
            slug: 'sched-1',
            kickoff_utc: '2026-06-11T12:00:00Z',
            stage: 'Group',
            group_code: 'A',
            status: 'live',
            home_name: 'Alpha United',
            away_name: 'Beta Town',
            home_short: null,
            away_short: null,
            home_score: 1,
            away_score: 0,
          },
          {
            id: 'sched-2',
            slug: 'sched-2',
            kickoff_utc: null as never,
            stage: null,
            group_code: null,
            status: 'scheduled',
            home_name: 'Searchable Name',
            away_name: 'Gamma',
            home_short: 'SN',
            away_short: 'GAM',
            home_score: null,
            away_score: null,
          },
        ],
        byDate: {},
      } as never),
    );
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'searchable' } });
    expect(document.body.textContent).toContain('SN vs GAM');
    cleanup();

    vi.spyOn(api, 'matchRecap')
      .mockRejectedValueOnce(new Error('missing recap'))
      .mockResolvedValueOnce({
        data: {
          matchId: 'recap-1',
          slug: 'recap-1',
          summaryEn: 'English recap summary',
          summaryVi: 'Tom tat',
          sourceId: null,
          commentary: [
            {
              id: 'line-1',
              minute: 17,
              period: '1H',
              textEn: 'English commentary',
              textVi: 'Binh luan',
              eventType: 'goal',
            },
          ],
          playerStats: [
            {
              playerId: 'p-1',
              playerName: 'Home Player',
              teamId: 'home',
              shirtNumber: 9,
              minutesPlayed: 90,
              goals: 1,
              assists: 0,
              shots: 2,
              shotsOnTarget: 1,
              xg: 0.5,
              yellowCards: 1,
              redCards: 1,
            },
          ],
        },
      } as never);

    const emptyRecap = renderWithAppProviders(
      React.createElement(MatchRecapPanel, {
        matchId: 'recap-missing',
        homeTeamId: 'home',
        homeLabel: 'Home',
        awayLabel: 'Away',
      }),
    );
    await waitFor(() => expect(emptyRecap.container.textContent).toBe(''));
    cleanup();

    renderWithAppProviders(
      React.createElement(MatchRecapPanel, {
        matchId: 'recap-1',
        homeTeamId: 'home',
        homeLabel: 'Home',
        awayLabel: 'Away',
      }),
    );
    await waitFor(() => expect(screen.getByText('English recap summary')).toBeTruthy());
    expect(document.body.textContent).toContain('English commentary');
    expect(document.body.textContent).toContain('🟥');
    expect(document.body.textContent).toContain('🟨');
    cleanup();

    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/lich-thi-dau-world-cup-2026'] },
        React.createElement(I18nProvider, null, React.createElement(SeoLandingPage)),
      ),
    );
    expect(screen.getByText('World Cup 2026 schedule')).toBeTruthy();
    expect(screen.getByRole('link', { name: /View match schedule/ })).toBeTruthy();
    expect(document.title).toContain('World Cup 2026 schedule');
  });

  it('covers translation, stats completeness, lineup role fallbacks, and publisher utilities', async () => {
    const { translateNewsHeadline } = await import('../src/ai/translateNews');
    const {
      areTeamMatchStatsComplete,
      loadTeamMatchStatsCompleteness,
    } = await import('../src/ingestion/fifa/teamMatchStatsComplete');
    const { buildLineupFeaturesFromPlayers } = await import('../src/services/lineupFeatures');
    const {
      isLikelyVietnamese,
      needsNewsTranslation,
      resolvePublisherLabel,
    } = await import('../src/services/newsTranslationUtils');

    expect(await translateNewsHeadline(createMockEnv(), 'US wins opener', 'Summary body')).toBeNull();

    const shortEnv = createMockEnv({
      AI: {
        run: vi.fn(async () => ({ translated_text: 'a' })),
      } as never,
    });
    expect(await translateNewsHeadline(shortEnv, 'US wins opener', 'Summary body')).toBeNull();

    const mixedEnv = createMockEnv({
      AI: {
        run: vi.fn(async (model: string, input: { text?: string }) => {
          if (model === '@cf/meta/m2m100-1.2b') {
            return {
              translated_text:
                input.text === 'US wins opener'
                  ? 'Hoa Ky thang lon'
                  : 'US wins opener after a controlled first half',
            };
          }
          throw new Error('workers ai disabled');
        }),
      } as never,
    });
    expect(
      await translateNewsHeadline(
        mixedEnv,
        'US wins opener',
        'US wins opener after a controlled first half',
      ),
    ).toBeNull();

    expect(
      areTeamMatchStatsComplete(
        { possession: null, passes: 250 },
        { possession: 52, passes: 410 },
      ),
    ).toBe(false);
    expect(
      await loadTeamMatchStatsCompleteness(
        createMockDb({
          all: () => ({} as never),
        }) as never,
        'm-1',
        'home',
        'away',
      ),
    ).toEqual({
      complete: false,
      home: null,
      away: null,
    });

    const lineup = buildLineupFeaturesFromPlayers(
      '4-3-3',
      [
        { is_starter: 1, position_slot: null, role: null, listed_position: 'GK' },
        { is_starter: 1, position_slot: null, role: 'CB' },
        { is_starter: 1, position_slot: null, role: null, listed_position: 'CM' },
        { is_starter: 1, position_slot: null, role: null, position: 'ST' },
        { is_starter: 1, position_slot: 'DM', role: null },
        { is_starter: 1, position_slot: null, role: null, listed_position: null, position: null },
        { is_starter: 1, position_slot: 'LB', role: null },
      ],
      false,
    );
    expect(lineup?.formation).toBe('4-3-3');
    expect(lineup?.missingKeyRoles).toContain('MID');

    expect(isLikelyVietnamese('', 'English source')).toBe(false);
    expect(
      needsNewsTranslation({
        id: 'doc-1',
        title: 'English title',
        summary: 'English summary',
        title_vi: 'Tieu de tieng Viet',
        summary_vi: 'english summary copied',
      }),
    ).toBe(true);
    expect(
      resolvePublisherLabel({
        source_name: 'Mock Development Source',
        source_url: 'https://www.bbc.com/sport',
      }),
    ).toBe('BBC');
    expect(resolvePublisherLabel({ source_name: '  ', source_url: undefined })).toBe('RSS');
  });

  it('covers news routes, sitemap fallbacks, scenario backtests, and webhook defaults', async () => {
    const pipelineBootstrap = await import('../src/services/pipelineBootstrap');
    const newsThumbs = await import('../src/services/newsThumbnailBackfill');
    const { newsRoutes } = await import('../src/routes/news');
    const { buildSitemapXml } = await import('../src/services/siteDiscovery');
    const { runScenarioBacktest } = await import('../src/models/scenarios/backtesting/scenarioBacktestRunner');
    const {
      listWebhooks,
      deleteWebhook,
      enqueueWebhookDeliveries,
    } = await import('../src/services/publicApi/webhooks');
    const { requestRoute } = await import('./helpers/routeHarness');

    vi.spyOn(pipelineBootstrap, 'ensureNewsCrawlFresh').mockResolvedValue(undefined);
    const listEnv = createMockEnv({
      KV: createMockKv({
        meta: '',
        last_fifa_sync: '',
        'meta:last_news_thumb_backfill': '2026-01-01T00:00:00Z',
        'meta:last_news_thumb_recompress': '2026-01-01T00:00:00Z',
        'meta:last_news_source_backfill': '2026-01-01T00:00:00Z',
        'meta:news_untranslated_count': '0',
      }),
      DB: createMockDb({
        all: (sql) => {
          if (sql.includes('ORDER BY COALESCE(sd.hot_score, sd.reliability_score) DESC')) return {} as never;
          if (sql.includes('ORDER BY sd.published_at DESC, sd.created_at DESC')) return {} as never;
          return { results: [] };
        },
        first: (sql) => {
          if (sql.includes('COUNT(*) AS n')) return null;
          return null;
        },
      }),
    });
    const listResp = await jsonRoute<{
      data: { hot: unknown[]; articles: unknown[] };
      meta: { total: number };
    }>(newsRoutes, '/?page=1&pageSize=20&hot=3', { env: listEnv });
    expect(listResp.json.data.hot).toEqual([]);
    expect(listResp.json.data.articles).toEqual([]);
    expect(listResp.json.meta.total).toBe(0);

    vi.spyOn(newsThumbs, 'resolveNewsThumbSourceUrl').mockResolvedValue('https://cdn.example.com/news.jpg');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 })),
    );
    const assetRes = await requestRoute(newsRoutes, '/assets/doc-1', {
      env: createMockEnv({
        R2_ARTIFACTS: {
          head: vi.fn(async () => ({
            httpMetadata: { contentType: 'image/jpeg' },
            size: 90_000,
          })),
          get: vi.fn(async () => null),
        } as never,
      }),
    });
    expect(assetRes.status).toBe(200);
    expect(assetRes.headers.get('Content-Type')).toBe('image/jpeg');

    const sitemapEmpty = await buildSitemapXml(
      createMockEnv({
        DB: createMockDb({
          all: () => ({} as never),
        }),
      }),
      'https://pitchintel.test',
    );
    expect(sitemapEmpty).toContain('/news-intelligence');

    const sitemapDynamic = await buildSitemapXml(
      createMockEnv({
        DB: createMockDb({
          all: (sql) => {
            if (sql.includes('FROM matches m')) {
              return {
                results: [
                  {
                    id: 'm-null-date',
                    kickoff_utc: null,
                    stage: null,
                    group_code: null,
                    home_name: 'Alpha',
                    away_name: 'Beta',
                  },
                ],
              };
            }
            if (sql.includes('FROM teams WHERE id LIKE')) {
              return { results: [{ id: 'team-1' }] };
            }
            if (sql.includes('FROM source_documents')) {
              return { results: [{ id: 'doc-1', published_at: null }] };
            }
            return { results: [] };
          },
        }),
      }),
      'https://pitchintel.test',
    );
    expect(sitemapDynamic).toContain('/teams/team-1');
    expect(sitemapDynamic).toContain('/news-intelligence/doc-1');

    const noDataReport = await runScenarioBacktest(
      createMockEnv({
        DB: createMockDb({
          all: () => ({ results: [] }),
          run: () => ({ success: true }),
        }),
        R2_ARTIFACTS: { put: vi.fn(async () => undefined) } as never,
      }),
      2026,
    );
    expect(noDataReport.matchCount).toBe(0);

    const bucketedReport = await runScenarioBacktest(
      createMockEnv({
        DB: createMockDb({
          all: () => ({
            results: [
              {
                id: 'm-away',
                home_score: 0,
                away_score: 1,
                home_win_prob: 0.3,
                draw_prob: 0.3,
                away_win_prob: 0.4,
              },
            ],
          }),
          run: () => ({ success: true }),
        }),
        R2_ARTIFACTS: { put: vi.fn(async () => undefined) } as never,
      }),
      2026,
    );
    expect(bucketedReport.calibrationBuckets[0]?.bucket).toBe('0-0.45');

    expect(
      await listWebhooks(
        createMockEnv({
          DB: createMockDb({
            all: () => ({} as never),
          }),
        }),
        'client-1',
      ),
    ).toEqual([]);
    expect(
      await listWebhooks(
        createMockEnv({
          DB: createMockDb({
            all: () => ({
              results: [
                {
                  id: 'wh-1',
                  client_id: 'client-1',
                  url: 'https://example.com/hook',
                  events_json: '{}',
                  enabled: 0,
                  created_at: '2026-01-01T00:00:00Z',
                },
              ],
            }),
          }),
        }),
        'client-1',
      ),
    ).toEqual([
      {
        id: 'wh-1',
        clientId: 'client-1',
        url: 'https://example.com/hook',
        events: ['*'],
        enabled: false,
        createdAt: '2026-01-01T00:00:00Z',
      },
    ]);
    expect(
      await deleteWebhook(
        createMockEnv({
          DB: createMockDb({
            run: () => ({ meta: {} }),
          }),
        }),
        'client-1',
        'wh-1',
      ),
    ).toBe(false);

    await expect(
      enqueueWebhookDeliveries(createMockEnv(), {
        id: 7,
        type: 'match.completed',
        matchId: 'm-1',
        createdAt: '2026-01-01T00:00:00Z',
        data: {},
      } as never),
    ).resolves.toBeUndefined();

    const queueSend = vi.fn(async () => undefined);
    await enqueueWebhookDeliveries(
      createMockEnv({
        INGEST_QUEUE: { send: queueSend } as never,
        DB: createMockDb({
          all: () => ({} as never),
        }),
      }),
      {
        id: 8,
        type: 'match.completed',
        matchId: 'm-2',
        createdAt: '2026-01-01T00:00:00Z',
        data: {},
      } as never,
    );
    expect(queueSend).not.toHaveBeenCalled();
  });

  it('covers additional translateNews, newsImagePipeline, and matchStats branches', async () => {
    const { translateNewsHeadline } = await import('../src/ai/translateNews');
    const actualNewsImagePipeline = await vi.importActual<typeof import('../src/services/newsImagePipeline')>(
      '../src/services/newsImagePipeline',
    );
    const matchRef = await import('../src/services/matchRef');

    const emptyTitleEnv = createMockEnv({
      AI: {
        run: vi.fn(async () => ({ translated_text: '' })),
      } as never,
    });
    expect(await translateNewsHeadline(emptyTitleEnv, 'US wins opener', 'Summary body')).toBeNull();

    const blankSummaryEnv = createMockEnv({
      AI: {
        run: vi.fn(async (_model: string, input: { text?: string }) => ({
          translated_text: input.text === 'US wins opener' ? 'Hoa Ky thang dam' : '',
        })),
      } as never,
    });
    expect(await translateNewsHeadline(blankSummaryEnv, 'US wins opener', '   ')).toBeNull();

    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { status: 200 }))
        .mockResolvedValueOnce(new Response(null, { status: 500 }))
        .mockResolvedValueOnce(new Response(null, { status: 500 }))
        .mockResolvedValueOnce(
          new Response(new Uint8Array(100), {
            status: 200,
            headers: { 'content-type': 'application/octet-stream' },
          }),
        ),
    );
    expect(
      await actualNewsImagePipeline.compressAndStoreNewsImage(
        createMockEnv({ R2_ARTIFACTS: { put: vi.fn(async () => undefined) } as never }),
        'doc-pipeline-1',
        'https://cdn.example.com/thumb-a.jpg',
      ),
    ).toBeNull();
    expect(
      await actualNewsImagePipeline.compressAndStoreNewsImage(
        createMockEnv({ R2_ARTIFACTS: { put: vi.fn(async () => undefined) } as never }),
        'doc-pipeline-2',
        'https://cdn.example.com/thumb-b.jpg',
      ),
    ).toBeNull();

    vi.spyOn(matchRef, 'resolveMatchRef').mockResolvedValueOnce(null as never);
    expect(await getMatchStats(createMockEnv(), 'missing-ref')).toBeNull();

    vi.spyOn(matchRef, 'resolveMatchRef').mockResolvedValueOnce({
      ...FIXTURE_MATCH,
      id: 'm-stats-espn',
      slug: 'm-stats-espn',
      status: 'completed',
      minute: 90,
      home_team_id: 'team-home',
      away_team_id: 'team-away',
      home_score: 2,
      away_score: 1,
      fifa_match_id: 'fifa-stats',
    } as never);
    const stats = await getMatchStats(
      createMockEnv({
        MOCK_SOURCES: 'true',
        DB: createMockDb({
          first: (sql, binds) => {
            if (sql.includes('SELECT id, name FROM teams WHERE id = ?')) {
              return { id: binds[0], name: binds[0] === 'team-home' ? 'Home Team' : 'Away Team' };
            }
            if (sql.includes('SUM(CASE WHEN event_type')) {
              return { goals: 3, yellow_cards: 2, red_cards: 0, substitutions: 5 };
            }
            if (sql.includes('SELECT status, minute, home_score, away_score, updated_at FROM matches')) {
              return {
                status: 'completed',
                minute: 90,
                home_score: 2,
                away_score: 1,
                updated_at: '2026-06-11T23:30:00Z',
              };
            }
            if (sql.includes('SELECT 1 FROM match_recaps')) return null;
            return null;
          },
          all: (sql) => {
            if (sql.includes('FROM team_match_stats')) {
              return {
                results: [
                  {
                    team_id: 'team-home',
                    possession: 61,
                    shots: 12,
                    shots_on_target: 5,
                    xg: 1.5,
                    passes: 420,
                    pass_accuracy: 88,
                    created_at: null,
                  },
                ],
              };
            }
            return { results: [] };
          },
        }),
      }),
      'm-stats-espn',
    );
    expect(stats?.dataSourceLabel).toBe('FIFA Match Centre / ESPN');
    expect(stats?.updatedAt).toBe('2026-06-11T23:30:00Z');
  });
});
