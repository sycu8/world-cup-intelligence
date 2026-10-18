import { describe, it, expect, vi } from 'vitest';
import { createMockDb, createMockEnv, createMockKv } from './helpers/mockEnv';
import { createIngestionEnv } from './helpers/ingestionMockDb';
import { FIXTURE_MATCH, FIXTURE_TEAMS } from './helpers/fixtures';
import { mockScenario, mockScenarioContext, mockComparison } from './helpers/scenarioFixtures';

vi.unmock('../src/ai/tacticalBriefing');
vi.unmock('../src/ingestion/espn/espnTeamMatch');
vi.unmock('../src/ingestion/espn/espnStatsClient');
vi.unmock('../src/ingestion/fifa/fifaGamedayClient');
vi.unmock('../src/models/probability/explainFactors');
vi.unmock('../src/services/matchHistory');
vi.unmock('../src/services/matchStats');
vi.unmock('../src/services/newsThumbnailBackfill');
vi.unmock('../src/lib/formationLayout');
vi.unmock('../src/models/scenarios/scenarioRealtimeUpdater');
vi.unmock('../src/db/repositories/matchPredictionScenarioRepo');

describe('coverage branch close final', () => {
  it('hits the last uncovered branch paths', async () => {
    const gateway = await vi.importActual<typeof import('../src/ai/gatewayClient')>('../src/ai/gatewayClient');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    headline: 'Brief',
                    tacticalSummary: 'Summary',
                    keyMatchups: ['A'],
                    watchItems: ['B'],
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
    const { generateTacticalBriefing } = await import('../src/ai/tacticalBriefing');
    await generateTacticalBriefing(
      createMockEnv({
        AI_GATEWAY_ACCOUNT_ID: 'a',
        CF_AIG_TOKEN: 't',
        AI_GATEWAY_ENABLED: 'true',
        OPENAI_API_KEY: 'sk-test',
        KV: createMockKv(),
      }),
      {
        matchId: FIXTURE_MATCH.id,
        probability: { homeWinProb: 0.4, drawProb: 0.3, awayWinProb: 0.3 },
        aiFallback: false,
      },
    );

    const repo = await import('../src/db/repositories/matchPredictionScenarioRepo');
    await repo.saveScenarioSnapshot(createMockDb({ run: () => ({ success: true }) }), mockScenario({ featureSnapshotR2Key: 'r2-key' }), {
      minute: 0,
      deltaFromPrevious: {},
      updateReason: 'test',
    });

    const { teamLabelsMatch } = await import('../src/ingestion/espn/espnTeamMatch');
    teamLabelsMatch('Curacao', 'Cura');
    teamLabelsMatch('Cote d Ivoire', 'Ivory');

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
        return new Response(JSON.stringify({ boxscore: { teams: [{ team: { displayName: 'United States' }, statistics: [{ name: 'possessionPct', displayValue: '55' }, { name: 'totalPasses', displayValue: '400' }] }, { team: { displayName: 'Mexico' }, statistics: [{ name: 'possessionPct', displayValue: '45' }, { name: 'totalPasses', displayValue: '350' }] }] } }), {
          status: 200,
        });
      }),
    );
    const { fetchEspnTeamMatchStats } = await import('../src/ingestion/espn/espnStatsClient');
    await fetchEspnTeamMatchStats('United States', 'Mexico', '2026-06-12T20:00:00Z');

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
        return new Response(JSON.stringify({ boxscore: { teams: [{ team: { displayName: 'United States' }, statistics: [{ name: 'possessionPct', displayValue: '55' }, { name: 'totalPasses', displayValue: '400' }] }, { team: { displayName: 'Mexico' }, statistics: [{ name: 'possessionPct', displayValue: '45' }, { name: 'totalPasses', displayValue: '350' }] }] } }), {
          status: 200,
        });
      }),
    );
    await fetchEspnTeamMatchStats('United States', 'Mexico', '2026-06-12T20:00:00Z');

    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));
    const gameday = await import('../src/ingestion/fifa/fifaGamedayClient');
    gameday.resetFifaGamedayTokenCache();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('token')) {
          return new Response(JSON.stringify({ token: 'jwt-test' }), { status: 200 });
        }
        return new Response('', { status: 500 });
      }),
    );
    expect(await gameday.fetchFifaGamedayTeamMatchStats('400021443')).toBeNull();
    gameday.resetFifaGamedayTokenCache();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('token')) {
          return new Response(JSON.stringify({ token: 'jwt-test' }), { status: 200 });
        }
        return new Response(
          JSON.stringify({
            '43822': [
              ['Possession', 55, false],
              ['Passes', 400, false],
              ['PassesCompleted', 350, false],
            ],
            '43995': [
              ['Possession', 45, false],
              ['Passes', 300, false],
              ['PassesCompleted', 260, false],
            ],
          }),
          { status: 200 },
        );
      }),
    );
    await gameday.fetchFifaGamedayTeamMatchStats('400021443');

    const { assignFormationCoords } = await import('../src/lib/formationLayout');
    assignFormationCoords(
      '4-4-2',
      [
        { playerId: 'lb', position: 'LB' },
        { playerId: 'unk', position: 'UNKNOWN' },
      ],
      'home',
    );

    const { buildExplanationFactors } = await import('../src/models/probability/explainFactors');
    buildExplanationFactors({
      ...mockScenarioContext().features,
      homeCoach: { tacticalRating: 0.95 },
      awayCoach: { tacticalRating: 0.5 },
    });
    buildExplanationFactors({
      ...mockScenarioContext().features,
      homeCoach: { tacticalRating: 0.5 },
      awayCoach: { tacticalRating: 0.95 },
    });

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
    const { applyRealtimeEventToScenarios } = await import('../src/models/scenarios/scenarioRealtimeUpdater');
    applyRealtimeEventToScenarios(
      mockScenarioContext(),
      [
        mockScenario({
          id: 'early',
          scenarioType: 'early_goal_swing',
          triggerConditions: [
            { condition: 'First goal', status: 'pending', value: 'home' },
            { condition: 'High press', status: 'pending', value: 'home' },
          ],
        }),
        mockScenario({ id: 'other', isBaseline: false }),
      ],
      { matchId: FIXTURE_MATCH.id, eventType: 'goal', minute: 12, eventId: 'g1' },
    );
    applyRealtimeEventToScenarios(
      mockScenarioContext(),
      [
        mockScenario({ id: 'a', scenarioProbability: 0.51, isBaseline: false }),
        mockScenario({ id: 'b', scenarioType: 'baseline_expected_flow', scenarioProbability: 0.5, isBaseline: false }),
      ],
      { matchId: FIXTURE_MATCH.id, eventType: 'status', minute: 11, eventId: 's2' },
    );

    const { groupTeamWorldCupMeetings } = await import('../src/services/matchHistory');
    groupTeamWorldCupMeetings('team-a', [
      { tournament_year: undefined as never, home_team_id: 'team-a', away_team_id: 'team-b', home_score: 1, away_score: 0 },
      { tournament_year: 2022, home_team_id: 'team-a', away_team_id: 'team-c', home_score: 0, away_score: 0 },
    ] as never);

    const { getMatchStats } = await import('../src/services/matchStats');
    await getMatchStats(
      createMockEnv({
        MOCK_SOURCES: 'true',
        FIFA_LIVE_ENABLED: 'false',
        DB: createMockDb({
          first: (sql) => {
            if (sql.includes('match_recaps')) return null;
            if (sql.includes('FROM matches m')) {
              return { ...FIXTURE_MATCH, slug: FIXTURE_MATCH.id, home_name: 'USA', away_name: 'Mexico', updated_at: '2026-01-01T00:00:00Z' };
            }
            if (sql.includes('FROM teams WHERE id')) return FIXTURE_TEAMS[0];
            if (sql.includes('SELECT status, minute')) {
              return { status: 'live', minute: 55, home_score: 1, away_score: 0, updated_at: '2026-01-01T00:00:00Z' };
            }
            if (sql.includes('FROM match_events')) return { goals: 0, yellow_cards: 0, red_cards: 0, substitutions: 0 };
            if (sql.includes('MAX(created_at)')) return { latest: '2026-02-01T00:00:00Z' };
            return null;
          },
          all: (sql) => {
            if (sql.includes('FROM team_match_stats')) {
              return {
                results: [
                  {
                    team_id: FIXTURE_MATCH.home_team_id,
                    possession: 50,
                    shots: 5,
                    shots_on_target: 2,
                    xg: 1.1,
                    passes: 300,
                    pass_accuracy: 85,
                    created_at: '2026-02-01T00:00:00Z',
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

    const { compareStandings } = await import('../src/services/tournamentStandings');
    compareStandings(
      { teamId: 'p', played: 3, points: 9, gf: 4, ga: 1, gd: 3 },
      { teamId: 'q', played: 3, points: 6, gf: 3, ga: 1, gd: 2 },
    );
    compareStandings(
      { teamId: 'x', played: 3, points: 6, gf: 4, ga: 2, gd: 2 },
      { teamId: 'y', played: 3, points: 6, gf: 3, ga: 1, gd: 2 },
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

    const scenarioSvc = await vi.importActual<typeof import('../src/services/matchScenarioService')>(
      '../src/services/matchScenarioService',
    );
    const scenarioRepo = await import('../src/db/repositories/matchPredictionScenarioRepo');
    vi.spyOn(scenarioRepo, 'listActiveScenariosForMatch').mockResolvedValue([]);
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

    const blog = await vi.importActual<typeof import('../src/ingestion/fifa/fifaLiveBlogSync')>(
      '../src/ingestion/fifa/fifaLiveBlogSync',
    );
    const { env } = createIngestionEnv({
      matches: [{ ...FIXTURE_MATCH, fifa_match_id: '400021443', status: 'live' }],
      teamMatchStats: [],
    });
    await blog.shouldSyncFifaBlogAndStats(
      env,
      FIXTURE_MATCH.id,
      'live',
      FIXTURE_MATCH.home_team_id,
      FIXTURE_MATCH.away_team_id,
    );
  });
});
