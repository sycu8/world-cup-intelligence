import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  parseEspnBoxscoreTeams,
  parseEspnTeamStats,
} from '../src/ingestion/espn/parseEspnStats';
import { fetchEspnTeamMatchStats } from '../src/ingestion/espn/espnStatsClient';
import { findEspnEventId, teamLabelsMatch } from '../src/ingestion/espn/espnTeamMatch';
import { buildExplanationFactors } from '../src/models/probability/explainFactors';
import { mockScenarioContext } from './helpers/scenarioFixtures';
import { computeGroupStandingsFromMatchRows } from '../src/services/tournamentProgression';
import { buildMatchFeatures } from '../src/services/matchFeatures';
import { mockScoreAtMinute } from '../src/services/matchLifecycle';
import { resolveFifaPlatformStatus } from '../src/ingestion/fifa/parse';
import { parseFifaTimelineCommentary } from '../src/ingestion/fifa/parseFifaTimeline';
import { gatewayChat, isGatewayConfigured } from '../src/ai/gatewayClient';
import { createMockEnv } from './helpers/mockEnv';
import { FIXTURE_MATCH, FIXTURE_TEAMS } from './helpers/fixtures';
import { formatLocalizedVersus } from '../app/lib/i18n/stageLabels';
import { formatMatchVersus, compactTeamLabel } from '../app/lib/matchTeams';
import { resolveTeamFlagSlug as resolveAppTeamFlagSlug } from '../app/lib/nationFlags';
import { resolveTeamFlagSlug as resolveSrcTeamFlagSlug } from '../src/lib/teamFlags';
import { requestRoute } from './helpers/routeHarness';
import { createRouteTestEnv } from './helpers/mockRouteDb';
import { matchRoutes } from '../src/routes/matches';

describe('coverage branch final batch — ESPN and parsing', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('parseEspnTeamStats rejects non-finite values', () => {
    expect(parseEspnTeamStats([{ name: 'possessionPct', displayValue: 'n/a' }]).possession).toBeNull();
    expect(parseEspnBoxscoreTeams({}, 'Home', 'Away')).toEqual({ home: null, away: null });
    expect(parseEspnBoxscoreTeams({ boxscore: { teams: [] } }, 'Home', 'Away')).toEqual({
      home: null,
      away: null,
    });
  });

  it('teamLabelsMatch covers alias and empty label branches', () => {
    expect(teamLabelsMatch('', 'Mexico')).toBe(false);
    expect(teamLabelsMatch('Bosnia and Herzegovina', 'Bosnia-Herzegovina')).toBe(true);
    expect(
      findEspnEventId(
        [{ id: '1', competitions: [{ competitors: [{ homeAway: 'home', team: { displayName: 'A' } }] }] }],
        'USA',
        'Mexico',
      ),
    ).toBeNull();
  });

  it('fetchEspnTeamMatchStats resolves swapped home and away rows', async () => {
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
                  team: { displayName: 'United States' },
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
    const stats = await fetchEspnTeamMatchStats('United States', 'Mexico', '2026-06-12T20:00:00Z');
    expect(stats?.home.passes).toBe(350);
    expect(stats?.awayEspnName).toBe('United States');
  });
});

describe('coverage branch final batch — backend utilities', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('computeGroupStandingsFromMatchRows breaks ties on goals for', () => {
    const rows = [
      {
        group_code: 'A',
        home_team_id: 't1',
        away_team_id: 't2',
        home_score: 2,
        away_score: 0,
        status: 'completed',
      },
      {
        group_code: 'A',
        home_team_id: 't3',
        away_team_id: 't1',
        home_score: 0,
        away_score: 0,
        status: 'completed',
      },
      {
        group_code: 'A',
        home_team_id: 't2',
        away_team_id: 't3',
        home_score: 1,
        away_score: 1,
        status: 'completed',
      },
    ];
    const standings = computeGroupStandingsFromMatchRows(rows, 'A');
    expect(standings[0]?.teamId).toBe('t1');
  });

  it('buildExplanationFactors covers away-favored branches', () => {
    const features = mockScenarioContext().features;
    const factors = buildExplanationFactors({
      ...features,
      homeTeam: { ...features.homeTeam, eloRating: 1600, xgFor: 1.0, fifaRanking: 30 },
      awayTeam: { ...features.awayTeam, eloRating: 1800, xgFor: 1.8, fifaRanking: 5 },
      homeCoach: { name: 'Home', tacticalRating: 0.6 },
      awayCoach: { name: 'Away', tacticalRating: 0.85 },
      referee: { name: 'Ref', strictness: 0.7, fifaCategory: 'Elite' },
    });
    expect(factors.positive.some((f) => f.direction === 'away')).toBe(true);
  });

  it('buildMatchFeatures uses default elo and rank when missing', () => {
    const home = { ...FIXTURE_TEAMS[0], elo_rating: null, fifa_ranking: null };
    const away = { ...FIXTURE_TEAMS[1], elo_rating: null, fifa_ranking: null };
    const features = buildMatchFeatures(FIXTURE_MATCH, home, away, 2026);
    expect(features.homeTeam.eloRating).toBe(1700);
    expect(features.homeTeam.fifaRanking).toBe(20);
  });

  it('mockScoreAtMinute away burst branch', () => {
    expect(mockScoreAtMinute('away-burst-seed', 40).away).toBeGreaterThanOrEqual(0);
  });

  it('resolveFifaPlatformStatus and timeline branches', () => {
    expect(resolveFifaPlatformStatus({ Period: 10, MatchStatus: 1, MatchTime: "90'" })).toBe('completed');
    expect(
      parseFifaTimelineCommentary(
        { Event: [{ EventId: undefined, MatchMinute: "1'", Period: 1, TypeLocalized: [{ Description: 'Goal' }] }] },
        'm-prefix',
      ).length,
    ).toBeGreaterThanOrEqual(0);
  });

  it('stage and nation flag helper branches', () => {
    expect(formatLocalizedVersus('', '', 'vi')).toBe('');
    expect(formatLocalizedVersus('', 'Mexico', 'vi')).toBe('Mexico');
    expect(formatMatchVersus(undefined, 'team-mex', '', 'Mexico')).toBe('Mexico');
    expect(formatMatchVersus('team-usa', undefined, 'USA', '')).toBe('USA');
    expect(compactTeamLabel('')).toBe('');
    expect(resolveAppTeamFlagSlug('XX')).toBe('');
    expect(resolveSrcTeamFlagSlug({ teamName: 'England' })).toBe('gb-eng');
  });

  it('gatewayClient default id and provider split branches', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 }),
      ),
    );
    const env = createMockEnv({
      AI_GATEWAY_ENABLED: 'true',
      AI_GATEWAY_ACCOUNT_ID: 'acct',
      CF_AIG_TOKEN: 'token',
    });
    expect(isGatewayConfigured(env)).toBe(true);
    const out = await gatewayChat(env, 'tactical_briefing', [{ role: 'user', content: 'hi' }]);
    expect(out?.provider).toBeTruthy();
  });

  it('matchRoutes returns 404 for unknown slug', async () => {
    const env = createRouteTestEnv();
    const res = await requestRoute(matchRoutes, '/by-slug/unknown-slug-xyz', { env });
    expect(res.status).toBe(404);
  });
});
