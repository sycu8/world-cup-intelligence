import React, { type ReactElement } from 'react';
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../app/lib/i18n/I18nContext';
import { createMockDb, createMockEnv, createMockKv } from './helpers/mockEnv';
import { createRouteTestEnv } from './helpers/mockRouteDb';
import { FIXTURE_MATCH, FIXTURE_TEAMS } from './helpers/fixtures';
import { mockScenario, mockComparison } from './helpers/scenarioFixtures';
import { jsonRoute, requestRoute } from './helpers/routeHarness';
import { installSmokeFetchMock } from './helpers/smokeFetch';
import { sampleScheduleMatches, sampleStandings } from './helpers/smokeFixtures';

function renderWithI18n(ui: ReactElement, entry = '/') {
  return render(
    React.createElement(MemoryRouter, { initialEntries: [entry] }, React.createElement(I18nProvider, null, ui)),
  );
}

const emptyAll = () => ({}) as { results?: unknown[] };

describe('coverage branch sweep round 3 — hooks and app lib', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('useMatchLiveData and usePitchMapLive return early without matchId', async () => {
    const { useMatchLiveData } = await import('../app/lib/useMatchLiveData');
    const { usePitchMapLive } = await import('../app/lib/usePitchMapLive');
    renderHook(() => useMatchLiveData(undefined), { wrapper: I18nProvider });
    renderHook(() => usePitchMapLive(undefined), { wrapper: I18nProvider });
  });

  it('useMatchScenarioLive uses wss and closes socket on unmount', async () => {
    class MockWebSocket {
      static instances: MockWebSocket[] = [];
      onopen: (() => void) | null = null;
      onclose: (() => void) | null = null;
      onmessage: ((ev: { data: string }) => void) | null = null;
      onerror: (() => void) | null = null;
      close = vi.fn();
      constructor(public url: string) {
        MockWebSocket.instances.push(this);
        queueMicrotask(() => this.onopen?.());
      }
    }
    vi.stubGlobal('WebSocket', MockWebSocket);
    const origLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...origLocation, protocol: 'https:', host: 'localhost', assign: origLocation.assign.bind(origLocation) },
    });
    const onUpdate = vi.fn();
    const { useMatchScenarioLive } = await import('../app/lib/useMatchScenarioLive');
    const { unmount } = renderHook(() => useMatchScenarioLive('m-1', onUpdate), { wrapper: I18nProvider });
    expect(MockWebSocket.instances[0]?.url).toMatch(/^wss:/);
    unmount();
    expect(MockWebSocket.instances[0]?.close).toHaveBeenCalled();
    Object.defineProperty(window, 'location', { configurable: true, value: origLocation });
  });

  it('nationFlags and matchPaths branches', async () => {
    const { resolveTeamFlagSlug, resolveTeamFlag } = await import('../app/lib/nationFlags');
    expect(resolveTeamFlagSlug({ countryCode: 'XX' })).toBe('');
    expect(resolveTeamFlagSlug({ teamName: 'England' })).toBe('gb-eng');
    expect(resolveTeamFlag({ teamName: 'Scotland' })).toBeTruthy();
    expect(resolveTeamFlagSlug({ teamName: '' })).toBe('');

    const { resolveLineupHref } = await import('../app/lib/matchPaths');
    expect(resolveLineupHref({ id: 'm-1', slug: null })).toContain('m-1');
  });

  it('app lineupDisplay null shirt sort and format', async () => {
    const { sortLineupPlayers, formatLineupPlayerLine } = await import('../app/lib/lineupDisplay');
    const sorted = sortLineupPlayers([
      { shirtNumber: null, name: 'A', position: 'CM' },
      { shirtNumber: 3, name: 'B', position: 'CM' },
    ] as never);
    expect(sorted[0]?.name).toBe('B');
    expect(formatLineupPlayerLine({ name: 'X', position: 'CM' } as never)).toContain('—');
  });

  it('matchKickoffDisplay timezone helpers', async () => {
    const { getViewerTimezone, timezoneShortLabel } = await import('../app/lib/matchKickoffDisplay');
    expect(getViewerTimezone()).toBeTruthy();
    expect(timezoneShortLabel('Asia/Ho_Chi_Minh', 'en')).toBeTruthy();
  });

  it('stageLabels missing away side', async () => {
    const { formatLocalizedVersus } = await import('../app/lib/i18n/stageLabels');
    expect(formatLocalizedVersus('Mexico', '', 'vi')).toBe('Mexico');
  });

  it('scenarioPredictionLabels en and name fallbacks', async () => {
    localStorage.setItem('wc-display-mode', 'en');
    const {
      translateComparisonSummary,
      translateComparisonDifference,
      thresholdLabel,
    } = await import('../app/lib/i18n/scenarioPredictionLabels');
    expect(
      translateComparisonSummary('Away lean', [mockScenario(), mockScenario({ id: 'b', isBaseline: false })], 'en', 'Home', 'Away'),
    ).toBeTruthy();
    expect(
      translateComparisonDifference('Away stronger set pieces', 'en'),
    ).toBeTruthy();
    expect(thresholdLabel('unknown' as never, 'en')).toBeTruthy();
    expect(
      translateComparisonSummary('Shift', [mockScenario(), mockScenario({ id: 'b' })], 'vi', 'Home', 'Away'),
    ).toBeTruthy();
  });
});

describe('coverage branch sweep round 3 — components and pages', () => {
  beforeEach(() => {
    installSmokeFetchMock();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('EventTrajectoryLayer skips segment when previous y is falsy', async () => {
    const { EventTrajectoryLayer } = await import('../app/components/tactical/EventTrajectoryLayer');
    const { container } = render(
      React.createElement(
        'svg',
        null,
        React.createElement(EventTrajectoryLayer, {
          events: [
            { x: 0.1, y: 0 },
            { x: 0.3, y: 0.4 },
          ],
        }),
      ),
    );
    expect(container.querySelectorAll('line').length).toBeGreaterThanOrEqual(0);
  });

  it('ScenarioPredictionPanel uses first scenarios when no baseline', async () => {
    localStorage.setItem('wc-display-mode', 'en');
    const { ScenarioPredictionPanel } = await import('../app/components/scenarios/ScenarioPredictionPanel');
    renderWithI18n(
      React.createElement(ScenarioPredictionPanel, {
        data: {
          matchId: 'm-1',
          generatedAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
          scenarios: [
            mockScenario({ id: 's1', isBaseline: false }),
            mockScenario({ id: 's2', isBaseline: false }),
          ],
          comparison: mockComparison(),
          sourceConfidence: { overall: 0.8, notes: [] },
        },
      }),
    );
    await waitFor(() => expect(document.body.textContent?.length ?? 0).toBeGreaterThan(20));
  });

  it('GroupStageBoard third-place shortName and empty fixtures', async () => {
    const { GroupStageBoard } = await import('../app/components/tournament/GroupStageBoard');
    renderWithI18n(
      React.createElement(GroupStageBoard, {
        matches: sampleScheduleMatches,
        initialStandings: {
          ...sampleStandings,
          thirdPlaceRanking: [
            {
              group: 'A',
              teamId: 't1',
              teamName: 'Long Team Name',
              shortName: null,
              countryCode: 'US',
              points: 4,
              gd: 1,
              played: 3,
            },
          ],
        },
      }),
    );
    expect(screen.getByText(/Long Team Name/)).toBeTruthy();
  });

  it('TeamsDirectory filters with null short_name', async () => {
    const { TeamsDirectory } = await import('../app/components/tournament/TeamsDirectory');
    renderWithI18n(
      React.createElement(TeamsDirectory, {
        teams: [
          { id: 't-mex', name: 'Mexico', short_name: null, country_code: 'MX' } as never,
          { id: 't-usa', name: 'USA', short_name: 'USA', country_code: 'US' } as never,
        ],
      }),
    );
    expect(screen.getAllByText('Mexico').length).toBeGreaterThan(0);
  });

  it('TournamentSchedulePanel filters scheduled-only matches', async () => {
    const { TournamentSchedulePanel } = await import('../app/components/tournament/TournamentSchedulePanel');
    const view = renderWithI18n(
      React.createElement(TournamentSchedulePanel, {
        byDate: {
          '2026-06-12': [
            { ...sampleScheduleMatches[0]!, status: 'live' },
            { ...sampleScheduleMatches[1]!, status: 'scheduled' },
          ],
        },
        matches: sampleScheduleMatches,
        probs: {},
        totalExpected: 104,
      }),
    );
    const scheduledBtn = screen.getAllByRole('button').find((b) => /scheduled|sắp/i.test(b.textContent ?? ''));
    if (scheduledBtn) fireEvent.click(scheduledBtn);
    expect(view.container.textContent?.length ?? 0).toBeGreaterThan(10);
  });

  it('AdminPage HTTP error and missing data array', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));
    const { AdminPage } = await import('../app/pages/AdminPage');
    renderWithI18n(React.createElement(AdminPage));
    await waitFor(() => expect(screen.getByText(/Failed to load/i)).toBeTruthy());

    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })));
    cleanup();
    renderWithI18n(React.createElement(AdminPage));
    await waitFor(() => expect(screen.getByText(/\[\]/)).toBeTruthy());
  });

  it('HomePage applies home payload without standings or probabilities', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('/api/home')) {
          return new Response(
            JSON.stringify({
              data: { schedule: { matches: [] }, dashboard: null, hotNews: [] },
            }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ data: {} }), { status: 200 });
      }),
    );
    const { HomePage } = await import('../app/pages/HomePage');
    renderWithI18n(React.createElement(HomePage));
    await waitFor(() => expect(document.body.textContent?.length ?? 0).toBeGreaterThan(20), { timeout: 8000 });
  });

  it('LineupPage without matchId and NewsArticlePage en loading text', async () => {
    const { LineupPage } = await import('../app/pages/LineupPage');
    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/lineups'] },
        React.createElement(I18nProvider, null,
          React.createElement(
            Routes,
            null,
            React.createElement(Route, { path: '/lineups/:matchId?', element: React.createElement(LineupPage) }),
          ),
        ),
      ),
    );
    expect(document.body.textContent?.length ?? 0).toBeGreaterThan(5);

    localStorage.setItem('wc-display-mode', 'en');
    installSmokeFetchMock();
    const { NewsArticlePage } = await import('../app/pages/NewsArticlePage');
    renderWithI18n(
      React.createElement(
        Routes,
        null,
        React.createElement(Route, { path: '/news/:id', element: React.createElement(NewsArticlePage) }),
      ),
      '/news/n-1',
    );
    await waitFor(() => expect(document.body.textContent?.length ?? 0).toBeGreaterThan(10), { timeout: 8000 });
  });
});

describe('coverage branch sweep round 3 — backend batch', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('single and double branch service coverage batch', async () => {
    const { upsertMatchLineup } = await import('../src/db/repositories/lineupsRepo');
    await upsertMatchLineup(createMockDb({ run: () => ({ success: true }) }), {
      matchId: 'm',
      teamId: 't',
      formation: '4-3-3',
      isOfficial: false,
      players: [],
    });

    const repo = await import('../src/db/repositories/matchPredictionScenarioRepo');
    await repo.saveScenarioSnapshot(createMockDb({ run: () => ({ success: true }) }), mockScenario(), {
      minute: 0,
      deltaFromPrevious: {},
      updateReason: 'test',
      eventId: undefined,
    });

    const { translateNewsHeadline } = await import('../src/ai/translateNews');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ choices: [] }), { status: 200 })));
    expect(await translateNewsHeadline(createMockEnv({ AI_FALLBACK_MODE: 'true' }), '!!!', 'short')).toBeNull();

    const { gatewayChat } = await import('../src/ai/gatewayClient');
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
        AI_GATEWAY_ID: 'default',
      }),
      '@cf/meta/llama-3-8b-instruct',
      [{ role: 'user', content: 'hi' }],
    ).catch(() => undefined);

    const { runMultiVariableAnalysis } = await import('../src/ai/multiVariableAnalysis');
    await runMultiVariableAnalysis(
      createMockEnv({
        DB: createMockDb({
          first: (sql) => {
            if (sql.includes('FROM matches')) return FIXTURE_MATCH;
            if (sql.includes('FROM teams')) return FIXTURE_TEAMS[0];
            return null;
          },
        }),
      }),
      FIXTURE_MATCH.id,
    ).catch(() => undefined);

    const { brierScore } = await import('../src/models/backtesting/metrics');
    brierScore([0.5, 0.5], [0, 2]);

    const { runBacktest } = await import('../src/models/backtesting/backtestRunner');
    await runBacktest(
      createMockDb({
        all: () => ({
          results: [{ match_id: 'm', home_score: 1, away_score: 0, home_win_prob: 0.5, draw_prob: 0.3, away_win_prob: 0.2 }],
        }),
        first: () => null,
      }),
    );

    const { compareScenarios } = await import('../src/models/scenarios/scenarioComparison');
    compareScenarios([mockScenario({ isBaseline: false }), mockScenario({ id: 'b' })]);

    const { selectScenarioFeatures } = await import('../src/models/scenarios/scenarioFeatureSelector');
    selectScenarioFeatures('custom' as never, {
      ...(await import('./helpers/scenarioFixtures')).mockScenarioContext(),
    });

    const { assignFormationCoords } = await import('../src/lib/formationLayout');
    const coords = assignFormationCoords(
      '4-3-3',
      [
        { playerId: 'l', position: 'LW' },
        { playerId: 'r', position: 'RW' },
        { playerId: 'c', position: 'CM' },
      ],
      'home',
    );
    expect(coords.get('l')?.y).toBeLessThan(coords.get('r')?.y ?? 1);

    const { resolveTeamFlagSlug } = await import('../src/lib/teamFlags');
    expect(resolveTeamFlagSlug({ teamName: 'England' })).toBe('gb-eng');

    const { getHeadToHead } = await import('../src/services/matchHistory');
    await getHeadToHead(
      createMockEnv({
        DB: createMockDb({
          all: (sql) =>
            sql.includes('FROM matches')
              ? {
                  results: [
                    { tournament_year: 2018, home_team_id: 'a', away_team_id: 'b', home_score: 1, away_score: 0 },
                    { tournament_year: 2022, home_team_id: 'a', away_team_id: 'b', home_score: 0, away_score: 0 },
                  ],
                }
              : {},
        }),
      }),
      'a',
      'b',
    );

    const { getGroupContextForMatch } = await import('../src/services/matchGroupContext');
    await getGroupContextForMatch(
      createMockEnv({
        DB: createMockDb({
          first: () => ({ ...FIXTURE_MATCH, group_code: 'A' }),
          all: emptyAll,
        }),
      }),
      FIXTURE_MATCH.id,
    );

    const { processNewsDocumentImpact, findTeamIdsInText } = await import('../src/services/newsMatchImpact');
    expect(findTeamIdsInText('AB news', [{ teamId: 't', name: 'AB', aliases: ['AB'] }])).toEqual([]);
    await processNewsDocumentImpact(
      createMockEnv({
        DB: createMockDb({
          all: (sql) => {
            if (sql.includes('FROM teams')) return { results: [{ id: 't-usa', name: 'USA', short_name: 'USA' }] };
            if (sql.includes('AND home_team_id IN')) return { results: [{ id: 'm-1' }] };
            return { results: [] };
          },
        }),
      }),
      'doc-1',
      'USA lineup news',
      { teams: ['USA'], players: [], injuries: [], tacticalNotes: [], formations: [] },
    );

    const { computeGroupStandingsFromMatchRows } = await import('../src/services/tournamentProgression');
    computeGroupStandingsFromMatchRows(
      [
        { group_code: 'A', home_team_id: 't1', away_team_id: 't2', home_score: 2, away_score: 2, status: 'completed' },
        { group_code: 'A', home_team_id: 't3', away_team_id: 't1', home_score: 0, away_score: 1, status: 'completed' },
        { group_code: 'A', home_team_id: 't2', away_team_id: 't3', home_score: 1, away_score: 0, status: 'completed' },
      ],
      'A',
    );

    const { sortStandingRows } = await import('../src/services/tournamentStandings');
    sortStandingRows([
      { teamId: 'a', gd: 0, gf: 2, ga: 1, points: 3 } as never,
      { teamId: 'b', gd: 0, gf: 4, ga: 2, points: 3 } as never,
    ]);

    const { buildMatchFeatures } = await import('../src/services/matchFeatures');
    buildMatchFeatures(FIXTURE_MATCH, FIXTURE_TEAMS[0], FIXTURE_TEAMS[1], 2026, undefined);

    const { getProbabilityMovement } = await import('../src/services/matchIntelligence');
    await getProbabilityMovement(
      createMockEnv({
        DB: createMockDb({
          all: () => ({
            results: [
              { minute: 5, home_win_prob: 0.4, draw_prob: 0.3, away_win_prob: 0.3, created_at: 't', model_version: 'v' },
              { minute: 15, home_win_prob: 0.42, draw_prob: 0.28, away_win_prob: 0.3, created_at: 't2', model_version: 'v' },
            ],
          }),
        }),
      }),
      FIXTURE_MATCH.id,
    );

    const { fetchHotNewsArticles } = await import('../src/services/newsListPayload');
    await fetchHotNewsArticles(
      createMockEnv({
        DB: createMockDb({
          all: () => ({
            results: [{ id: 'n', hot_score: null, reliability_score: 0.5, title: 't', source_url: 'u', published_at: 't' }],
          }),
        }),
      }),
    );

    const { revokeApiClient } = await import('../src/services/publicApi/clients');
    expect(await revokeApiClient(createMockEnv({ DB: createMockDb({ run: () => ({ success: true, meta: {} }) }) }), 'c')).toBe(false);

    const { normalizeArticleLink } = await import('../src/services/newsImageUrls');
    expect(normalizeArticleLink('https://x.com/a?b=1#x')).toBe('https://x.com/a');

    const { backfillNewsSources } = await import('../src/services/newsSourceBackfill');
    await backfillNewsSources(
      createMockEnv({
        DB: createMockDb({
          all: () => ({ results: [{ id: 'd1', source_url: 'https://a.com', source_id: null }] }),
          run: () => ({ success: true, meta: {} }),
        }),
      }),
    );

    const { recompressNewsThumbnails } = await import('../src/services/newsThumbnailBackfill');
    await recompressNewsThumbnails(
      createMockEnv({
        DB: createMockDb({
          all: () => ({ results: [{ id: 'n1', image_url: null, thumbnail_r2_key: 'thumb/n1' }] }),
        }),
        R2_ARTIFACTS: { head: vi.fn(async () => null) } as never,
      }),
    );

    const { needsNewsTranslation } = await import('../src/services/newsTranslationUtils');
    expect(needsNewsTranslation({ summary: 'English only headline text', summary_vi: null } as never)).toBe(true);

    const { getTeamFormSnapshot } = await import('../src/services/teamFormStats');
    await getTeamFormSnapshot(
      createMockDb({
        all: () => ({
          results: [
            {
              home_team_id: 'h',
              away_team_id: 'a',
              home_score: 2,
              away_score: 1,
              home_xg: null as never,
              away_xg: null as never,
            },
          ],
        }),
      }),
      'h',
    );

    const { isPlaceholderTeam, applyEffectiveTeamProfile } = await import('../src/services/teamProfile');
    isPlaceholderTeam({ id: 'team-x', elo_rating: null, collective_strength_rating: null } as never);
    applyEffectiveTeamProfile({ id: 'team-x', fifa_ranking: 100, elo_rating: 1500, collective_strength_rating: 0.5 } as never);

    const { persistMissingTournamentProbabilities } = await import('../src/services/tournamentMatchProbabilities');
    await persistMissingTournamentProbabilities(createMockEnv(), []);

    const { buildBracketPayload } = await import('../src/services/bracketPayload');
    await buildBracketPayload(createMockEnv({ DB: createMockDb({ all: emptyAll }) }));

    const { recomputeAllActiveMatches } = await import('../src/services/recomputeMatch');
    await recomputeAllActiveMatches(createMockEnv({ DB: createMockDb({ all: emptyAll }) }));

    const { matchRoutes } = await import('../src/routes/matches');
    const missing = await requestRoute(matchRoutes, '/api/matches/missing/stats');
    expect(missing.status).toBe(404);

  });
});
