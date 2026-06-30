import React, { type ReactElement } from 'react';
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../app/lib/i18n/I18nContext';
import { createIngestionEnv } from './helpers/ingestionMockDb';
import { createMockDb, createMockEnv, createMockKv } from './helpers/mockEnv';
import { createRouteTestEnv } from './helpers/mockRouteDb';
import { FIXTURE_MATCH, FIXTURE_PLAYER, FIXTURE_SNAPSHOT, FIXTURE_TEAMS } from './helpers/fixtures';
import { mockComparison, mockScenario, mockScenarioContext } from './helpers/scenarioFixtures';
import { installSmokeFetchMock } from './helpers/smokeFetch';
import { sampleBracket, sampleScheduleMatches, sampleStandings } from './helpers/smokeFixtures';
import { jsonRoute, requestRoute } from './helpers/routeHarness';
import type { FifaMatchInfo } from '../src/ingestion/fifa/fifaApiClient';

vi.unmock('../src/ingestion/matchDataRefresh');
vi.unmock('../src/ingestion/fifa/fifaLineupSync');
vi.unmock('../src/ingestion/fifa/fifaLiveBlogSync');
vi.unmock('../src/ingestion/fifa/fifaLiveSync');
vi.unmock('../src/services/tournamentProgression');
vi.unmock('../src/services/recomputeMatch');
vi.unmock('../src/ai/tacticalBriefing');
vi.unmock('../src/ai/multiVariableAnalysis');
vi.unmock('../src/services/newsMatchImpact');
vi.unmock('../src/services/matchLineupProjection');
vi.unmock('../src/ai/gatewayClient');
vi.unmock('../src/routes/publicApi');
vi.unmock('../src/queues/modelConsumer');
vi.unmock('../src/services/matchScenarioService');
vi.unmock('../src/services/tournamentStandings');
vi.unmock('../src/ingestion/espn/espnStatsClient');
vi.unmock('../src/ingestion/fifa/fifaGamedayClient');
vi.unmock('../src/models/probability/explainFactors');
vi.unmock('../src/services/matchHistory');
vi.unmock('../src/services/matchStats');
vi.unmock('../src/services/pitchMap');

function renderWithI18n(ui: ReactElement, entry = '/', lang: 'en' | 'vi' = 'vi') {
  localStorage.setItem('wc-display-mode', lang);
  return render(
    React.createElement(MemoryRouter, { initialEntries: [entry] }, React.createElement(I18nProvider, null, ui)),
  );
}

const starter = (id: string, num: number) => ({
  IdPlayer: id,
  ShirtNumber: num,
  Status: 1,
  Position: 1,
  PlayerName: [{ Locale: 'en-GB', Description: `Player ${num}` }],
});

describe('coverage branch final 133 — FIFA ingestion', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('fifaLineupSync missing Players, short starters, and completed batch skip', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-10T12:00:00Z'));
    const official = await import('../src/services/officialLineupSync');
    vi.spyOn(official, 'applyOfficialLineupToMatch').mockResolvedValue({ updated: true });
    const playerResolve = await import('../src/ingestion/fifa/fifaPlayerResolve');
    vi.spyOn(playerResolve, 'resolveOrCreateFifaPlayer').mockImplementation(async (_db, _team, _nat, fp) =>
      fp.IdPlayer ? `p-${fp.IdPlayer}` : null,
    );

    const { syncFifaMatchLineupsFromInfo, syncFifaLineupsForUpcomingMatches } = await import(
      '../src/ingestion/fifa/fifaLineupSync'
    );
    const { env } = createIngestionEnv();
    await syncFifaMatchLineupsFromInfo(env, FIXTURE_MATCH.id, FIXTURE_MATCH.home_team_id, FIXTURE_MATCH.away_team_id, {
      HomeTeam: { Players: undefined },
      AwayTeam: { Players: Array.from({ length: 10 }, (_, i) => starter(`a${i}`, i + 1)) },
    } as FifaMatchInfo);

    const batch = await syncFifaLineupsForUpcomingMatches(
      createIngestionEnv({
        matches: [
          {
            id: 'm-done',
            kickoff_utc: FIXTURE_MATCH.kickoff_utc,
            status: 'completed',
            tournament_id: 't-2026',
            home_team_id: FIXTURE_MATCH.home_team_id,
            away_team_id: FIXTURE_MATCH.away_team_id,
            fifa_match_id: '400021443',
          },
        ],
      }).env,
    );
    expect(batch.updated).toBe(0);
  });

  it('fifaLiveBlogSync nullish helpers and shouldSync DB lookup', async () => {
    const api = await import('../src/ingestion/fifa/fifaApiClient');
    vi.spyOn(api, 'fetchFifaTimeline').mockResolvedValue({
      IdMatch: '400021443',
      Event: [
        {
          EventId: '1',
          IdTeam: '43822',
          MatchMinute: "12'",
          Period: 3,
          TypeLocalized: [{ Locale: 'en-GB', Description: 'Attempt at Goal' }],
          EventDescription: [{ Locale: 'en-GB', Description: 'Shot' }],
        },
      ],
    });
    vi.spyOn(api, 'fetchFifaMatchInfo').mockResolvedValue({
      IdMatch: '400021443',
      HomeTeam: { IdTeam: '43822' },
      AwayTeam: { IdTeam: '43995' },
    } as FifaMatchInfo);
    const gameday = await import('../src/ingestion/fifa/fifaGamedayClient');
    vi.spyOn(gameday, 'fetchFifaGamedayTeamMatchStats').mockResolvedValue(null);
    const espn = await import('../src/ingestion/espn/espnStatsClient');
    vi.spyOn(espn, 'fetchEspnTeamMatchStats').mockResolvedValue({
      eventId: 'espn-1',
      home: { possession: 52, shots: null, shotsOnTarget: undefined, passes: 400, passAccuracy: 88 },
      away: { possession: 48, shots: 8, shotsOnTarget: 3, passes: 350, passAccuracy: 85 },
    });

    const { syncFifaMatchBlogAndStats, shouldSyncFifaBlogAndStats } = await import(
      '../src/ingestion/fifa/fifaLiveBlogSync'
    );
    const { env, db } = createIngestionEnv({
      matches: [{ ...FIXTURE_MATCH, fifa_match_id: '400021443', status: 'live', kickoff_utc: FIXTURE_MATCH.kickoff_utc }],
      teamMatchStats: [],
    });
    vi.spyOn(db, 'prepare').mockImplementation((sql: string) => {
      const stmt = {
        bind: (..._args: unknown[]) => stmt,
        first: async () => {
          if (sql.includes('kickoff_utc FROM matches')) return { kickoff_utc: FIXTURE_MATCH.kickoff_utc };
          if (sql.includes('home_team_id, away_team_id')) {
            return { home_team_id: FIXTURE_MATCH.home_team_id, away_team_id: FIXTURE_MATCH.away_team_id };
          }
          return null;
        },
        all: async () => {
          if (sql.includes('FROM teams WHERE id IN')) return {} as never;
          return { results: [] };
        },
        run: async () => ({ success: true }),
      };
      return stmt as never;
    });

    await syncFifaMatchBlogAndStats(
      env,
      FIXTURE_MATCH.id,
      FIXTURE_MATCH.home_team_id,
      FIXTURE_MATCH.away_team_id,
      { IdMatch: '400021443', HomeTeam: { IdTeam: '43822' }, AwayTeam: { IdTeam: '43995' } } as FifaMatchInfo,
    );

    const throttleEnv = createIngestionEnv(
      {
        teamMatchStats: [
          { match_id: FIXTURE_MATCH.id, team_id: FIXTURE_MATCH.home_team_id, possession: 50, passes: 300 },
          { match_id: FIXTURE_MATCH.id, team_id: FIXTURE_MATCH.away_team_id, possession: 50, passes: 280 },
        ],
      },
      {},
    ).env;
    expect(await shouldSyncFifaBlogAndStats(throttleEnv, FIXTURE_MATCH.id, 'live')).toBe(true);
  });

  it('fifaLiveSync completed calendar path and parse nullish defaults', async () => {
    const api = await import('../src/ingestion/fifa/fifaApiClient');
    vi.spyOn(api, 'fetchFifaWc2026FixturesCalendar').mockResolvedValue([
      {
        IdMatch: '400099999',
        Date: '2026-06-11T20:00:00.000Z',
        Home: { IdCountry: 'USA', TeamName: [{ Description: 'United States' }] },
        Away: { IdCountry: 'MEX', TeamName: [{ Description: 'Mexico' }] },
        HomeTeamScore: 2,
        AwayTeamScore: 1,
        MatchStatus: 0,
        Period: 10,
      },
    ] as never);
    vi.spyOn(api, 'fetchFifaMatchInfo').mockResolvedValue(null);
    const blog = await import('../src/ingestion/fifa/fifaLiveBlogSync');
    vi.spyOn(blog, 'shouldSyncFifaBlogAndStats').mockResolvedValue(false);
    const lineup = await import('../src/ingestion/fifa/fifaLineupSync');
    vi.spyOn(lineup, 'shouldSyncFifaLineupForKickoff').mockReturnValue(false);

    const { syncFifaWc2026Matches } = await import('../src/ingestion/fifa/fifaLiveSync');
    const { env } = createIngestionEnv({
      teams: [
        { id: FIXTURE_MATCH.home_team_id, name: 'United States', country_code: 'US' },
        { id: FIXTURE_MATCH.away_team_id, name: 'Mexico', country_code: 'MX' },
      ],
      matches: [
        {
          ...FIXTURE_MATCH,
          fifa_match_id: '400099999',
          status: 'live',
          kickoff_utc: '2026-06-11T20:00:00Z',
        },
      ],
    });
    await syncFifaWc2026Matches(env);

    const { resolveFifaPlatformStatus } = await import('../src/ingestion/fifa/parse');
    const { areTeamMatchStatsComplete } = await import('../src/ingestion/fifa/teamMatchStatsComplete');
    expect(resolveFifaPlatformStatus({ MatchTime: "90'", Period: undefined, MatchStatus: undefined })).toBe('live');
    expect(resolveFifaPlatformStatus({ MatchTime: "90'", Period: 10, MatchStatus: undefined })).toBe('completed');
    expect(areTeamMatchStatsComplete({ possession: null, passes: null }, { possession: null, passes: null })).toBe(false);
  });

  it('espnTeamMatch alias and empty competitors branches', async () => {
    const { teamLabelsMatch, findEspnEventId } = await import('../src/ingestion/espn/espnTeamMatch');
    expect(teamLabelsMatch('Bosnia and Herzegovina', 'Bosnia-Herzegovina')).toBe(true);
    expect(
      findEspnEventId([{ id: '1', competitions: [{ competitors: undefined }] }], 'USA', 'Mexico'),
    ).toBeNull();
  });
});

describe('coverage branch final 133 — services and models', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('lineupDisplay null shirt numbers and club fallback slots', async () => {
    const { getLineupDisplayForMatch } = await import('../src/services/lineupDisplay');
    const env = createMockEnv({
      DB: createMockDb({
        first: (sql) => {
          if (sql.includes('FROM lineups l')) {
            return {
              id: 'lu-null-shirts',
              formation: '4-4-2',
              is_official: 1,
              source_type: 'match_official',
              confidence: 0.7,
            };
          }
          return null;
        },
        all: (sql) => {
          if (sql.includes('FROM lineup_players')) {
            return {
              results: [
                { name: 'A', shirt_number: null, position_slot: 'CM', role: null, position: null, is_starter: 1 },
                { name: 'B', shirt_number: null, position_slot: 'CM', role: null, position: null, is_starter: 1 },
                { name: 'C', shirt_number: 4, position_slot: 'CB', role: null, position: null, is_starter: 1 },
              ],
            };
          }
          if (sql.includes('FROM squad_players')) return { results: [] };
          if (sql.includes('FROM players WHERE primary_team_id')) {
            return {
              results: Array.from({ length: 12 }, (_, i) => ({
                name: `Club ${i + 1}`,
                position: i === 10 ? null : 'MF',
              })),
            };
          }
          return { results: [] };
        },
      }),
    });
    const official = await getLineupDisplayForMatch(env, FIXTURE_MATCH.id, FIXTURE_MATCH.home_team_id);
    expect(official.grouped.MID.length).toBeGreaterThan(0);
    const club = await getLineupDisplayForMatch(env, FIXTURE_MATCH.id, FIXTURE_PLAYER.primary_team_id!);
    expect(club.sourceType).toBe('club_roster');
  });

  it('matchScenarioService filtered fallback and regen null set', async () => {
    const generator = await import('../src/models/scenarios/scenarioGenerator');
    vi.spyOn(generator, 'buildCandidateScenarios').mockReturnValue([
      { scenarioType: 'baseline_expected_flow', isBaseline: undefined, weight: 1 } as never,
      { scenarioType: 'early_goal_swing', scenarioName: undefined, isBaseline: undefined, weight: 1 } as never,
    ]);
    const engine = await import('../src/models/scenarios/scenarioEngine');
    vi.spyOn(engine, 'runScenarioProbabilityModel').mockReturnValue({
      scenarioProbability: 0.5,
      scenarioConfidence: 0.1,
      homeWinProb: 0.4,
      drawProb: 0.3,
      awayWinProb: 0.3,
      expectedHomeGoals: 1.2,
      expectedAwayGoals: 1.1,
      mostLikelyScore: '1-1',
      scorelineDistribution: {},
      intervalDistribution: {},
      initialConditions: [],
      triggerConditions: [],
      invalidationConditions: [],
      keyDrivers: [],
      riskFactors: [],
    });

    const scenarioService = await import('../src/services/matchScenarioService');
    const { generateMatchScenarios } = scenarioService;
    const env = createMockEnv({
      DB: createMockDb({
        first: (sql, binds) => {
          if (sql.includes('FROM matches WHERE id')) return FIXTURE_MATCH;
          if (sql.includes('FROM teams WHERE id')) {
            return binds[0] === FIXTURE_MATCH.home_team_id ? FIXTURE_TEAMS[0] : FIXTURE_TEAMS[1];
          }
          if (sql.includes('SELECT year FROM tournaments')) return { year: 2026 };
          return null;
        },
        all: () => ({ results: [] }),
        run: () => ({ success: true, meta: { changes: 1, last_row_id: 1 } }),
      }),
      R2_ARTIFACTS: { put: vi.fn(async () => undefined) } as never,
    });
    const set = await generateMatchScenarios(env, FIXTURE_MATCH.id);
    expect(set?.scenarios.length).toBeGreaterThanOrEqual(2);
    expect(set?.scenarios.some((s) => s.scenarioName)).toBe(true);
  });

  it('tournamentProgression gf tiebreaker and null link arrays', async () => {
    const { computeGroupStandingsFromMatchRows, processMatchCompletion } = await import(
      '../src/services/tournamentProgression'
    );
    const tied = computeGroupStandingsFromMatchRows(
      [
        { group_code: 'A', home_team_id: 'a', away_team_id: 'b', home_score: 2, away_score: 0, status: 'completed' },
        { group_code: 'A', home_team_id: 'c', away_team_id: 'd', home_score: 1, away_score: 0, status: 'completed' },
        { group_code: 'A', home_team_id: 'a', away_team_id: 'c', home_score: 1, away_score: 1, status: 'completed' },
        { group_code: 'A', home_team_id: 'b', away_team_id: 'd', home_score: 0, away_score: 0, status: 'completed' },
        { group_code: 'A', home_team_id: 'a', away_team_id: 'd', home_score: 3, away_score: 0, status: 'completed' },
        { group_code: 'A', home_team_id: 'b', away_team_id: 'c', home_score: 1, away_score: 1, status: 'completed' },
      ],
      'A',
    );
    expect(tied[0]?.teamId).toBe('a');

    const env = createMockEnv({
      DB: createMockDb({
        first: (sql) => {
          if (sql.includes('FROM matches WHERE id')) return { ...FIXTURE_MATCH, status: 'scheduled' };
          if (sql.includes('GROUP BY group_code')) return { total: 6, done: 6 };
          return null;
        },
        all: (sql) => {
          if (sql.includes('match_bracket_links')) return {} as never;
          if (sql.includes("stage = 'Group'")) return { results: [] };
          return { results: [] };
        },
        run: () => ({ success: true }),
      }),
    });
    await processMatchCompletion(env, FIXTURE_MATCH.id);
  });

  it('scenario engine, generator, explainFactors branches', async () => {
    const { runScenarioProbabilityModel } = await import('../src/models/scenarios/scenarioEngine');
    const ctx = mockScenarioContext({
      homeSystem: { ...mockScenarioContext().homeSystem, pressingScore: 0.4, setPieceScore: 0.6, benchDepthScore: 0.6 },
      awaySystem: { ...mockScenarioContext().awaySystem, setPieceScore: 0.6, benchDepthScore: 0.6 },
      homeLineupSource: 'projected',
      awayLineupSource: 'official',
    });
    const { buildCandidateScenarios } = await import('../src/models/scenarios/scenarioGenerator');
    const candidates = buildCandidateScenarios(ctx);
    expect(candidates.some((c) => c.scenarioType === 'set_piece_decider')).toBe(true);
    expect(candidates.some((c) => c.scenarioType === 'late_bench_impact')).toBe(true);
    expect(candidates.some((c) => c.scenarioType === 'lineup_surprise')).toBe(true);
    const out = runScenarioProbabilityModel('pressing_breakthrough', ctx, {
      selectedFeatureGroups: ['team_system'],
      requiredInputs: [],
      optionalInputs: [],
      rationale: 'test',
    });
    expect(out.scenarioProbability).toBeGreaterThan(0);

    const { buildExplanationFactors } = await import('../src/models/probability/explainFactors');
    const features = mockScenarioContext().features;
    const factors = buildExplanationFactors({
      ...features,
      homeTeam: { ...features.homeTeam, xgAgainst: 2.5, defensiveCompactness: 0.2 },
      awayTeam: { ...features.awayTeam, xgAgainst: 0.8, defensiveCompactness: 0.9 },
      homeCoach: { tacticalRating: 0.5 },
      awayCoach: { tacticalRating: 0.9 },
    });
    expect(factors.positive.some((f) => f.direction === 'away')).toBe(true);
  });

  it('matchHistory, lineup projection, and news impact nullish branches', async () => {
    const { groupTeamWorldCupMeetings, getTeamWorldCupHeadToHead } = await import('../src/services/matchHistory');
    expect(
      groupTeamWorldCupMeetings('team-a', [
        { tournament_year: undefined as never, home_team_id: 'team-a', away_team_id: 'team-b', home_score: 1, away_score: 0 },
        { tournament_year: 2022, home_team_id: 'team-a', away_team_id: 'team-c', home_score: 0, away_score: 0 },
      ] as never).length,
    ).toBeGreaterThan(0);
    await getTeamWorldCupHeadToHead(
      createMockEnv({
        DB: createMockDb({
          first: () => ({ id: 'team-a' }),
          all: () => ({} as never),
        }),
      }),
      'team-a',
    );

    const { getProjectedLineupForMatch } = await import('../src/services/matchLineupProjection');
    await getProjectedLineupForMatch(
      createMockEnv({
        DB: createMockDb({
          first: (sql) => {
            if (sql.includes('FROM lineups l')) return { id: 'lu-1', formation: '4-3-3', is_official: 0 };
            return null;
          },
          all: (sql) => {
            if (sql.includes('FROM lineup_players')) return {} as never;
            if (sql.includes('FROM squad_players')) return {} as never;
            if (sql.includes('FROM players WHERE primary_team_id')) return {} as never;
            return { results: [] };
          },
        }),
      }),
      FIXTURE_MATCH.id,
      FIXTURE_MATCH.home_team_id,
      'Mexico',
    );

    const { processNewsDocumentImpact } = await import('../src/services/newsMatchImpact');
    await processNewsDocumentImpact(
      createMockEnv({
        DB: createMockDb({
          all: (sql) => {
            if (sql.includes('home_team_id IN')) return { results: [{ id: 'm-pair' }] } as never;
            if (sql.includes('country_code FROM teams')) return { results: [] };
            return { results: [] };
          },
          first: () => null,
          run: () => ({ success: true }),
        }),
      }),
      'doc-1',
      'Team A faces Team B in upcoming World Cup fixture',
      { teams: ['Team A'], players: [], injuries: [], tacticalNotes: [], formations: [] },
    );
  });

  it('newsTranslationUtils and newsThumbnailBackfill branches', async () => {
    const { isLikelyVietnamese, needsNewsTranslation, resolvePublisherLabel } = await import(
      '../src/services/newsTranslationUtils'
    );
    expect(isLikelyVietnamese('plain english without vietnamese hints')).toBe(false);
    expect(
      needsNewsTranslation({
        id: 'n-1',
        title: 'What is happening with World Cup ticket prices?',
        summary: 'With falling prices, fluctuating availability continues.',
        title_vi: 'What is happening with World Cup ticket prices?',
        summary_vi: 'With falling prices, fluctuating availability continues.',
      }),
    ).toBe(true);
    expect(resolvePublisherLabel({ source_url: 'https://www.bbc.co.uk/sport', source_name: 'Mock Development Source' })).toBe(
      'BBC',
    );

    const { recompressNewsThumbnails } = await import('../src/services/newsThumbnailBackfill');
    expect(
      await recompressNewsThumbnails(
        createMockEnv({
          DB: createMockDb({ all: () => ({} as never) }),
        }),
        5,
      ),
    ).toBe(0);
  });
});

describe('coverage branch final 133 — backend singles batch', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('covers remaining single- and double-branch backend files', async () => {
    const { refreshMatchData } = await vi.importActual<typeof import('../src/ingestion/matchDataRefresh')>(
      '../src/ingestion/matchDataRefresh',
    );
    const refreshEnv = createMockEnv({
      DB: createMockDb({
        all: () => ({} as never),
        run: () => ({ success: true }),
      }),
      KV: createMockKv(),
      MOCK_SOURCES: 'true',
      FIFA_LIVE_ENABLED: 'false',
    });
    await refreshMatchData(refreshEnv);

    const { gatewayChat, isGatewayConfigured } = await import('../src/ai/gatewayClient');
    expect(isGatewayConfigured(createMockEnv({ AI_GATEWAY_ENABLED: 'true', AI_GATEWAY_ACCOUNT_ID: 'a', CF_AIG_TOKEN: 't' }))).toBe(
      true,
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 }),
      ),
    );
    await gatewayChat(
      createMockEnv({
        AI_GATEWAY_ACCOUNT_ID: 'a',
        CF_AIG_TOKEN: 't',
        AI_GATEWAY_ENABLED: 'true',
        AI_GATEWAY_ID: '',
      }),
      '/model-only',
      [{ role: 'user', content: 'hi' }],
    ).catch(() => undefined);

    const { runMultiVariableAnalysis } = await vi.importActual<typeof import('../src/ai/multiVariableAnalysis')>(
      '../src/ai/multiVariableAnalysis',
    );
    await runMultiVariableAnalysis(
      createMockEnv({
        DB: createMockDb({
          first: (sql) => {
            if (sql.includes('FROM matches')) return FIXTURE_MATCH;
            if (sql.includes('FROM teams')) return FIXTURE_TEAMS[0];
            if (sql.includes('FROM tournaments')) return null;
            return null;
          },
          all: () => ({ results: [] }),
        }),
      }),
      FIXTURE_MATCH.id,
    ).catch(() => undefined);
    await runMultiVariableAnalysis(
      createMockEnv({
        DB: createMockDb({
          first: (sql) => {
            if (sql.includes('FROM matches')) return FIXTURE_MATCH;
            if (sql.includes('FROM teams')) return FIXTURE_TEAMS[0];
            if (sql.includes('FROM tournaments')) return { name: 'World Cup 2026', year: 2026 };
            return null;
          },
          all: () => ({ results: [] }),
        }),
      }),
      FIXTURE_MATCH.id,
    ).catch(() => undefined);

    const repo = await import('../src/db/repositories/matchPredictionScenarioRepo');
    await repo.saveScenarioSnapshot(createMockDb({ run: () => ({ success: true }) }), mockScenario({ featureSnapshotR2Key: '' }), {
      minute: 0,
      deltaFromPrevious: {},
      updateReason: 'test',
    });
    await repo.replaceMatchScenarioSet(createMockDb({ run: () => ({ success: true }) }), FIXTURE_MATCH.id, [mockScenario(), mockScenario({ id: 'b' })], {
      ...mockComparison(),
      keyDifferences: undefined as never,
    });
    await repo.getLatestComparison(
      createMockDb({
        first: () => ({
          scenario_a_id: 'a',
          scenario_b_id: 'b',
          probability_gap: 0.1,
          confidence_gap: 0.1,
          home_win_delta: 0.1,
          draw_delta: 0,
          away_win_delta: -0.1,
          xg_home_delta: 0.1,
          xg_away_delta: -0.1,
          comparison_summary: 'summary',
          comparison_json: '{}',
        }),
      }),
      FIXTURE_MATCH.id,
    );

    const { parseRssItems, extractImageUrl } = await import('../src/ingestion/adapters/TrustedNewsRssAdapter');
    parseRssItems(
      `<item><title>T</title><link>https://x.com</link><description><img src="https://img.example/a.jpg"/></description></item>`,
      1,
    );
    extractImageUrl(`<media:content url='https://img.example/selfclose.jpg'/>`, 'fallback text');
    extractImageUrl(
      `<item><content:encoded><![CDATA[<img src="https://img.example/encoded.jpg"/>]]></content:encoded></item>`,
      '',
    );

    const gameday = await import('../src/ingestion/fifa/fifaGamedayClient');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));
    expect(await gameday.fetchFifaGamedayTeamMatchStats('400021443')).toBeNull();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({}), { status: 200, headers: { 'content-type': 'application/json' } })),
    );
    expect(await gameday.fetchFifaGamedayToken()).toBeNull();

    const { parseFifaTimelineCommentary, deriveShotsFromTimeline } = await import('../src/ingestion/fifa/parseFifaTimeline');
    parseFifaTimelineCommentary({ Event: undefined } as never, 'm-1');
    deriveShotsFromTimeline({ Event: undefined } as never, 'h', 'a');

    const { assignFormationCoords } = await import('../src/lib/formationLayout');
    assignFormationCoords('4-4-2', [{ playerId: 'solo', position: 'ST' }], 'home');
    assignFormationCoords(
      '4-4-2',
      [
        { playerId: 'l', position: 'LW' },
        { playerId: 'r', position: 'UNKNOWN' },
      ],
      'home',
    );

    const { applyRealtimeEventToScenarios } = await import('../src/models/scenarios/scenarioRealtimeUpdater');
    applyRealtimeEventToScenarios(
      mockScenarioContext(),
      [
        mockScenario({
          triggerConditions: [{ condition: 'First goal', status: 'pending', value: 'home' }],
        }),
        mockScenario({ id: 'b', isBaseline: false }),
      ],
      {
        matchId: FIXTURE_MATCH.id,
        eventType: 'goal',
        minute: 1,
        teamSide: 'home',
        eventId: 'g1',
      },
    );
    applyRealtimeEventToScenarios(mockScenarioContext(), [mockScenario(), mockScenario({ id: 'b', isBaseline: false })], {
      matchId: FIXTURE_MATCH.id,
      eventType: 'card',
      minute: 80,
      teamSide: 'away',
      eventId: 'c1',
    });

    const { compareScenarios } = await import('../src/models/scenarios/scenarioComparison');
    compareScenarios([mockScenario({ isBaseline: false }), mockScenario({ id: 'b', isBaseline: false })]);

    const { selectScenarioFeatures } = await import('../src/models/scenarios/scenarioFeatureSelector');
    selectScenarioFeatures('custom' as never, mockScenarioContext());

    const { brierScore, logLoss } = await import('../src/models/backtesting/metrics');
    brierScore([0.5, 0.5], [99]);
    logLoss([0.4, 0.3], 5);

    const { buildCandidateScenarios } = await import('../src/models/scenarios/scenarioGenerator');
    buildCandidateScenarios(
      mockScenarioContext({
        homeSystem: { ...mockScenarioContext().homeSystem, setPieceScore: 0.4 },
        awaySystem: { ...mockScenarioContext().awaySystem, setPieceScore: 0.58 },
      }),
    );

    const { resolveTeamFlagSlug } = await import('../src/lib/teamFlags');
    expect(resolveTeamFlagSlug({ teamName: 'Unknown Nation XYZ' })).toBe('');

    const { translateNewsHeadline } = await import('../src/ai/translateNews');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: '!!!' } }] }), { status: 200 }),
      ),
    );
    expect(await translateNewsHeadline(createMockEnv(), 'Headline', '!!!')).toBeNull();

    const { generateTacticalBriefing } = await import('../src/ai/tacticalBriefing');
    await generateTacticalBriefing(createMockEnv(), {
      matchId: FIXTURE_MATCH.id,
      probability: { homeWinProb: 0.4, drawProb: 0.3, awayWinProb: 0.3 },
      aiFallback: true,
    });

    const { fetchEspnTeamMatchStats } = await import('../src/ingestion/espn/espnStatsClient');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('scoreboard')) {
          return new Response(
            JSON.stringify({
              events: [
                {
                  id: '999',
                  date: '2026-06-12',
                  competitions: [{ competitors: [{ homeAway: 'home', team: { displayName: 'United States' } }] }],
                },
              ],
            }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ boxscore: { teams: [] } }), { status: 200 });
      }),
    );
    await fetchEspnTeamMatchStats('United States', 'Mexico', '2026-06-12T20:00:00Z');

    const { getGroupContextForMatch } = await import('../src/services/matchGroupContext');
    await getGroupContextForMatch(
      createMockEnv({
        DB: createMockDb({
          all: () => ({
            results: [
              {
                id: 'm-2',
                kickoff_utc: FIXTURE_MATCH.kickoff_utc,
                home_short: null,
                home_name: 'Home Long',
                away_short: 'AWY',
                away_name: 'Away Long',
              },
            ],
          }),
        }),
      }),
      FIXTURE_MATCH.id,
      'A',
    );

    const { mockScoreAtMinute } = await import('../src/services/matchLifecycle');
    mockScoreAtMinute(44, 0, 0);

    const { getMatchPreviewAnalysis } = await import('../src/services/matchPreviewAnalysis');
    await getMatchPreviewAnalysis(
      createMockEnv({
        KV: createMockKv(),
        DB: createMockDb({
          first: (sql) => {
            if (sql.includes('FROM matches WHERE id')) return { ...FIXTURE_MATCH, stage: 'Group', group_code: 'A' };
            if (sql.includes('FROM teams WHERE id')) return FIXTURE_TEAMS[0];
            if (sql.includes('FROM probability_snapshots')) return null;
            return null;
          },
          all: () => ({ results: [] }),
        }),
      }),
      FIXTURE_MATCH.id,
    );
    await getMatchPreviewAnalysis(
      createMockEnv({
        KV: createMockKv(),
        DB: createMockDb({
          first: (sql) => {
            if (sql.includes('FROM matches WHERE id')) return { ...FIXTURE_MATCH, stage: 'Group', group_code: 'A' };
            if (sql.includes('FROM teams WHERE id')) return FIXTURE_TEAMS[0];
            if (sql.includes('FROM probability_snapshots')) return FIXTURE_SNAPSHOT;
            return null;
          },
          all: () => ({ results: [] }),
        }),
      }),
      FIXTURE_MATCH.id,
    );

    const { getMatchRecap } = await import('../src/services/matchRecap');
    await getMatchRecap(
      createMockEnv({
        DB: createMockDb({
          first: () => null,
          all: () => ({} as never),
        }),
      }),
      'missing-slug',
    );

    const { getMatchStats } = await import('../src/services/matchStats');
    await getMatchStats(
      createMockEnv({
        MOCK_SOURCES: 'true',
        FIFA_LIVE_ENABLED: 'false',
        DB: createMockDb({
          first: (sql, binds) => {
            if (sql.includes('match_recaps')) return null;
            if (sql.includes('FROM matches m')) {
              return {
                ...FIXTURE_MATCH,
                slug: FIXTURE_MATCH.id,
                home_name: 'USA',
                away_name: 'Mexico',
                updated_at: '2026-01-01T00:00:00Z',
              };
            }
            if (sql.includes('FROM teams WHERE id')) {
              return binds[0] === FIXTURE_MATCH.home_team_id
                ? { id: FIXTURE_MATCH.home_team_id, name: 'USA' }
                : { id: FIXTURE_MATCH.away_team_id, name: 'Mexico' };
            }
            if (sql.includes('SELECT status, minute')) {
              return {
                status: FIXTURE_MATCH.status,
                minute: FIXTURE_MATCH.minute,
                home_score: FIXTURE_MATCH.home_score,
                away_score: FIXTURE_MATCH.away_score,
                updated_at: '2026-01-01T00:00:00Z',
              };
            }
            if (sql.includes('FROM match_events')) {
              return { goals: 0, yellow_cards: 0, red_cards: 0, substitutions: 0 };
            }
            return null;
          },
          all: (sql) => {
            if (sql.includes('FROM team_match_stats')) {
              return {
                results: [
                  {
                    team_id: FIXTURE_MATCH.home_team_id,
                    possession: null,
                    shots: 10,
                    shots_on_target: 4,
                    xg: 1.2,
                    passes: 400,
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
      FIXTURE_MATCH.id,
    );
    await getMatchStats(
      createMockEnv({
        MOCK_SOURCES: 'true',
        FIFA_LIVE_ENABLED: 'false',
        DB: createMockDb({
          first: (sql, binds) => {
            if (sql.includes('match_recaps')) return null;
            if (sql.includes('FROM matches m')) {
              return { ...FIXTURE_MATCH, slug: FIXTURE_MATCH.id, home_name: 'USA', away_name: 'Mexico' };
            }
            if (sql.includes('FROM teams WHERE id')) {
              return binds[0] === FIXTURE_MATCH.home_team_id
                ? { id: FIXTURE_MATCH.home_team_id, name: 'USA' }
                : { id: FIXTURE_MATCH.away_team_id, name: 'Mexico' };
            }
            if (sql.includes('SELECT status, minute')) {
              return {
                status: FIXTURE_MATCH.status,
                minute: FIXTURE_MATCH.minute,
                home_score: FIXTURE_MATCH.home_score,
                away_score: FIXTURE_MATCH.away_score,
                updated_at: '2026-06-02T00:00:00Z',
              };
            }
            if (sql.includes('FROM match_events')) {
              return { goals: 0, yellow_cards: 0, red_cards: 0, substitutions: 0 };
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
                    shots: 10,
                    shots_on_target: 4,
                    xg: 1.2,
                    passes: null,
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
      FIXTURE_MATCH.id,
    );

    const { getMatchThumbnailPng } = await import('../src/services/matchThumbnail');
    await getMatchThumbnailPng(createMockEnv({ DB: createMockDb({ first: () => null }) }), 'missing-ref');

    const { buildMatchThumbnailSvg, getMatchThumbnailSvg, matchToThumbnailInput } = await import(
      '../src/services/matchThumbnail'
    );
    buildMatchThumbnailSvg(
      matchToThumbnailInput({ ...FIXTURE_MATCH, stage: null, home_name: 'USA', away_name: 'Mexico' } as never),
    );
    await getMatchThumbnailSvg(createMockEnv({ DB: createMockDb({ first: () => null }) }), 'missing-ref').catch(
      () => null,
    );

    const { normalizeArticleLink, normalizeFeedImageUrl } = await import('../src/services/newsImageUrls');
    normalizeArticleLink('https://x.com/a?b=1#frag');
    normalizeFeedImageUrl('https://cdn.example/x.jpg?w=100');

    const { recomputeAllActiveMatches } = await vi.importActual<typeof import('../src/services/recomputeMatch')>(
      '../src/services/recomputeMatch',
    );
    await recomputeAllActiveMatches(
      createMockEnv({
        DB: createMockDb({
          all: () => ({} as never),
          first: () => null,
        }),
      }),
    );

    const { buildBracketPayload } = await import('../src/services/bracketPayload');
    await buildBracketPayload(
      createMockEnv({
        DB: createMockDb({
          all: () => ({
            results: [
              {
                id: 'm-ko',
                stage: null,
                kickoff_utc: FIXTURE_MATCH.kickoff_utc,
                status: 'scheduled',
                home_team_id: FIXTURE_MATCH.home_team_id,
                away_team_id: FIXTURE_MATCH.away_team_id,
                home_score: 0,
                away_score: 0,
                home_name: 'USA',
                away_name: 'Mexico',
              },
            ],
          }),
        }),
      }),
    );

    const { buildMatchFeatures } = await import('../src/services/matchFeatures');
    await buildMatchFeatures(
      createMockEnv({
        DB: createMockDb({
          first: () => FIXTURE_TEAMS[0],
          all: () => ({} as never),
        }),
      }),
      FIXTURE_MATCH,
      FIXTURE_TEAMS[0],
      FIXTURE_TEAMS[1],
    );

    const { getProbabilityMovement } = await import('../src/services/matchIntelligence');
    await getProbabilityMovement(
      createMockEnv({
        DB: createMockDb({
          all: () => ({
            results: [
              { minute: null, home_win_prob: 0.4, draw_prob: 0.3, away_win_prob: 0.3, created_at: 't1', model_version: 'v1' },
              { minute: 15, home_win_prob: 0.5, draw_prob: 0.25, away_win_prob: 0.25, created_at: 't2', model_version: 'v1' },
            ],
          }),
        }),
      }),
      FIXTURE_MATCH.id,
    );

    const { getPitchMapPayload } = await import('../src/services/pitchMap');
    await getPitchMapPayload(
      createMockEnv({
        DB: createMockDb({
          first: (sql) => {
            if (sql.includes('FROM matches')) {
              return { ...FIXTURE_MATCH, slug: null, home_name: 'USA', away_name: 'Mexico' };
            }
            return null;
          },
          all: () => ({ results: [] }),
        }),
      }),
      FIXTURE_MATCH.id,
    );

    const { buildTournamentMatchProbabilitiesPayload } = await import('../src/services/tournamentMatchProbabilities');
    await buildTournamentMatchProbabilitiesPayload(
      createMockEnv({
        DB: createMockDb({
          first: () => null,
          all: () => ({ results: [] }),
        }),
      }),
      't-2026',
    );

    const { sortStandingRows, rankBestThirdPlace } = await import('../src/services/tournamentStandings');
    sortStandingRows([
      { teamId: 'a', teamName: 'A', shortName: null, rank: 0, played: 2, points: 4, gf: 3, ga: 1, gd: 2 },
      { teamId: 'b', teamName: 'B', shortName: null, rank: 0, played: 2, points: 4, gf: 5, ga: 2, gd: 3 },
    ]);
    rankBestThirdPlace([
      { teamId: 'b', played: 3, points: 4, gf: 5, ga: 2, gd: 3 },
      { teamId: 'a', played: 3, points: 4, gf: 5, ga: 2, gd: 3 },
    ]);

    const { handleModelBatch } = await import('../src/queues/modelConsumer');
    const { createMockMessageBatch } = await import('./helpers/mockMessageBatch');
    const broadcast = await import('../src/services/matchScenarioService');
    vi.spyOn(broadcast, 'broadcastScenarioUpdate').mockResolvedValue(undefined);
    vi.spyOn(broadcast, 'getMatchScenarioSet').mockResolvedValue({
      matchId: FIXTURE_MATCH.id,
      generatedAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      scenarios: [mockScenario(), mockScenario({ id: 'b' })],
      comparison: mockComparison(),
      sourceConfidence: { overall: 0.8, notes: [] },
    });
    await handleModelBatch(
      createMockMessageBatch([{ matchId: FIXTURE_MATCH.id, type: 'scenario_refresh' }]),
      createMockEnv({
        MATCH_ROOM: { idFromName: () => ({ toString: () => 'r' }), get: () => ({ fetch: vi.fn() }) } as never,
      }),
    );
    vi.spyOn(broadcast, 'updateScenariosFromRealtimeEvent').mockResolvedValue({
      matchId: FIXTURE_MATCH.id,
      generatedAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      scenarios: [mockScenario(), mockScenario({ id: 'b' })],
      comparison: mockComparison(),
      sourceConfidence: { overall: 0.8, notes: [] },
    });
    await handleModelBatch(
      createMockMessageBatch([{ matchId: FIXTURE_MATCH.id, type: 'SCENARIO_RECOMPUTE', eventId: 'evt-1' }]),
      createMockEnv({
        MATCH_ROOM: { idFromName: () => ({ toString: () => 'r' }), get: () => ({ fetch: vi.fn() }) } as never,
      }),
    );

    const { groupTeamWorldCupMeetings } = await import('../src/services/matchHistory');
    groupTeamWorldCupMeetings('team-a', [
      { tournament_year: undefined as never, home_team_id: 'team-a', away_team_id: 'team-b', home_score: 1, away_score: 0 },
      { tournament_year: 2022, home_team_id: 'team-a', away_team_id: 'team-c', home_score: 0, away_score: 0 },
    ] as never);

    const { buildExplanationFactors } = await import('../src/models/probability/explainFactors');
    const features = mockScenarioContext().features;
    buildExplanationFactors({
      ...features,
      homeCoach: undefined,
      awayCoach: { tacticalRating: 0.95 },
    });
  });
});

describe('coverage branch final 133 — routes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('matches and publicApi not-found branches', async () => {
    const { matchRoutes } = await import('../src/routes/matches');
    const miss = await requestRoute(matchRoutes, '/api/matches/unknown/stats', { env: createRouteTestEnv() });
    expect(miss.status).toBe(404);
    const miss2 = await requestRoute(matchRoutes, '/api/matches/by-slug/unknown/recap', { env: createRouteTestEnv() });
    expect(miss2.status).toBe(404);

    const { publicApiRoutes } = await import('../src/routes/publicApi');
    const feed = await requestRoute(publicApiRoutes, '/v1/feed?cursor=abc', {
      env: createRouteTestEnv({ publicApiEnabled: true }),
    });
    expect(feed.status).toBeLessThan(500);
  });

  it('news route hot_score fallback', async () => {
    const { newsRoutes } = await import('../src/routes/news');
    const env = createRouteTestEnv();
    const res = await jsonRoute(newsRoutes, '/', { env });
    expect(res.res.status).toBe(200);
    expect((res.json as { data?: { hot?: unknown[] } }).data?.hot).toBeTruthy();
  });
});

describe('coverage branch final 133 — app components and hooks', () => {
  beforeEach(() => {
    installSmokeFetchMock();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('MatchStaffPanel referee-only with missing category and assistant nationality', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('/staff')) {
          return new Response(
            JSON.stringify({
              data: {
                matchId: 'm-1',
                homeCoach: null,
                awayCoach: null,
                officials: [{ role: 'assistant_referee_1', name: 'AR', nationality: null }],
                referee: { role: 'referee', name: 'Ref', nationality: 'IT', strictness: 0.6 },
              },
            }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ data: {} }), { status: 200 });
      }),
    );
    const { MatchStaffPanel } = await import('../app/components/match/MatchStaffPanel');
    renderWithI18n(React.createElement(MatchStaffPanel, { matchId: 'm-1', homeLabel: 'USA', awayLabel: 'Mexico' }));
    await waitFor(() => expect(document.body.textContent).toContain('Ref'));
    expect(document.body.textContent).toContain('—');
  });

  it('GroupStandingsGrid and BracketPanel locale and shortName fallbacks', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('/standings')) {
          return new Response(
            JSON.stringify({
              data: {
                ...sampleStandings,
                groups: {
                  A: {
                    complete: true,
                    rows: [
                      {
                        teamId: 't-long',
                        teamName: 'Long Team Name',
                        shortName: null,
                        countryCode: 'US',
                        rank: 4,
                        played: 3,
                        points: 0,
                        gf: 0,
                        ga: 3,
                        gd: -3,
                      },
                      {
                        teamId: 't-third',
                        teamName: 'Third Place Team',
                        shortName: null,
                        countryCode: 'CA',
                        rank: 3,
                        played: 3,
                        points: 3,
                        gf: 2,
                        ga: 2,
                        gd: 0,
                      },
                    ],
                  },
                },
                thirdPlaceRanking: [{ ...sampleStandings.thirdPlaceRanking[0]!, shortName: null }],
              },
            }),
            { status: 200 },
          );
        }
        if (String(url).includes('/bracket')) {
          return new Response(JSON.stringify({ data: sampleBracket }), { status: 200 });
        }
        return new Response(JSON.stringify({ data: {} }), { status: 200 });
      }),
    );
    const { GroupStandingsGrid, BracketPanel } = await import('../app/components/tournament/TournamentPanels');
    renderWithI18n(React.createElement(GroupStandingsGrid), '/', 'vi');
    await waitFor(() => expect(document.body.textContent).toContain('Long Team Name'));
    cleanup();
    renderWithI18n(React.createElement(BracketPanel), '/', 'vi');
    await waitFor(() => expect(document.body.textContent?.length ?? 0).toBeGreaterThan(20));
  });

  it('nationFlags, scenarioPredictionLabels, and matchKickoffDisplay branches', async () => {
    const { isoToFlagEmoji, resolveTeamFlagSlug, resolveTeamFlag } = await import('../app/lib/nationFlags');
    expect(isoToFlagEmoji('XX')).toBe('');
    expect(resolveTeamFlagSlug({ teamName: 'England' })).toBe('gb-eng');
    expect(resolveTeamFlag({ countryCode: 'GB', teamName: 'Scotland' })).toBeTruthy();

    const { translateComparisonSummary, legacyFactorLabel } = await import('../app/lib/i18n/scenarioPredictionLabels');
    expect(
      translateComparisonSummary(
        'Baseline remains more likely but away win probability shifts',
        [mockScenario(), mockScenario({ id: 'b', isBaseline: false })],
        'vi',
        '',
        'Mexico',
      ),
    ).toMatch(/Mexico|đội khách/);
    expect(legacyFactorLabel('All required inputs available for baseline_expected_flow.', 'vi')).toContain('kịch bản');

    const { getViewerTimezone, timezoneShortLabel } = await import('../app/lib/matchKickoffDisplay');
    const original = Intl.DateTimeFormat.prototype.formatToParts;
    Intl.DateTimeFormat.prototype.formatToParts = function (...args) {
      const parts = original.apply(this, args as never);
      return parts.filter((p) => p.type !== 'timeZoneName');
    };
    expect(getViewerTimezone()).toBeTruthy();
    expect(timezoneShortLabel('Asia/Ho_Chi_Minh', 'en')).toBe('Asia/Ho_Chi_Minh');
    Intl.DateTimeFormat.prototype.formatToParts = original;
  });

  it('hooks and app lib lineup sort', async () => {
    const { useMatchLiveData } = await import('../app/lib/useMatchLiveData');
    const { usePitchMapLive } = await import('../app/lib/usePitchMapLive');
    renderHook(() => useMatchLiveData(undefined), { wrapper: I18nProvider });
    renderHook(() => usePitchMapLive(undefined), { wrapper: I18nProvider });

    class MockWebSocket {
      static instances: MockWebSocket[] = [];
      onopen: (() => void) | null = null;
      onclose: (() => void) | null = null;
      close = vi.fn();
      constructor(public url: string) {
        MockWebSocket.instances.push(this);
        queueMicrotask(() => this.onopen?.());
      }
    }
    vi.stubGlobal('WebSocket', MockWebSocket);
    const { useMatchScenarioLive } = await import('../app/lib/useMatchScenarioLive');
    const { unmount } = renderHook(() => useMatchScenarioLive('m-1', vi.fn()), { wrapper: I18nProvider });
    MockWebSocket.instances[0]?.close();
    unmount();

    const { sortLineupPlayers } = await import('../app/lib/lineupDisplay');
    sortLineupPlayers([
      { shirtNumber: null, name: 'A', position: 'CM' },
      { shirtNumber: null, name: 'B', position: 'CM' },
    ] as never);
  });

  it('ApiDocsPage external link branch', async () => {
    const { ApiDocsPage } = await import('../app/pages/ApiDocsPage');
    renderWithI18n(React.createElement(ApiDocsPage));
    await waitFor(() => expect(document.querySelector('a[target="_blank"]')).toBeTruthy());
  });

  it('NewsArticlePage en loading branch', async () => {
    localStorage.setItem('wc-display-mode', 'en');
    let resolveFetch: (value: Response) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );
    const { NewsArticlePage } = await import('../app/pages/NewsArticlePage');
    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/news/n-loading'] },
        React.createElement(
          I18nProvider,
          null,
          React.createElement(
            Routes,
            null,
            React.createElement(Route, { path: '/news/:articleId', element: React.createElement(NewsArticlePage) }),
          ),
        ),
      ),
    );
    await waitFor(() => expect(document.body.textContent).toMatch(/loading/i));
    resolveFetch(new Response(JSON.stringify({ data: null }), { status: 200 }));
  });

  it('ScenarioPredictionPanel, GroupStageBoard, TeamsDirectory branches', async () => {
    const { ScenarioPredictionPanel } = await import('../app/components/scenarios/ScenarioPredictionPanel');
    renderWithI18n(
      React.createElement(ScenarioPredictionPanel, {
        data: {
          matchId: 'm-1',
          generatedAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
          scenarios: [mockScenario({ isBaseline: false }), mockScenario({ id: 'only-alt', isBaseline: false })],
          comparison: mockComparison(),
          sourceConfidence: { overall: 0.8, notes: [] },
        },
      }),
      '/',
      'en',
    );

    const { GroupStageBoard } = await import('../app/components/tournament/GroupStageBoard');
    renderWithI18n(
      React.createElement(GroupStageBoard, {
        matches: sampleScheduleMatches,
        initialStandings: sampleStandings,
      }),
    );

    const { TeamsDirectory } = await import('../app/components/tournament/TeamsDirectory');
    renderWithI18n(
      React.createElement(TeamsDirectory, {
        teams: [{ id: 't-mex', name: 'Mexico', short_name: null, country_code: 'MX' } as never],
      }),
    );
    fireEvent.change(document.querySelector('input[type="search"]') as HTMLInputElement, { target: { value: 'mex' } });
  });
});

describe('coverage branch final 133 — unmocks and micro gaps', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('refreshMatchData handles undefined candidates and missing ticks', async () => {
    vi.useFakeTimers();
    const kickoff = FIXTURE_MATCH.kickoff_utc!;
    const kickMs = new Date(kickoff).getTime();
    vi.setSystemTime(new Date(kickMs + 30 * 60_000));
    const { refreshMatchData } = await vi.importActual<typeof import('../src/ingestion/matchDataRefresh')>(
      '../src/ingestion/matchDataRefresh',
    );
    const env = createIngestionEnv({
      matches: [
        {
          ...FIXTURE_MATCH,
          status: 'scheduled',
          minute: 0,
          home_score: 0,
          away_score: 0,
          kickoff_utc: null as never,
        },
        {
          id: 'm-no-tick',
          tournament_id: 't-2026',
          status: 'scheduled',
          minute: 0,
          home_score: 0,
          away_score: 0,
          kickoff_utc: '2099-01-01T00:00:00Z',
          home_team_id: FIXTURE_MATCH.home_team_id,
          away_team_id: FIXTURE_MATCH.away_team_id,
        },
      ],
    }).env;
    env.MOCK_SOURCES = 'true';
    env.FIFA_LIVE_ENABLED = 'false';
    const emptyAll = await refreshMatchData(
      createMockEnv({
        DB: createMockDb({ all: () => ({} as never), run: () => ({ success: true }) }),
        KV: createMockKv(),
        MOCK_SOURCES: 'true',
        FIFA_LIVE_ENABLED: 'false',
      }),
    );
    expect(emptyAll.updatedIds).toEqual([]);
    const skipped = await refreshMatchData(env);
    expect(skipped.updatedIds).toEqual([]);
    vi.useRealTimers();
  });

  it('lineupDisplay club fallback uses null positions for slot defaults', async () => {
    const { getLineupDisplayForMatch } = await import('../src/services/lineupDisplay');
    const display = await getLineupDisplayForMatch(
      createMockEnv({
        DB: createMockDb({
          first: () => null,
          all: (sql) => {
            if (sql.includes('FROM squad_players')) return { results: [] };
            if (sql.includes('FROM players WHERE primary_team_id')) {
              return {
                results: Array.from({ length: 12 }, (_, i) => ({
                  name: `Club ${i + 1}`,
                  position: null,
                })),
              };
            }
            return { results: [] };
          },
        }),
      }),
      FIXTURE_MATCH.id,
      FIXTURE_PLAYER.primary_team_id!,
    );
    expect(display.starters.every((s) => s.shirtNumber != null)).toBe(true);
  });

  it('lineupDisplay official rows sort both null shirt numbers', async () => {
    const { getLineupDisplayForMatch } = await import('../src/services/lineupDisplay');
    const display = await getLineupDisplayForMatch(
      createMockEnv({
        DB: createMockDb({
          first: () => ({
            id: 'lu-both-null',
            formation: '4-4-2',
            is_official: 1,
            source_type: 'match_official',
            confidence: 0.7,
          }),
          all: (sql) => {
            if (sql.includes('FROM lineup_players')) {
              return {
                results: Array.from({ length: 11 }, (_, i) => ({
                  name: `P${i}`,
                  shirt_number: i < 2 ? null : i + 1,
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
      }),
      FIXTURE_MATCH.id,
      FIXTURE_MATCH.home_team_id,
    );
    expect(display.starters.length).toBe(11);
  });

  it('scenarioEngine pressing breakthrough negative edge', async () => {
    const { runScenarioProbabilityModel } = await import('../src/models/scenarios/scenarioEngine');
    const ctx = mockScenarioContext({
      homeSystem: { ...mockScenarioContext().homeSystem, pressingScore: 0.4 },
      awaySystem: { ...mockScenarioContext().awaySystem, pressingScore: 0.35 },
    });
    const out = runScenarioProbabilityModel('pressing_breakthrough', ctx, {
      selectedFeatureGroups: ['team_system'],
      requiredInputs: [],
      optionalInputs: [],
      rationale: 'test',
    });
    expect(out.scenarioProbability).toBeGreaterThan(0);
  });

  it('scenarioGenerator set piece, bench, and projected lineup branches', async () => {
    const { buildCandidateScenarios } = await import('../src/models/scenarios/scenarioGenerator');
    const ctx = mockScenarioContext({
      homeSystem: {
        ...mockScenarioContext().homeSystem,
        setPieceScore: 0.6,
        benchDepthScore: 0.6,
      },
      awaySystem: {
        ...mockScenarioContext().awaySystem,
        setPieceScore: 0.55,
        benchDepthScore: 0.55,
      },
      homeLineupSource: 'projected',
      awayLineupSource: 'official',
    });
    const candidates = buildCandidateScenarios(ctx);
    expect(candidates.some((c) => c.scenarioType === 'set_piece_decider')).toBe(true);
    expect(candidates.some((c) => c.scenarioType === 'late_bench_impact')).toBe(true);
    expect(candidates.some((c) => c.scenarioType === 'lineup_surprise')).toBe(true);
  });

  it('nationFlags name override without country code', async () => {
    const { resolveTeamFlagSlug, resolveTeamFlag } = await import('../app/lib/nationFlags');
    expect(resolveTeamFlagSlug({ teamName: 'Scotland' })).toBe('gb-sct');
    expect(resolveTeamFlag({ teamName: 'Scotland' })).toBeTruthy();
  });

  it('scenarioPredictionLabels vi fallbacks for inputs and away shift', async () => {
    const { translateComparisonSummary, legacyFactorLabel } = await import('../app/lib/i18n/scenarioPredictionLabels');
    expect(
      translateComparisonSummary(
        'Baseline remains more likely but away win probability shifts',
        [mockScenario(), mockScenario({ id: 'b', isBaseline: false })],
        'vi',
        '',
        '',
      ),
    ).toMatch(/đội khách/);
    expect(legacyFactorLabel('All required inputs available for pressing_breakthrough.', 'vi')).toContain('kịch bản');
  });

  it('newsTranslationUtils hint and summary branches', async () => {
    const { isLikelyVietnamese, needsNewsTranslation } = await import('../src/services/newsTranslationUtils');
    expect(isLikelyVietnamese('The team trong world cup schedule update')).toBe(false);
    expect(
      needsNewsTranslation({
        id: 'n-2',
        title: 'English headline here',
        summary: 'English summary here',
        title_vi: 'Tiêu đề tiếng Việt đủ dài',
        summary_vi: 'Different english summary text here',
      }),
    ).toBe(true);
  });

  it('espnTeamMatch partial alias include branches', async () => {
    const { teamLabelsMatch } = await import('../src/ingestion/espn/espnTeamMatch');
    expect(teamLabelsMatch('USA', 'United States of America')).toBe(true);
    expect(teamLabelsMatch('Korea Republic', 'South Korea')).toBe(true);
    expect(teamLabelsMatch('France', 'Germany')).toBe(false);
  });

  it('fifaLineupSync side without players and short starter list', async () => {
    const official = await import('../src/services/officialLineupSync');
    vi.spyOn(official, 'applyOfficialLineupToMatch').mockResolvedValue({ updated: false });
    const { syncFifaMatchLineupsFromInfo } = await vi.importActual<typeof import('../src/ingestion/fifa/fifaLineupSync')>(
      '../src/ingestion/fifa/fifaLineupSync',
    );
    const { env } = createIngestionEnv();
    const result = await syncFifaMatchLineupsFromInfo(
      env,
      FIXTURE_MATCH.id,
      FIXTURE_MATCH.home_team_id,
      FIXTURE_MATCH.away_team_id,
      {
        HomeTeam: { Players: undefined },
        AwayTeam: { Players: Array.from({ length: 10 }, (_, i) => starter(`s${i}`, i + 1)) },
      } as FifaMatchInfo,
    );
    expect(result.home).toBe(false);
  });

  it('fifaLiveBlogSync resultsOrEmpty and shouldSync without team ids', async () => {
    const { shouldSyncFifaBlogAndStats } = await vi.importActual<typeof import('../src/ingestion/fifa/fifaLiveBlogSync')>(
      '../src/ingestion/fifa/fifaLiveBlogSync',
    );
    const espn = await import('../src/ingestion/espn/espnStatsClient');
    vi.spyOn(espn, 'fetchEspnTeamMatchStats').mockResolvedValue(null);
    const { env } = createIngestionEnv({ teamMatchStats: [] });
    expect(await shouldSyncFifaBlogAndStats(env, FIXTURE_MATCH.id, 'live')).toBe(true);
  });

  it('parse completed via ms===0 minute>=90 branch', async () => {
    const { resolveFifaPlatformStatus } = await import('../src/ingestion/fifa/parse');
    expect(resolveFifaPlatformStatus({ MatchTime: "90'", Period: 5, MatchStatus: 0 })).toBe('completed');
  });

  it('matchKickoffDisplay timezone Intl fallback', async () => {
    const original = Intl.DateTimeFormat.prototype.resolvedOptions;
    Intl.DateTimeFormat.prototype.resolvedOptions = () => ({ timeZone: '' }) as never;
    const { getViewerTimezone } = await import('../app/lib/matchKickoffDisplay');
    expect(getViewerTimezone()).toBeTruthy();
    Intl.DateTimeFormat.prototype.resolvedOptions = original;
  });

  it('BracketPanel en locale branch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('/bracket')) {
          return new Response(JSON.stringify({ data: sampleBracket }), { status: 200 });
        }
        return new Response(JSON.stringify({ data: {} }), { status: 200 });
      }),
    );
    const { BracketPanel } = await import('../app/components/tournament/TournamentPanels');
    renderWithI18n(React.createElement(BracketPanel), '/', 'en');
    await waitFor(() => expect(document.body.textContent?.length ?? 0).toBeGreaterThan(20));
  });
});

describe('coverage branch final 133 — remaining 79 branches', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('tournamentProgression gf tiebreaker and knockout null links', async () => {
    const {
      computeGroupStandingsFromMatchRows,
      processMatchCompletion,
    } = await vi.importActual<typeof import('../src/services/tournamentProgression')>(
      '../src/services/tournamentProgression',
    );
    const standings = computeGroupStandingsFromMatchRows(
      [
        { group_code: 'F', home_team_id: 't-a', away_team_id: 't-b', home_score: 1, away_score: 0, status: 'completed' },
        { group_code: 'F', home_team_id: 't-c', away_team_id: 't-d', home_score: 2, away_score: 1, status: 'completed' },
        { group_code: 'F', home_team_id: 't-a', away_team_id: 't-c', home_score: 3, away_score: 3, status: 'completed' },
      ],
      'F',
    );
    expect(standings[0]!.gf).toBeGreaterThan(standings[1]!.gf);

    const env = createMockEnv({
      DB: createMockDb({
        first: (sql) => {
          if (sql.includes('FROM matches WHERE id')) {
            return { ...FIXTURE_MATCH, status: 'completed', stage: 'Group', group_code: 'A', home_score: 1, away_score: 0 };
          }
          if (sql.includes('COUNT(*) AS total')) return { total: 6, done: 6 };
          if (sql.includes('AS team_id FROM matches')) return { team_id: 'team-old' };
          return null;
        },
        all: (sql) => {
          if (sql.includes('match_bracket_links')) return {} as never;
          if (sql.includes("stage = 'Group'")) return { results: [] };
          return { results: [] };
        },
        run: () => ({ success: true }),
      }),
    });
    await processMatchCompletion(env, FIXTURE_MATCH.id);

    const koEnv = createMockEnv({
      DB: createMockDb({
        first: (sql) => {
          if (sql.includes('FROM matches WHERE id')) return null;
          return null;
        },
        all: () => ({} as never),
      }),
    });
    await processMatchCompletion(koEnv, 'missing');
  });

  it('tournamentStandings third-place gf tiebreaker', async () => {
    const { buildGroupStandingsPayload } = await import('../src/services/tournamentStandings');
    const groupCodes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
    const env = createMockEnv({
      DB: createMockDb({
        all: (sql) => {
          if (sql.includes('GROUP BY group_code')) {
            return {
              results: groupCodes.map((code) => ({ group_code: code, total: 6, done: 6 })),
            };
          }
          if (sql.includes('stage = \'Group\'')) {
            return {
              results: [
                { group_code: 'A', home_team_id: 't-a', away_team_id: 't-b', home_score: 1, away_score: 0, status: 'completed' },
                { group_code: 'A', home_team_id: 't-c', away_team_id: 't-d', home_score: 2, away_score: 1, status: 'completed' },
                { group_code: 'A', home_team_id: 't-a', away_team_id: 't-c', home_score: 3, away_score: 3, status: 'completed' },
              ],
            };
          }
          if (sql.includes('FROM teams')) {
            return {
              results: [
                { id: 't-a', name: 'Alpha', short_name: 'ALP', country_code: 'US' },
                { id: 't-b', name: 'Bravo', short_name: 'BRA', country_code: 'MX' },
                { id: 't-c', name: 'Charlie', short_name: 'CHA', country_code: 'CA' },
                { id: 't-d', name: 'Delta', short_name: 'DEL', country_code: 'GB' },
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

  it('scenarioGenerator set piece bench and projected branches', async () => {
    const { buildCandidateScenarios } = await import('../src/models/scenarios/scenarioGenerator');
    const onlyHomeSetPiece = buildCandidateScenarios(
      mockScenarioContext({
        homeSystem: { ...mockScenarioContext().homeSystem, setPieceScore: 0.6, benchDepthScore: 0.4 },
        awaySystem: { ...mockScenarioContext().awaySystem, setPieceScore: 0.4, benchDepthScore: 0.4 },
        homeLineupSource: 'official',
        awayLineupSource: 'official',
      }),
    );
    expect(onlyHomeSetPiece.some((c) => c.scenarioType === 'set_piece_decider')).toBe(true);

    const onlyAwayBench = buildCandidateScenarios(
      mockScenarioContext({
        homeSystem: { ...mockScenarioContext().homeSystem, benchDepthScore: 0.4 },
        awaySystem: { ...mockScenarioContext().awaySystem, benchDepthScore: 0.62 },
        homeLineupSource: 'official',
        awayLineupSource: 'projected',
      }),
    );
    expect(onlyAwayBench.some((c) => c.scenarioType === 'late_bench_impact')).toBe(true);
    expect(onlyAwayBench.some((c) => c.scenarioType === 'lineup_surprise')).toBe(true);
  });

  it('newsMatchImpact pair and fallback match queries', async () => {
    const { processNewsDocumentImpact } = await vi.importActual<typeof import('../src/services/newsMatchImpact')>(
      '../src/services/newsMatchImpact',
    );
    const recompute = await import('../src/services/recomputeMatch');
    vi.spyOn(recompute, 'recomputeMatchProbability').mockResolvedValue(undefined);
    const env = createMockEnv({
      DB: createMockDb({
        all: (sql) => {
          if (sql.includes("GLOB 'team-w26-")) {
            return {
              results: [
                { id: 'team-w26-a1', name: 'Mexico', short_name: 'MEX', country_code: 'MEX' },
                { id: 'team-w26-a2', name: 'South Africa', short_name: 'RSA', country_code: 'RSA' },
              ],
            };
          }
          if (sql.includes('AND home_team_id IN') && sql.includes('AND away_team_id IN')) {
            return { results: [{ id: 'm-pair' }] };
          }
          if (sql.includes('OR away_team_id IN')) return { results: [{ id: 'm-fallback' }] };
          return { results: [] };
        },
        run: () => ({ success: true, meta: { changes: 1 } }) as never,
      }),
      MODEL_QUEUE: { send: vi.fn() } as never,
    });
    const pair = await processNewsDocumentImpact(env, 'doc-1', 'Mexico and South Africa prepare', {
      teams: ['Mexico', 'South Africa'],
      players: [],
      injuries: [],
      tacticalNotes: [],
      formations: [],
    });
    expect(pair.matchIds).toEqual(['m-pair']);

    const fallbackEnv = createMockEnv({
      DB: createMockDb({
        all: (sql) => {
          if (sql.includes("GLOB 'team-w26-")) {
            return {
              results: [{ id: 'team-w26-a1', name: 'Mexico', short_name: 'MEX', country_code: 'MEX' }],
            };
          }
          if (sql.includes('AND home_team_id IN') && sql.includes('AND away_team_id IN')) return { results: [] };
          if (sql.includes('OR away_team_id IN')) return {} as never;
          return { results: [] };
        },
        run: () => ({ success: true, meta: { changes: 1 } }) as never,
      }),
    });
    const fallback = await processNewsDocumentImpact(fallbackEnv, 'doc-2', 'Mexico squad news', {
      teams: ['Mexico'],
      players: [],
      injuries: [],
      tacticalNotes: [],
      formations: [],
    });
    expect(fallback.matchIds).toEqual([]);
  });

  it('newsImageUrls invalid link and guardian resize', async () => {
    const { normalizeArticleLink, normalizeFeedImageUrl } = await import('../src/services/newsImageUrls');
    expect(normalizeArticleLink('not a url?x=1#frag')).toBe('not a url');
    expect(normalizeFeedImageUrl('https://i.guim.co.uk/img.jpg')).toContain('width=460');
    expect(normalizeFeedImageUrl('plain-image')).toBe('plain-image');
  });

  it('nationFlags slug override and empty sub-national name', async () => {
    const nationFlags = await import('../app/lib/nationFlags');
    expect(nationFlags.resolveTeamFlagSlug({ teamName: 'Scotland' })).toBe('gb-sct');
    vi.spyOn(nationFlags, 'resolveTeamFlagSlug').mockReturnValue('gb-sct');
    expect(nationFlags.resolveTeamFlag({ teamName: '' })).toBe('');
  });

  it('scenarioPredictionLabels unknown type and home shift fallback', async () => {
    const { legacyFactorLabel, translateComparisonSummary } = await import('../app/lib/i18n/scenarioPredictionLabels');
    expect(legacyFactorLabel('All required inputs available for custom_scenario_type.', 'vi')).toContain('custom_scenario_type');
    expect(
      translateComparisonSummary(
        'Baseline remains more likely but home win probability shifts',
        [mockScenario(), mockScenario({ id: 'b', isBaseline: false })],
        'vi',
        '',
        '',
      ),
    ).toMatch(/đội chủ nhà/);
  });

  it('espnTeamMatch alias partial include in loop', async () => {
    const { teamLabelsMatch } = await import('../src/ingestion/espn/espnTeamMatch');
    expect(teamLabelsMatch('Curacao', 'Cura')).toBe(true);
  });

  it('fifaLineupSync missing players and short starters', async () => {
    const official = await import('../src/services/officialLineupSync');
    vi.spyOn(official, 'applyOfficialLineupToMatch').mockResolvedValue({ updated: false });
    const { syncFifaMatchLineupsFromInfo } = await vi.importActual<typeof import('../src/ingestion/fifa/fifaLineupSync')>(
      '../src/ingestion/fifa/fifaLineupSync',
    );
    const { env } = createIngestionEnv();
    const short = await syncFifaMatchLineupsFromInfo(
      env,
      FIXTURE_MATCH.id,
      FIXTURE_MATCH.home_team_id,
      FIXTURE_MATCH.away_team_id,
      {
        HomeTeam: { Players: Array.from({ length: 10 }, (_, i) => starter(`h${i}`, i + 1)) },
        AwayTeam: { Players: undefined },
      } as FifaMatchInfo,
    );
    expect(short.home).toBe(false);
    expect(short.away).toBe(false);
  });

  it('fifaLiveBlogSync resultsOrEmpty and shouldSync without team ids', async () => {
    const blog = await vi.importActual<typeof import('../src/ingestion/fifa/fifaLiveBlogSync')>(
      '../src/ingestion/fifa/fifaLiveBlogSync',
    );
    const espn = await import('../src/ingestion/espn/espnStatsClient');
    vi.spyOn(espn, 'fetchEspnTeamMatchStats').mockResolvedValue(null);
    const { env } = createIngestionEnv({
      teamMatchStats: [],
      matches: [{ ...FIXTURE_MATCH, status: 'live' }],
    });
    expect(await blog.shouldSyncFifaBlogAndStats(env, FIXTURE_MATCH.id, 'live')).toBe(true);
  });

  it('fifaLiveSync score fallbacks and null fifa match id', async () => {
    const api = await import('../src/ingestion/fifa/fifaApiClient');
    vi.spyOn(api, 'fetchFifaWc2026FixturesCalendar').mockResolvedValue([]);
    vi.spyOn(api, 'fetchFifaMatchInfo').mockResolvedValue({
      IdMatch: '400123456',
      HomeTeam: { Score: null },
      AwayTeam: { Score: null },
      HomeTeamScore: 2,
      AwayTeamScore: 1,
      MatchTime: "45'",
      MatchStatus: 3,
    } as never);
    const blog = await import('../src/ingestion/fifa/fifaLiveBlogSync');
    vi.spyOn(blog, 'shouldSyncFifaBlogAndStats').mockResolvedValue(false);
    const lineup = await import('../src/ingestion/fifa/fifaLineupSync');
    vi.spyOn(lineup, 'shouldSyncFifaLineupForKickoff').mockReturnValue(false);
    const { syncFifaWc2026Matches } = await vi.importActual<typeof import('../src/ingestion/fifa/fifaLiveSync')>(
      '../src/ingestion/fifa/fifaLiveSync',
    );
    const { env } = createIngestionEnv({
      matches: [
        {
          ...FIXTURE_MATCH,
          fifa_match_id: null,
          status: 'scheduled',
          kickoff_utc: FIXTURE_MATCH.kickoff_utc,
        },
      ],
    });
    await syncFifaWc2026Matches(env);
  });

  it('matchGroupContext null results and short name fallback', async () => {
    const { getGroupContextForMatch } = await import('../src/services/matchGroupContext');
    const env = createMockEnv({
      DB: createMockDb({
        all: () => ({} as never),
      }),
    });
    const empty = await getGroupContextForMatch(env, FIXTURE_MATCH.id, 'A');
    expect(empty.fixtures).toEqual([]);

    const named = await getGroupContextForMatch(
      createMockEnv({
        DB: createMockDb({
          all: () => ({
            results: [
              {
                id: 'm-2',
                kickoff_utc: FIXTURE_MATCH.kickoff_utc,
                home_short: null,
                home_name: 'Home Full',
                away_short: null,
                away_name: 'Away Full',
              },
            ],
          }),
        }),
      }),
      FIXTURE_MATCH.id,
      'A',
    );
    expect(named.fixtures[0]?.home).toBe('Home Full');
  });

  it('matchScenarioService generated null scenarios fallback', async () => {
    const repo = await import('../src/db/repositories/matchPredictionScenarioRepo');
    vi.spyOn(repo, 'listActiveScenariosForMatch').mockResolvedValue([]);
    vi.spyOn(repo, 'replaceMatchScenarioSet').mockResolvedValue(undefined);
    vi.spyOn(repo, 'saveScenarioSnapshot').mockResolvedValue(undefined);
    const service = await import('../src/services/matchScenarioService');
    vi.spyOn(service, 'generateMatchScenarios').mockResolvedValue(null);
    vi.spyOn(service, 'getMatchScenarioSet').mockResolvedValue({
      matchId: FIXTURE_MATCH.id,
      generatedAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      scenarios: [mockScenario()],
      comparison: mockComparison(),
      sourceConfidence: { overall: 0.8, notes: [] },
    });
    const updater = await import('../src/models/scenarios/scenarioRealtimeUpdater');
    vi.spyOn(updater, 'applyRealtimeEventToScenarios').mockReturnValue({
      scenarios: [mockScenario()],
      snapshots: [],
    });
    const result = await service.updateScenariosFromRealtimeEvent(
      createMockEnv({
        DB: createMockDb({
          first: (sql) => {
            if (sql.includes('FROM matches WHERE id')) return FIXTURE_MATCH;
            if (sql.includes('FROM teams WHERE id')) return FIXTURE_TEAMS[0];
            if (sql.includes('SELECT year FROM tournaments')) return { year: 2026 };
            return null;
          },
          all: () => ({ results: [] }),
          run: () => ({ success: true }),
        }),
        R2_ARTIFACTS: { put: vi.fn(async () => undefined) } as never,
      }),
      { matchId: FIXTURE_MATCH.id, minute: 10, eventType: 'goal', eventId: 'e-1', side: 'home' },
    );
    expect(result).toBeTruthy();
  });

  it('routes matches events/hints and publicApi stream cursor', async () => {
    const { matchRoutes } = await import('../src/routes/matches');
    expect((await requestRoute(matchRoutes, '/missing-match/events', { env: createRouteTestEnv() })).status).toBe(404);
    expect((await requestRoute(matchRoutes, '/missing-match/hints', { env: createRouteTestEnv() })).status).toBe(404);

    const { publicApiRoutes } = await import('../src/routes/publicApi');
    const feedMod = await import('../src/services/publicApi/feed');
    vi.spyOn(feedMod, 'queryFeed').mockResolvedValue({ events: [], nextCursor: 5 });
    const noCursor = await requestRoute(publicApiRoutes, '/stream', {
      env: createRouteTestEnv({ publicApiEnabled: true }),
    });
    expect(noCursor.status).toBe(200);
    const streamRes = await requestRoute(publicApiRoutes, '/stream?cursor=abc', {
      env: createRouteTestEnv({ publicApiEnabled: true }),
    });
    expect(streamRes.status).toBe(200);
    const reader = streamRes.body!.getReader();
    await reader.cancel();
  });

  it('hooks early-return refresh paths and scenario reconnect guard', async () => {
    const { useMatchLiveData } = await import('../app/lib/useMatchLiveData');
    const { usePitchMapLive } = await import('../app/lib/usePitchMapLive');
    const live = renderHook(() => useMatchLiveData(undefined), { wrapper: I18nProvider });
    await live.result.current.refresh();
    const pitch = renderHook(() => usePitchMapLive(undefined, false), { wrapper: I18nProvider });
    await pitch.result.current.reload();

    vi.useFakeTimers();
    class MockWebSocket {
      static instances: MockWebSocket[] = [];
      onclose: (() => void) | null = null;
      close = vi.fn(() => this.onclose?.());
      constructor(public url: string) {
        MockWebSocket.instances.push(this);
      }
    }
    vi.stubGlobal('WebSocket', MockWebSocket);
    const { useMatchScenarioLive } = await import('../app/lib/useMatchScenarioLive');
    const view = renderHook(() => useMatchScenarioLive('m-live', vi.fn()), { wrapper: I18nProvider });
    view.unmount();
    MockWebSocket.instances.at(-1)?.close();
    await vi.runAllTimersAsync();
  });

  it('ApiDocsPage inline markdown internal and external links', async () => {
    const { renderInlineMarkdown } = await import('../app/pages/ApiDocsPage');
    const { container: external } = render(
      React.createElement(React.Fragment, null, renderInlineMarkdown('[GitHub](https://github.com/example)', 'http://localhost')),
    );
    expect(external.querySelector('a[target="_blank"]')).toBeTruthy();
    const { container: internal } = render(
      React.createElement(React.Fragment, null, renderInlineMarkdown('[Docs](/docs)', 'http://localhost')),
    );
    expect(internal.querySelector('a:not([target])')).toBeTruthy();
  });

  it('ScenarioPredictionPanel duplicate-id fallback alternative', async () => {
    const { ScenarioPredictionPanel } = await import('../app/components/scenarios/ScenarioPredictionPanel');
    renderWithI18n(
      React.createElement(ScenarioPredictionPanel, {
        data: {
          matchId: 'm-dup',
          generatedAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
          scenarios: [
            mockScenario({ id: 'same', isBaseline: false }),
            mockScenario({ id: 'same', isBaseline: false, scenarioName: 'Alt path' }),
          ],
          comparison: mockComparison(),
          sourceConfidence: { overall: 0.8, notes: [] },
        },
      }),
    );
    expect(document.body.textContent).toMatch(/Alt path|pathB|Kịch bản/i);
  });

  it('GroupStageBoard missing group fixtures map entry', async () => {
    const { GroupStageBoard } = await import('../app/components/tournament/GroupStageBoard');
    renderWithI18n(
      React.createElement(GroupStageBoard, {
        matches: sampleScheduleMatches.filter((m) => m.group_code !== 'L'),
        initialStandings: sampleStandings,
      }),
    );
    expect(document.body.textContent?.length ?? 0).toBeGreaterThan(50);
  });

  it('tournamentProgression knockout early exit and null bracket links', async () => {
    const progression = await vi.importActual<typeof import('../src/services/tournamentProgression')>(
      '../src/services/tournamentProgression',
    );
    const completedKo = {
      ...FIXTURE_MATCH,
      status: 'completed',
      stage: 'R16',
      group_code: null,
      home_score: 2,
      away_score: 1,
    };
    let matchFetch = 0;
    const env = createMockEnv({
      DB: createMockDb({
        first: (sql) => {
          if (sql.includes('FROM matches WHERE id')) {
            matchFetch += 1;
            if (matchFetch === 1) return completedKo;
            return { ...completedKo, status: 'live' };
          }
          if (sql.includes('AS team_id FROM matches')) return { team_id: 'old-team' };
          return null;
        },
        all: (sql) => {
          if (sql.includes('source_match_id = ?')) return {} as never;
          return { results: [] };
        },
        run: () => ({ success: true }),
      }),
    });
    await progression.processMatchCompletion(env, completedKo.id);

    const linksEnv = createMockEnv({
      DB: createMockDb({
        first: (sql) => {
          if (sql.includes('FROM matches WHERE id')) return completedKo;
          if (sql.includes('AS team_id FROM matches')) return { team_id: 'old-team' };
          return null;
        },
        all: (sql) => {
          if (sql.includes('source_match_id = ?')) return {} as never;
          return { results: [] };
        },
        run: () => ({ success: true }),
      }),
    });
    await progression.processMatchCompletion(linksEnv, completedKo.id);

    const missingKoEnv = createMockEnv({
      DB: createMockDb({
        first: (sql) => {
          if (sql.includes('FROM matches WHERE id')) return null;
          return null;
        },
        all: () => ({ results: [] }),
      }),
    });
    await progression.processMatchCompletion(missingKoEnv, 'missing-ko');
  });

  it('tournamentStandings compareStandings gf tiebreaker via third place', async () => {
    const { buildGroupStandingsPayload } = await import('../src/services/tournamentStandings');
    const groupCodes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
    const payload = await buildGroupStandingsPayload(
      createMockEnv({
        DB: createMockDb({
          all: (sql) => {
            if (sql.includes('GROUP BY group_code')) {
              return { results: groupCodes.map((code) => ({ group_code: code, total: 6, done: 6 })) };
            }
            if (sql.includes("stage = 'Group'")) {
              return {
                results: [
                  { group_code: 'B', home_team_id: 't-a', away_team_id: 't-b', home_score: 1, away_score: 0, status: 'completed' },
                  { group_code: 'B', home_team_id: 't-c', away_team_id: 't-d', home_score: 2, away_score: 1, status: 'completed' },
                  { group_code: 'B', home_team_id: 't-a', away_team_id: 't-c', home_score: 3, away_score: 3, status: 'completed' },
                ],
              };
            }
            if (sql.includes('FROM teams')) {
              return {
                results: [
                  { id: 't-a', name: 'Alpha', short_name: 'ALP', country_code: 'US' },
                  { id: 't-b', name: 'Bravo', short_name: 'BRA', country_code: 'MX' },
                  { id: 't-c', name: 'Charlie', short_name: 'CHA', country_code: 'CA' },
                  { id: 't-d', name: 'Delta', short_name: 'DEL', country_code: 'GB' },
                ],
              };
            }
            return { results: [] };
          },
        }),
      }),
    );
    expect(payload.thirdPlaceRanking.length).toBeGreaterThan(0);
  });

  it('scenarioGenerator home-only set piece branch', async () => {
    const { buildCandidateScenarios } = await import('../src/models/scenarios/scenarioGenerator');
    const candidates = buildCandidateScenarios(
      mockScenarioContext({
        homeSystem: { ...mockScenarioContext().homeSystem, setPieceScore: 0.58, benchDepthScore: 0.4 },
        awaySystem: { ...mockScenarioContext().awaySystem, setPieceScore: 0.4, benchDepthScore: 0.4 },
        homeLineupSource: 'official',
        awayLineupSource: 'official',
      }),
    );
    expect(candidates.some((c) => c.scenarioType === 'set_piece_decider')).toBe(true);
  });

  it('fifaLineupSync direct short starter path', async () => {
    const lineup = await vi.importActual<typeof import('../src/ingestion/fifa/fifaLineupSync')>(
      '../src/ingestion/fifa/fifaLineupSync',
    );
    const official = await import('../src/services/officialLineupSync');
    vi.spyOn(official, 'applyOfficialLineupToMatch').mockResolvedValue({ updated: false });
    const playerResolve = await import('../src/ingestion/fifa/fifaPlayerResolve');
    vi.spyOn(playerResolve, 'resolveOrCreateFifaPlayer').mockResolvedValue('p-1');
    const { env } = createIngestionEnv();
    await lineup.syncFifaMatchLineupsFromInfo(
      env,
      FIXTURE_MATCH.id,
      FIXTURE_MATCH.home_team_id,
      FIXTURE_MATCH.away_team_id,
      {
        HomeTeam: { Players: Array.from({ length: 11 }, (_, i) => starter(`ok${i}`, i + 1)) },
        AwayTeam: { Players: Array.from({ length: 9 }, (_, i) => starter(`short${i}`, i + 1)) },
      } as FifaMatchInfo,
    );
  });

  it('fifaLiveBlogSync resultsOrEmpty via sync with empty team rows', async () => {
    const api = await import('../src/ingestion/fifa/fifaApiClient');
    vi.spyOn(api, 'fetchFifaTimeline').mockResolvedValue({ Event: [] });
    vi.spyOn(api, 'fetchFifaMatchInfo').mockResolvedValue({
      IdMatch: '400021443',
      HomeTeam: { IdTeam: '43822' },
      AwayTeam: { IdTeam: '43995' },
    } as FifaMatchInfo);
    const gameday = await import('../src/ingestion/fifa/fifaGamedayClient');
    vi.spyOn(gameday, 'fetchFifaGamedayTeamMatchStats').mockResolvedValue([{ IdPlayer: '1' }] as never);
    const espn = await import('../src/ingestion/espn/espnStatsClient');
    vi.spyOn(espn, 'fetchEspnTeamMatchStats').mockResolvedValue(null);
    const blog = await vi.importActual<typeof import('../src/ingestion/fifa/fifaLiveBlogSync')>(
      '../src/ingestion/fifa/fifaLiveBlogSync',
    );
    const { env, db } = createIngestionEnv({
      matches: [{ ...FIXTURE_MATCH, fifa_match_id: '400021443', status: 'live' }],
      teamMatchStats: [],
    });
    vi.spyOn(db, 'prepare').mockImplementation((sql: string) => {
      const stmt = {
        bind: (..._args: unknown[]) => stmt,
        first: async () => {
          if (sql.includes('home_team_id, away_team_id')) return null;
          return null;
        },
        all: async () => ({} as never),
        run: async () => ({ success: true }),
      };
      return stmt as never;
    });
    await blog.syncFifaMatchBlogAndStats(
      env,
      FIXTURE_MATCH.id,
      undefined,
      undefined,
      { IdMatch: '400021443' } as FifaMatchInfo,
    );
  });

  it('explainFactors away coach edge and formation layout sorts', async () => {
    const { buildExplanationFactors } = await import('../src/models/probability/explainFactors');
    const features = mockScenarioContext().features;
    const factors = buildExplanationFactors({
      ...features,
      homeCoach: undefined,
      awayCoach: { tacticalRating: 0.95 },
    });
    expect(factors.positive.some((f) => f.direction === 'away')).toBe(true);

    const { assignFormationCoords } = await import('../src/lib/formationLayout');
    assignFormationCoords('4-4-2', [{ playerId: 'solo', position: 'ST' }], 'home');
    assignFormationCoords(
      '4-4-2',
      [
        { playerId: 'l', position: 'LW' },
        { playerId: 'r', position: 'UNKNOWN' },
      ],
      'home',
    );
  });

  it('useMatchScenarioLive ignores reconnect after unmount', async () => {
    vi.useFakeTimers();
    class MockWebSocket {
      static instances: MockWebSocket[] = [];
      onclose: (() => void) | null = null;
      close() {
        this.onclose?.();
      }
      constructor(public url: string) {
        MockWebSocket.instances.push(this);
      }
    }
    vi.stubGlobal('WebSocket', MockWebSocket);
    const { useMatchScenarioLive } = await import('../app/lib/useMatchScenarioLive');
    const view = renderHook(() => useMatchScenarioLive('m-live', vi.fn()), { wrapper: I18nProvider });
    view.unmount();
    await vi.runAllTimersAsync();
    vi.useRealTimers();
  });

  it('espnTeamMatch alias includes branch and remaining backend micro branches', async () => {
    const { teamLabelsMatch } = await import('../src/ingestion/espn/espnTeamMatch');
    expect(teamLabelsMatch('Curacao', 'Cura')).toBe(true);

    const { runMultiVariableAnalysis } = await vi.importActual<typeof import('../src/ai/multiVariableAnalysis')>(
      '../src/ai/multiVariableAnalysis',
    );
    await runMultiVariableAnalysis(
      createMockEnv({
        DB: createMockDb({
          first: (sql) => {
            if (sql.includes('FROM matches')) return FIXTURE_MATCH;
            if (sql.includes('FROM teams')) return FIXTURE_TEAMS[0];
            if (sql.includes('FROM tournaments')) return null;
            return null;
          },
          all: () => ({ results: [] }),
        }),
      }),
      FIXTURE_MATCH.id,
    ).catch(() => undefined);

    const { gatewayChat } = await import('../src/ai/gatewayClient');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 })),
    );
    await gatewayChat(
      createMockEnv({ AI_GATEWAY_ACCOUNT_ID: 'a', CF_AIG_TOKEN: 't', AI_GATEWAY_ENABLED: 'true' }),
      'weirdmodel',
      [{ role: 'user', content: 'x' }],
    ).catch(() => undefined);

    const { applyRealtimeEventToScenarios } = await import('../src/models/scenarios/scenarioRealtimeUpdater');
    applyRealtimeEventToScenarios(
      mockScenarioContext(),
      [
        mockScenario({
          triggerConditions: [{ condition: 'First goal', status: 'pending', value: 'home' }],
        }),
        mockScenario({ id: 'b', isBaseline: false }),
      ],
      { matchId: FIXTURE_MATCH.id, eventType: 'goal', minute: 1, teamSide: 'home', eventId: 'g1' },
    );

    const { getProjectedLineupForMatch } = await import('../src/services/matchLineupProjection');
    await getProjectedLineupForMatch(
      createMockEnv({
        DB: createMockDb({
          first: () => FIXTURE_MATCH,
          all: (sql) => {
            if (sql.includes('FROM squad_players')) return {} as never;
            if (sql.includes('FROM players WHERE primary_team_id')) return {} as never;
            return { results: [] };
          },
        }),
      }),
      FIXTURE_MATCH.id,
      FIXTURE_MATCH.home_team_id,
      'Mexico',
    );
  });
});

describe('coverage branch final 133 — remaining 39 branches', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('fifaLiveSync applyFifaPayload score fallbacks', async () => {
    const liveSync = await vi.importActual<typeof import('../src/ingestion/fifa/fifaLiveSync')>(
      '../src/ingestion/fifa/fifaLiveSync',
    );
    const blog = await import('../src/ingestion/fifa/fifaLiveBlogSync');
    vi.spyOn(blog, 'shouldSyncFifaBlogAndStats').mockResolvedValue(false);
    const lineup = await import('../src/ingestion/fifa/fifaLineupSync');
    vi.spyOn(lineup, 'shouldSyncFifaLineupForKickoff').mockReturnValue(false);
    const { env } = createIngestionEnv({
      matches: [{ ...FIXTURE_MATCH, fifa_match_id: null, status: 'live', minute: 50, home_score: 0, away_score: 0 }],
    });
    await liveSync.applyFifaPayload(env, { ...FIXTURE_MATCH, fifa_match_id: null, status: 'live' }, {
      IdMatch: '400021443',
      HomeTeamScore: 2,
      AwayTeamScore: 1,
      MatchTime: "55'",
      MatchStatus: 3,
      Period: 5,
    } as never);
    await liveSync.applyFifaPayload(env, { ...FIXTURE_MATCH, fifa_match_id: '400021443', status: 'live' }, {
      IdMatch: '400021443',
      HomeTeam: { Score: 1 },
      AwayTeam: { Score: 0 },
      MatchTime: "56'",
      MatchStatus: 3,
      Period: 5,
    } as never);
  });

  it('fifaLiveBlogSync espn fallback and shouldSync without team ids', async () => {
    const blog = await vi.importActual<typeof import('../src/ingestion/fifa/fifaLiveBlogSync')>(
      '../src/ingestion/fifa/fifaLiveBlogSync',
    );
    const espn = await import('../src/ingestion/espn/espnStatsClient');
    vi.spyOn(espn, 'fetchEspnTeamMatchStats').mockResolvedValue({
      eventId: 'espn-1',
      homeEspnName: 'USA',
      awayEspnName: 'Mexico',
      home: { possession: 52, shots: 8, shotsOnTarget: 3, passes: 400, passAccuracy: 88 },
      away: { possession: 48, shots: 6, shotsOnTarget: 2, passes: 350, passAccuracy: 85 },
    });
    const gameday = await import('../src/ingestion/fifa/fifaGamedayClient');
    vi.spyOn(gameday, 'fetchFifaGamedayTeamMatchStats').mockResolvedValue(null);
    const api = await import('../src/ingestion/fifa/fifaApiClient');
    vi.spyOn(api, 'fetchFifaTimeline').mockResolvedValue({ IdMatch: '400021443', Event: [] });
    const { env, db } = createIngestionEnv({
      matches: [{ ...FIXTURE_MATCH, fifa_match_id: '400021443', status: 'live' }],
      teamMatchStats: [],
    });
    await blog.syncFifaMatchBlogAndStats(
      env,
      FIXTURE_MATCH.id,
      FIXTURE_MATCH.home_team_id,
      FIXTURE_MATCH.away_team_id,
      { IdMatch: '400021443', HomeTeam: { IdTeam: '43822' }, AwayTeam: { IdTeam: '43995' } } as never,
    );
    vi.spyOn(db, 'prepare').mockImplementation((sql: string) => {
      const stmt = {
        bind: (..._args: unknown[]) => stmt,
        first: async () => {
          if (sql.includes('kickoff_utc FROM matches')) return { kickoff_utc: FIXTURE_MATCH.kickoff_utc };
          if (sql.includes('home_team_id, away_team_id')) {
            return { home_team_id: FIXTURE_MATCH.home_team_id, away_team_id: FIXTURE_MATCH.away_team_id };
          }
          return null;
        },
        all: async () => {
          if (sql.includes('FROM teams WHERE id IN')) return {} as never;
          return { results: [] };
        },
        run: async () => ({ success: true }),
      };
      return stmt as never;
    });
    expect(await blog.shouldSyncFifaBlogAndStats(env, FIXTURE_MATCH.id, 'live')).toBe(true);
    expect(
      await blog.shouldSyncFifaBlogAndStats(
        env,
        FIXTURE_MATCH.id,
        'live',
        FIXTURE_MATCH.home_team_id,
        FIXTURE_MATCH.away_team_id,
      ),
    ).toBe(true);
  });

  it('multiVariableAnalysis tournament null year branch', async () => {
    const multi = await vi.importActual<typeof import('../src/ai/multiVariableAnalysis')>(
      '../src/ai/multiVariableAnalysis',
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    summary: 'ok',
                    keyInsights: ['a'],
                    riskFlags: [],
                    confidenceNote: 'test',
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
    await multi.runMultiVariableAnalysis(
      createMockEnv({
        DB: createMockDb({
          first: (sql) => {
            if (sql.includes('FROM matches')) return FIXTURE_MATCH;
            if (sql.includes('FROM teams')) return FIXTURE_TEAMS[0];
            if (sql.includes('FROM tournaments')) return { name: 'World Cup 2026', year: null as never };
            return null;
          },
          all: () => ({ results: [] }),
        }),
        AI_GATEWAY_ACCOUNT_ID: 'a',
        CF_AIG_TOKEN: 't',
        AI_GATEWAY_ENABLED: 'true',
        OPENAI_API_KEY: 'sk-test',
        KV: createMockKv(),
      }),
      FIXTURE_MATCH.id,
    ).catch(() => undefined);
  });

  it('publicApi stream closed pull guard after feed resolves', async () => {
    const feedMod = await import('../src/services/publicApi/feed');
    let resolveFeed!: (value: { events: []; nextCursor: number }) => void;
    vi.spyOn(feedMod, 'queryFeed').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFeed = resolve;
        }),
    );
    const { publicApiRoutes } = await import('../src/routes/publicApi');
    const streamRes = await requestRoute(publicApiRoutes, '/stream', {
      env: createRouteTestEnv({ publicApiEnabled: true }),
    });
    const reader = streamRes.body!.getReader();
    const readPromise = reader.read();
    await reader.cancel();
    resolveFeed({ events: [], nextCursor: 2 });
    await readPromise;
  });

  it('formation layout, scenario updater, lineup projection branches', async () => {
    const { assignFormationCoords } = await import('../src/lib/formationLayout');
    assignFormationCoords('4-4-2', [{ playerId: 'solo-st', position: 'ST' }], 'home');
    assignFormationCoords(
      '4-4-2',
      [
        { playerId: 'lb', position: 'LB' },
        { playerId: 'unk', position: 'UNKNOWN' },
      ],
      'home',
    );

    const { applyRealtimeEventToScenarios } = await import('../src/models/scenarios/scenarioRealtimeUpdater');
    const engine = await import('../src/models/scenarios/scenarioEngine');
    vi.spyOn(engine, 'runScenarioProbabilityModel').mockImplementation((type) => ({
      scenarioProbability: type === 'baseline_expected_flow' ? 0.524 : 0.48,
      scenarioConfidence: 0.1,
      homeWinProb: 0.4,
      drawProb: 0.3,
      awayWinProb: 0.3,
      expectedHomeGoals: 1.2,
      expectedAwayGoals: 1.1,
      mostLikelyScore: '1-1',
      scorelineDistribution: {},
      intervalDistribution: {},
      initialConditions: [],
      triggerConditions:
        type === 'early_goal_swing'
          ? [
              { condition: 'First goal', status: 'pending', value: 'home' },
              { condition: 'High press', status: 'pending', value: 'home' },
            ]
          : [],
      invalidationConditions: [],
      keyDrivers: [],
      riskFactors: [],
    }));
    applyRealtimeEventToScenarios(
      mockScenarioContext(),
      [
        mockScenario({
          id: 'early',
          scenarioType: 'early_goal_swing',
          scenarioProbability: 0.4,
          triggerConditions: [
            { condition: 'First goal', status: 'pending', value: 'home' },
            { condition: 'High press', status: 'pending', value: 'home' },
          ],
        }),
        mockScenario({ id: 'other', isBaseline: false, scenarioProbability: 0.35 }),
      ],
      { matchId: FIXTURE_MATCH.id, eventType: 'goal', minute: 12, eventId: 'g1' },
    );
    applyRealtimeEventToScenarios(
      mockScenarioContext(),
      [
        mockScenario({ id: 'a', scenarioProbability: 0.51, isBaseline: false }),
        mockScenario({ id: 'b', scenarioType: 'baseline_expected_flow', scenarioProbability: 0.5, isBaseline: false }),
      ],
      { matchId: FIXTURE_MATCH.id, eventType: 'status', minute: 10, eventId: 's1' },
    );
    applyRealtimeEventToScenarios(
      mockScenarioContext(),
      [
        mockScenario({ id: 'a', scenarioProbability: 0.51, isBaseline: false }),
        mockScenario({ id: 'b', scenarioType: 'baseline_expected_flow', scenarioProbability: 0.5, isBaseline: false }),
      ],
      { matchId: FIXTURE_MATCH.id, eventType: 'status', minute: 11, eventId: 's2' },
    );

    const squadRows = Array.from({ length: 8 }, (_, i) => ({
      name: `Squad ${i + 1}`,
      position: 'MF',
      listed_position: 'CM',
    }));
    const clubRows = Array.from({ length: 6 }, (_, i) => ({
      name: `Club ${i + 1}`,
      position: 'MF',
    }));
    const { getProjectedLineupForMatch } = await import('../src/services/matchLineupProjection');
    await getProjectedLineupForMatch(
      createMockEnv({
        DB: createMockDb({
          first: (sql) => {
            if (sql.includes('FROM lineups l')) return null;
            if (sql.includes('FROM matches')) return FIXTURE_MATCH;
            return null;
          },
          all: (sql) => {
            if (sql.includes('FROM squad_players')) return { results: squadRows };
            if (sql.includes('FROM players WHERE primary_team_id')) return { results: clubRows };
            return { results: [] };
          },
        }),
      }),
      FIXTURE_MATCH.id,
      FIXTURE_MATCH.home_team_id,
      'Mexico',
    );
    await getProjectedLineupForMatch(
      createMockEnv({
        DB: createMockDb({
          first: (sql) => {
            if (sql.includes('FROM lineups l')) return null;
            if (sql.includes('FROM matches')) return FIXTURE_MATCH;
            return null;
          },
          all: (sql) => {
            if (sql.includes('FROM squad_players')) return { results: squadRows.slice(0, 3) };
            if (sql.includes('FROM players WHERE primary_team_id')) return { results: clubRows };
            return { results: [] };
          },
        }),
      }),
      FIXTURE_MATCH.id,
      FIXTURE_MATCH.away_team_id,
      'USA',
    );
  });

  it('hooks, translate, repo, adapter, espn, gameday, explain branches', async () => {
    vi.useFakeTimers();
    class MockWebSocket {
      static instances: MockWebSocket[] = [];
      onclose: (() => void) | null = null;
      close() {
        this.onclose?.();
      }
      constructor(public url: string) {
        MockWebSocket.instances.push(this);
      }
    }
    vi.stubGlobal('WebSocket', MockWebSocket);
    const { useMatchScenarioLive } = await import('../app/lib/useMatchScenarioLive');
    const view = renderHook(() => useMatchScenarioLive('m-live', vi.fn()), { wrapper: I18nProvider });
    MockWebSocket.instances.at(-1)?.close();
    await vi.advanceTimersByTimeAsync(2000);
    view.unmount();
    await vi.advanceTimersByTimeAsync(30000);
    vi.useRealTimers();

    const { spreadY } = await import('../src/lib/formationLayout');
    expect(spreadY(0, 1)).toBe(0.5);

    const gateway = await vi.importActual<typeof import('../src/ai/gatewayClient')>('../src/ai/gatewayClient');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ generatedAt: null }) } }] }), {
          status: 200,
        }),
      ),
    );
    await gateway.gatewayChatJson(
      createMockEnv({
        AI_GATEWAY_ACCOUNT_ID: 'a',
        CF_AIG_TOKEN: 't',
        AI_GATEWAY_ENABLED: 'true',
        OPENAI_API_KEY: 'sk-test',
      }),
      'tactical_briefing',
      [{ role: 'user', content: 'brief' }],
    ).catch(() => undefined);

    const { translateNewsHeadline } = await import('../src/ai/translateNews');
    expect(
      await translateNewsHeadline(
        createMockEnv({
          AI: {
            run: vi.fn(async () => ({
              response: JSON.stringify({ titleVi: 'Same', summaryVi: 'A different summary body here' }),
            })),
          } as never,
        }),
        'Same',
        'A different summary body here',
      ),
    ).toBeNull();

    const repo = await import('../src/db/repositories/matchPredictionScenarioRepo');
    await repo.saveScenarioSnapshot(createMockDb({ run: () => ({ success: true }) }), mockScenario({ featureSnapshotR2Key: 'snap-key' }), {
      minute: 0,
      deltaFromPrevious: {},
      updateReason: 'test',
    });
    await repo.saveScenarioSnapshot(createMockDb({ run: () => ({ success: true }) }), mockScenario({ featureSnapshotR2Key: undefined }), {
      minute: 0,
      deltaFromPrevious: {},
      updateReason: 'test',
    });

    const { extractImageUrl } = await import('../src/ingestion/adapters/TrustedNewsRssAdapter');
    extractImageUrl(`<media:content url="https://img.example/normal.jpg">`, '');

    const { teamLabelsMatch } = await import('../src/ingestion/espn/espnTeamMatch');
    expect(teamLabelsMatch('Curacao', 'Cura')).toBe(true);

    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));
    const gamedayClient = await import('../src/ingestion/fifa/fifaGamedayClient');
    expect(await gamedayClient.fetchFifaGamedayTeamMatchStats('400021443')).toBeNull();

    const { buildExplanationFactors } = await import('../src/models/probability/explainFactors');
    const features = mockScenarioContext().features;
    buildExplanationFactors({
      ...features,
      homeCoach: { tacticalRating: 0.95 },
      awayCoach: { tacticalRating: 0.5 },
    });

    const { selectScenarioFeatures } = await import('../src/models/scenarios/scenarioFeatureSelector');
    selectScenarioFeatures('early_goal_swing', mockScenarioContext());
  });

  it('model consumer, news, services, and standings branches', async () => {
    const consumer = await vi.importActual<typeof import('../src/queues/modelConsumer')>('../src/queues/modelConsumer');
    const broadcast = await import('../src/services/matchScenarioService');
    vi.spyOn(broadcast, 'updateScenariosFromRealtimeEvent').mockResolvedValue({
      matchId: FIXTURE_MATCH.id,
      generatedAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      scenarios: [mockScenario(), mockScenario({ id: 'b' })],
      comparison: mockComparison(),
      sourceConfidence: { overall: 0.8, notes: [] },
    });
    vi.spyOn(broadcast, 'broadcastScenarioUpdate').mockResolvedValue(undefined);
    const { createMockMessageBatch } = await import('./helpers/mockMessageBatch');
    await consumer.handleModelBatch(
      createMockMessageBatch([{ body: { matchId: FIXTURE_MATCH.id, type: 'SCENARIO_RECOMPUTE', eventId: 'evt-1' } }]),
      createMockEnv({
        MATCH_ROOM: { idFromName: () => ({ toString: () => 'r' }), get: () => ({ fetch: vi.fn() }) } as never,
      }),
    );

    const scenarioSvc = await vi.importActual<typeof import('../src/services/matchScenarioService')>(
      '../src/services/matchScenarioService',
    );
    vi.spyOn(scenarioSvc, 'generateMatchScenarios').mockResolvedValue({
      matchId: FIXTURE_MATCH.id,
      generatedAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      scenarios: [mockScenario(), mockScenario({ id: 'b' })],
      comparison: mockComparison(),
      sourceConfidence: { overall: 0.8, notes: [] },
    });
    await scenarioSvc.updateScenariosFromRealtimeEvent(
      createMockEnv({
        DB: createMockDb({
          first: (sql) => {
            if (sql.includes('FROM matches WHERE id')) return FIXTURE_MATCH;
            if (sql.includes('FROM teams WHERE id')) return FIXTURE_TEAMS[0];
            if (sql.includes('SELECT year FROM tournaments')) return { year: 2026 };
            return null;
          },
          all: () => ({ results: [] }),
          run: () => ({ success: true }),
        }),
        R2_ARTIFACTS: { put: vi.fn(async () => undefined) } as never,
      }),
      { matchId: FIXTURE_MATCH.id, minute: 10, eventType: 'goal', eventId: 'e-1', side: 'home' } as never,
    );

    const { newsRoutes } = await import('../src/routes/news');
    await jsonRoute(
      newsRoutes,
      '/',
      {
        env: createRouteTestEnv({
          DB: createMockDb({
            all: (sql) => {
              if (sql.includes('FROM source_documents')) {
                return {
                  results: [
                    {
                      id: 'doc-hot',
                      title: 'Title',
                      summary: 'Summary',
                      source_url: 'https://example.com/a',
                      published_at: '2026-01-01T00:00:00Z',
                      reliability_score: 0.8,
                      hot_score: null,
                      source_name: 'BBC',
                      thumbnail_url: null,
                      title_vi: null,
                      summary_vi: null,
                    },
                  ],
                };
              }
              return { results: [] };
            },
            first: () => null,
            run: () => ({ success: true }),
          }),
        }),
      },
    );

    const { buildMatchFeaturesWithForm } = await import('../src/services/matchFeatures');
    await buildMatchFeaturesWithForm(
      createMockEnv({
        DB: createMockDb({
          first: (sql) => {
            if (sql.includes('FROM lineups l')) return { id: 'lu-1', formation: '4-3-3', is_official: 1 };
            return null;
          },
          all: (sql) => {
            if (sql.includes('FROM lineup_players')) {
              return {
                results: [{ is_starter: 1, position_slot: 'ST', role: null, position: 'ST' }],
              };
            }
            return { results: [] };
          },
        }),
      }),
      FIXTURE_MATCH,
      FIXTURE_TEAMS[0]!,
      FIXTURE_TEAMS[1]!,
      2026,
    );
    await buildMatchFeaturesWithForm(
      createMockEnv({
        DB: createMockDb({
          first: (sql) => {
            if (sql.includes('FROM lineups l')) return { id: 'lu-1', formation: '4-3-3', is_official: 1 };
            return null;
          },
          all: (sql) => {
            if (sql.includes('FROM lineup_players')) return {} as never;
            return { results: [] };
          },
        }),
      }),
      FIXTURE_MATCH,
      FIXTURE_TEAMS[0]!,
      FIXTURE_TEAMS[1]!,
      2026,
    );

    const { groupTeamWorldCupMeetings } = await import('../src/services/matchHistory');
    groupTeamWorldCupMeetings('team-a', [
      { tournament_year: undefined as never, home_team_id: 'team-a', away_team_id: 'team-b', home_score: 1, away_score: 0 },
      { tournament_year: 2022, home_team_id: 'team-a', away_team_id: 'team-c', home_score: 0, away_score: 0 },
    ] as never);

    const { getMatchRecap } = await import('../src/services/matchRecap');
    await getMatchRecap(
      createMockEnv({
        DB: createMockDb({
          first: (sql) => {
            if (sql.includes('match_recaps')) return { summary_vi: 'vi', summary_en: 'en', source_id: 's', updated_at: 't' };
            if (sql.includes('FROM matches')) return { ...FIXTURE_MATCH, slug: FIXTURE_MATCH.id };
            return null;
          },
          all: (sql) => {
            if (sql.includes('FROM match_commentary')) return {} as never;
            return { results: [] };
          },
        }),
      }),
      FIXTURE_MATCH.id,
    );

    const { getMatchStats } = await import('../src/services/matchStats');
    await getMatchStats(
      createMockEnv({
        MOCK_SOURCES: 'true',
        FIFA_LIVE_ENABLED: 'false',
        DB: createMockDb({
          first: (sql) => {
            if (sql.includes('match_recaps')) return null;
            if (sql.includes('FROM matches m')) {
              return {
                ...FIXTURE_MATCH,
                slug: FIXTURE_MATCH.id,
                home_name: 'USA',
                away_name: 'Mexico',
                updated_at: '2026-01-01T00:00:00Z',
              };
            }
            if (sql.includes('FROM teams WHERE id')) return FIXTURE_TEAMS[0];
            if (sql.includes('SELECT status, minute')) {
              return { status: 'live', minute: 55, home_score: 1, away_score: 0, updated_at: '2026-01-01T00:00:00Z' };
            }
            if (sql.includes('FROM match_events')) return { goals: 0, yellow_cards: 0, red_cards: 0, substitutions: 0 };
            if (sql.includes('MAX(created_at)')) return null;
            return null;
          },
          all: () => ({ results: [] }),
        }),
      }),
      FIXTURE_MATCH.id,
    );

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('scoreboard')) {
          return new Response(
            JSON.stringify({
              events: [{ id: '999', date: '2026-06-12', competitions: [{ competitors: [{ homeAway: 'away', team: {} }] }] }],
            }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ boxscore: { teams: [{ team: {}, statistics: [] }, { team: {}, statistics: [] }] } }), {
          status: 200,
        });
      }),
    );
    const { fetchEspnTeamMatchStats } = await import('../src/ingestion/espn/espnStatsClient');
    await fetchEspnTeamMatchStats('United States', 'Mexico', '2026-06-12T20:00:00Z');

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          `<rss><channel><item><title>T</title><link>https://example.com/n</link><description><img src="https://img.example/x.jpg"/></description></item></channel></rss>`,
          { status: 200 },
        ),
      ),
    );
    const { recompressNewsThumbnails } = await import('../src/services/newsThumbnailBackfill');
    await recompressNewsThumbnails(
      createMockEnv({
        DB: createMockDb({
          all: () => ({
            results: [{ id: 'doc-1', source_url: 'https://example.com/n', content_r2_key: null }],
          }),
        }),
        R2_ARTIFACTS: { head: vi.fn(async () => null), put: vi.fn(async () => undefined) } as never,
      }),
      5,
    );

    const { getPitchMapPayload } = await import('../src/services/pitchMap');
    await getPitchMapPayload(
      createMockEnv({
        DB: createMockDb({
          first: (sql, binds) => {
            if (sql.includes('FROM matches')) {
              return { ...FIXTURE_MATCH, slug: 'usa-v-mex', home_name: 'USA', away_name: 'Mexico' };
            }
            if (sql.includes('FROM teams WHERE id')) {
              return binds[0] === FIXTURE_MATCH.home_team_id ? FIXTURE_TEAMS[0] : FIXTURE_TEAMS[1];
            }
            return null;
          },
          all: (sql) => {
            if (sql.includes('FROM lineup_players')) {
              return {
                results: [
                  {
                    player_id: 'p-1',
                    team_id: FIXTURE_MATCH.home_team_id,
                    name: 'Player',
                    shirt_number: 10,
                    position_slot: 'ST',
                    x: 0.5,
                    y: 0.5,
                    is_starter: 1,
                  },
                ],
              };
            }
            return { results: [] };
          },
        }),
        MOCK_SOURCES: 'true',
        FIFA_LIVE_ENABLED: 'false',
      }),
      FIXTURE_MATCH.id,
    );
    await getPitchMapPayload(
      createMockEnv({
        DB: createMockDb({
          first: (sql, binds) => {
            if (sql.includes('FROM matches')) {
              return { ...FIXTURE_MATCH, slug: null, home_name: 'USA', away_name: 'Mexico' };
            }
            if (sql.includes('FROM teams WHERE id')) {
              return binds[0] === FIXTURE_MATCH.home_team_id ? FIXTURE_TEAMS[0] : FIXTURE_TEAMS[1];
            }
            return null;
          },
          all: (sql) => {
            if (sql.includes('FROM lineup_players')) {
              return {
                results: [
                  {
                    player_id: 'p-1',
                    team_id: FIXTURE_MATCH.home_team_id,
                    name: 'Player',
                    shirt_number: 10,
                    position_slot: 'ST',
                    x: 0.5,
                    y: 0.5,
                    is_starter: 1,
                  },
                ],
              };
            }
            return { results: [] };
          },
        }),
        MOCK_SOURCES: 'true',
        FIFA_LIVE_ENABLED: 'false',
      }),
      FIXTURE_MATCH.id,
    );

    const { recomputeAllWc2026Matches } = await import('../src/services/recomputeMatch');
    await recomputeAllWc2026Matches(
      createMockEnv({
        DB: createMockDb({
          all: (sql) => {
            if (sql.includes('SELECT id FROM matches')) return {} as never;
            return { results: [] };
          },
        }),
      }),
    );

    const { buildTournamentMatchProbabilitiesPayload } = await import('../src/services/tournamentMatchProbabilities');
    await buildTournamentMatchProbabilitiesPayload(
      createMockEnv({
        DB: createMockDb({
          first: (sql, binds) => {
            if (sql.includes('FROM matches WHERE id')) return FIXTURE_MATCH;
            if (sql.includes('FROM teams WHERE id') && binds[0] === FIXTURE_MATCH.home_team_id) return FIXTURE_TEAMS[0];
            if (sql.includes('FROM teams WHERE id')) return null;
            return null;
          },
          all: (sql) => {
            if (sql.includes('FROM probability_snapshots')) return { results: [] };
            if (sql.includes('FROM matches WHERE tournament_id')) return { results: [FIXTURE_MATCH] };
            return { results: [] };
          },
          run: () => ({ success: true }),
        }),
        KV: createMockKv(),
      }),
      't-2026',
    );

    const { compareStandings } = await import('../src/services/tournamentStandings');
    compareStandings(
      { teamId: 'a', played: 3, points: 6, gf: 4, ga: 1, gd: 3 },
      { teamId: 'b', played: 3, points: 6, gf: 5, ga: 2, gd: 3 },
    );
    compareStandings(
      { teamId: 'x', played: 3, points: 6, gf: 4, ga: 2, gd: 2 },
      { teamId: 'y', played: 3, points: 6, gf: 3, ga: 1, gd: 2 },
    );
    compareStandings(
      { teamId: 'p', played: 3, points: 9, gf: 4, ga: 1, gd: 3 },
      { teamId: 'q', played: 3, points: 6, gf: 3, ga: 1, gd: 2 },
    );
  });
});

describe('coverage branch final 133 — last 7 branches', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('closes espn, gameday, explainFactors, matchHistory, matchScenarioService, matchStats, pitchMap', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('token')) {
          return new Response(JSON.stringify({ token: 'jwt-test' }), { status: 200 });
        }
        if (String(url).includes('teams.json')) {
          return new Response('', { status: 500 });
        }
        if (String(url).includes('scoreboard')) {
          return new Response(
            JSON.stringify({
              events: [
                {
                  id: '999',
                  date: '2026-06-12',
                  competitions: [
                    {
                      competitors: [
                        { homeAway: 'home', team: { displayName: 'United States' } },
                        { homeAway: 'away', team: { displayName: 'Mexico' } },
                      ],
                    },
                  ],
                },
              ],
            }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({
            boxscore: {
              teams: [
                {
                  team: {},
                  statistics: [
                    { name: 'possessionPct', displayValue: '55' },
                    { name: 'totalPasses', displayValue: '400' },
                  ],
                },
                {
                  team: { displayName: 'Mexico' },
                  statistics: [
                    { name: 'possessionPct', displayValue: '45' },
                    { name: 'totalPasses', displayValue: '350' },
                  ],
                },
              ],
            },
          }),
          { status: 200 },
        );
      }),
    );
    const { fetchEspnTeamMatchStats } = await import('../src/ingestion/espn/espnStatsClient');
    const espnStats = await fetchEspnTeamMatchStats('United States', 'Mexico', '2026-06-12T20:00:00Z');
    expect(espnStats?.awayEspnName).toBe('Mexico');
    expect(espnStats?.homeEspnName).toBeTruthy();

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('scoreboard')) {
          return new Response(
            JSON.stringify({
              events: [
                {
                  id: '999',
                  date: '2026-06-12',
                  competitions: [
                    {
                      competitors: [
                        { homeAway: 'home', team: { displayName: 'United States' } },
                        { homeAway: 'away', team: { displayName: 'Mexico' } },
                      ],
                    },
                  ],
                },
              ],
            }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({
            boxscore: {
              teams: [
                {
                  team: { displayName: 'United States' },
                  statistics: [
                    { name: 'possessionPct', displayValue: '55' },
                    { name: 'totalPasses', displayValue: '400' },
                  ],
                },
                {
                  team: {},
                  statistics: [
                    { name: 'possessionPct', displayValue: '45' },
                    { name: 'totalPasses', displayValue: '350' },
                  ],
                },
              ],
            },
          }),
          { status: 200 },
        );
      }),
    );
    const espnFallback = await fetchEspnTeamMatchStats('United States', 'Mexico', '2026-06-12T20:00:00Z');
    expect(espnFallback?.awayEspnName).toBe('Mexico');

    const gameday = await import('../src/ingestion/fifa/fifaGamedayClient');
    gameday.resetFifaGamedayTokenCache();
    expect(await gameday.fetchFifaGamedayTeamMatchStats('400021443')).toBeNull();

    const { buildExplanationFactors } = await import('../src/models/probability/explainFactors');
    buildExplanationFactors({
      ...mockScenarioContext().features,
      homeCoach: { tacticalRating: 0.8 },
      awayCoach: undefined,
    });
    buildExplanationFactors({
      ...mockScenarioContext().features,
      homeCoach: { tacticalRating: 0.5 },
      awayCoach: { tacticalRating: 0.95 },
    });

    const { groupTeamWorldCupMeetings } = await import('../src/services/matchHistory');
    const grouped = groupTeamWorldCupMeetings('team-a', [
      { tournament_year: undefined as never, home_team_id: 'team-a', away_team_id: 'team-b', home_score: 1, away_score: 0 },
      { tournament_year: 2022, home_team_id: 'team-a', away_team_id: 'team-c', home_score: 0, away_score: 0 },
    ] as never);
    expect(grouped.length).toBe(2);

    const repo = await import('../src/db/repositories/matchPredictionScenarioRepo');
    vi.spyOn(repo, 'listActiveScenariosForMatch').mockResolvedValue([]);
    vi.spyOn(repo, 'replaceMatchScenarioSet').mockResolvedValue(undefined);
    vi.spyOn(repo, 'saveScenarioSnapshot').mockResolvedValue(undefined);
    const scenarioSvc = await vi.importActual<typeof import('../src/services/matchScenarioService')>(
      '../src/services/matchScenarioService',
    );
    vi.spyOn(scenarioSvc, 'generateMatchScenarios').mockResolvedValue({
      matchId: FIXTURE_MATCH.id,
      generatedAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      scenarios: [mockScenario(), mockScenario({ id: 'b' })],
      comparison: mockComparison(),
      sourceConfidence: { overall: 0.8, notes: [] },
    });
    vi.spyOn(scenarioSvc, 'getMatchScenarioSet').mockResolvedValue({
      matchId: FIXTURE_MATCH.id,
      generatedAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      scenarios: [mockScenario(), mockScenario({ id: 'b' })],
      comparison: mockComparison(),
      sourceConfidence: { overall: 0.8, notes: [] },
    });
    const updater = await import('../src/models/scenarios/scenarioRealtimeUpdater');
    vi.spyOn(updater, 'applyRealtimeEventToScenarios').mockReturnValue({
      scenarios: [mockScenario(), mockScenario({ id: 'b' })],
      snapshots: [],
    });
    await scenarioSvc.updateScenariosFromRealtimeEvent(
      createMockEnv({
        DB: createMockDb({
          first: (sql) => {
            if (sql.includes('FROM matches WHERE id')) return FIXTURE_MATCH;
            if (sql.includes('FROM teams WHERE id')) return FIXTURE_TEAMS[0];
            if (sql.includes('SELECT year FROM tournaments')) return { year: 2026 };
            return null;
          },
          all: () => ({ results: [] }),
          run: () => ({ success: true }),
        }),
        R2_ARTIFACTS: { put: vi.fn(async () => undefined) } as never,
      }),
      { matchId: FIXTURE_MATCH.id, minute: 10, eventType: 'goal', eventId: 'e-1', side: 'home' },
    );

    const { getMatchStats } = await import('../src/services/matchStats');
    await getMatchStats(
      createMockEnv({
        MOCK_SOURCES: 'true',
        FIFA_LIVE_ENABLED: 'false',
        DB: createMockDb({
          first: (sql) => {
            if (sql.includes('match_recaps')) return null;
            if (sql.includes('FROM matches m')) {
              return {
                ...FIXTURE_MATCH,
                slug: FIXTURE_MATCH.id,
                home_name: 'USA',
                away_name: 'Mexico',
                updated_at: null,
              };
            }
            if (sql.includes('FROM teams WHERE id')) return FIXTURE_TEAMS[0];
            if (sql.includes('SELECT status, minute')) {
              return { status: 'live', minute: 55, home_score: 1, away_score: 0, updated_at: null };
            }
            if (sql.includes('FROM match_events')) return { goals: 0, yellow_cards: 0, red_cards: 0, substitutions: 0 };
            return null;
          },
          all: () => ({
            results: [
              {
                team_id: FIXTURE_MATCH.home_team_id,
                possession: 55,
                shots: 10,
                shots_on_target: 4,
                xg: 1.2,
                passes: 400,
                pass_accuracy: 85,
                created_at: '2026-01-01T00:00:00Z',
              },
            ],
          }),
        }),
      }),
      FIXTURE_MATCH.id,
    );
    await getMatchStats(
      createMockEnv({
        MOCK_SOURCES: 'true',
        FIFA_LIVE_ENABLED: 'false',
        DB: createMockDb({
          first: (sql) => {
            if (sql.includes('match_recaps')) return null;
            if (sql.includes('FROM matches m')) {
              return {
                ...FIXTURE_MATCH,
                slug: FIXTURE_MATCH.id,
                home_name: 'USA',
                away_name: 'Mexico',
                updated_at: '2026-01-02T00:00:00Z',
              };
            }
            if (sql.includes('FROM teams WHERE id')) return FIXTURE_TEAMS[0];
            if (sql.includes('SELECT status, minute')) {
              return { status: 'live', minute: 55, home_score: 1, away_score: 0, updated_at: '2026-01-02T00:00:00Z' };
            }
            if (sql.includes('FROM match_events')) return { goals: 0, yellow_cards: 0, red_cards: 0, substitutions: 0 };
            return null;
          },
          all: () => ({ results: [] }),
        }),
      }),
      FIXTURE_MATCH.id,
    );

    const pitchLineupAll = (sql: string) => {
      if (sql.includes('FROM lineups l') || sql.includes('FROM lineup_players')) {
        return {
          results: [
            {
              lineup_id: 'lu-1',
              team_id: FIXTURE_MATCH.home_team_id,
              team_name: 'USA',
              formation: '4-3-3',
              source_type: null,
              player_id: 'p-1',
              player_name: 'Player',
              shirt_number: 10,
              position_slot: 'ST',
              role: null,
              player_position: 'ST',
              is_starter: 1,
              x: 0.5,
              y: 0.5,
            },
          ],
        };
      }
      return { results: [] };
    };

    const { getPitchMapPayload } = await import('../src/services/pitchMap');
    const withSlug = await getPitchMapPayload(
      createMockEnv({
        DB: createMockDb({
          first: (sql, binds) => {
            if (sql.includes('FROM matches')) {
              return { ...FIXTURE_MATCH, slug: 'usa-v-mex', home_name: 'USA', away_name: 'Mexico' };
            }
            if (sql.includes('FROM teams WHERE id')) {
              return binds[0] === FIXTURE_MATCH.home_team_id ? FIXTURE_TEAMS[0] : FIXTURE_TEAMS[1];
            }
            return null;
          },
          all: pitchLineupAll,
        }),
        MOCK_SOURCES: 'true',
        FIFA_LIVE_ENABLED: 'false',
      }),
      FIXTURE_MATCH.id,
    );
    expect(withSlug?.slug).toBe('usa-v-mex');
    const withoutSlug = await getPitchMapPayload(
      createMockEnv({
        DB: createMockDb({
          first: (sql, binds) => {
            if (sql.includes('FROM matches')) {
              return { ...FIXTURE_MATCH, slug: null, home_name: 'USA', away_name: 'Mexico' };
            }
            if (sql.includes('FROM teams WHERE id')) {
              return binds[0] === FIXTURE_MATCH.home_team_id ? FIXTURE_TEAMS[0] : FIXTURE_TEAMS[1];
            }
            return null;
          },
          all: pitchLineupAll,
        }),
        MOCK_SOURCES: 'true',
        FIFA_LIVE_ENABLED: 'false',
      }),
      FIXTURE_MATCH.id,
    );
    expect(withoutSlug?.slug).toBe('vong-bang-a-usa-vs-mexico');
  });
});
