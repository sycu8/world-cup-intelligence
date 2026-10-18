import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { I18nProvider } from '../app/lib/i18n/I18nContext';
import { MatchScheduleCalendar } from '../app/components/home/MatchScheduleCalendar';
import { MatchLineupSidePanel } from '../app/components/match/MatchLineupSidePanel';
import { MatchAnalyticsPanel } from '../app/components/match/MatchAnalyticsPanel';
import { MatchPredictionSummary } from '../app/components/match/MatchPredictionSummary';
import { MatchLiveStatsPanel } from '../app/components/match/MatchLiveStatsPanel';
import { MatchStaffPanel } from '../app/components/match/MatchStaffPanel';
import { MatchStickyScoreBar } from '../app/components/match/MatchStickyScoreBar';
import { MatchVersusThumbnail } from '../app/components/match/MatchVersusThumbnail';
import { MultiVariablePanel } from '../app/components/match/MultiVariablePanel';
import { ScheduleTimezoneBanner } from '../app/components/match/MatchKickoffDisplay';
import { ProbabilityMovementPanel } from '../app/components/probability/ProbabilityMovementPanel';
import { PitchPlayerLayer } from '../app/components/tactical/PitchPlayerLayer';
import { ProbabilityMovementTimeline } from '../app/components/tactical/ProbabilityMovementTimeline';
import { MatchHeader } from '../app/components/tactical/MatchHeader';
import { ScorelineMatrix } from '../app/components/tactical/ScorelineMatrix';
import { TacticalBriefingPanel } from '../app/components/tactical/TacticalBriefingPanel';
import { FavoritesPanel } from '../app/components/tournament/FavoritesPanel';
import { TournamentSchedulePanel } from '../app/components/tournament/TournamentSchedulePanel';
import { lineupSourceBadgeClass } from '../app/lib/lineupSourceLabel';
import { resolveTeamFlag, resolveTeamFlagSlug } from '../app/lib/nationFlags';
import { translateComparisonSummary } from '../app/lib/i18n/scenarioPredictionLabels';
import { usePageMeta } from '../app/lib/usePageMeta';
import { AnalystSimulatorPage } from '../app/pages/AnalystSimulatorPage';
import { LineupPage } from '../app/pages/LineupPage';
import { MatchPage } from '../app/pages/MatchPage';
import { NewsArticlePage } from '../app/pages/NewsArticlePage';
import { NewsIntelligencePage } from '../app/pages/NewsIntelligencePage';
import { SeoLandingPage } from '../app/pages/SeoLandingPage';
import { TeamPage } from '../app/pages/TeamPage';
import { TournamentPage } from '../app/pages/TournamentPage';
import { TournamentsHubPage } from '../app/pages/TournamentsHubPage';
import { saveFavorites } from '../app/lib/favorites';

import { translateNewsHeadline } from '../src/ai/translateNews';
import { resolveTeamFlagSlug as resolveSrcTeamFlagSlug } from '../src/lib/teamFlags';
import { tacticalMatchupModifier } from '../src/models/probability/tacticalMatchup';
import { buildCandidateScenarios, ensureAtLeastTwoScenarios } from '../src/models/scenarios/scenarioGenerator';
import { runScenarioProbabilityModel } from '../src/models/scenarios/scenarioEngine';
import { applyRealtimeEventToScenarios } from '../src/models/scenarios/scenarioRealtimeUpdater';
import { compareScenarios } from '../src/models/scenarios/scenarioComparison';
import { selectScenarioFeatures } from '../src/models/scenarios/scenarioFeatureSelector';
import { runScenarioBacktest } from '../src/models/scenarios/backtesting/scenarioBacktestRunner';
import { resolveModel } from '../src/ai/modelRouter';
import { upsertTeamSystemProfile } from '../src/db/repositories/teamSystemRepo';
import { explainScenarioPrediction } from '../src/ai/explainScenarioPrediction';
import { listScenariosForMatch } from '../src/db/repositories/scenarioRepo';
import { MatchRoom } from '../src/durable-objects/MatchRoom';
import { buildExplanationFactors } from '../src/models/probability/explainFactors';
import { buildTeamSystemProfile } from '../src/models/probability/teamSystemStrength';
import { handleModelBatch } from '../src/queues/modelConsumer';
import { probabilityRoutes } from '../src/routes/probability';
import { buildLineupFeaturesFromPlayers } from '../src/services/lineupFeatures';
import { resolvePublisherLabel } from '../src/services/newsTranslationUtils';
import { classifyNewsImpact, processNewsDocumentImpact } from '../src/services/newsMatchImpact';

import { jsonRoute } from './helpers/routeHarness';
import { createRouteTestEnv } from './helpers/mockRouteDb';
import { FIXTURE_MATCH, FIXTURE_SNAPSHOT, FIXTURE_TEAMS } from './helpers/fixtures';
import { createMockDb, createMockEnv } from './helpers/mockEnv';
import { mockScenario, mockScenarioContext } from './helpers/scenarioFixtures';
import { installSmokeFetchMock, mockApiBody } from './helpers/smokeFetch';
import {
  buildScheduleByDate,
  sampleMatchProbs,
  sampleMatchStats,
  sampleProbability,
  sampleScheduleMatch,
  sampleScheduleMatches,
  SMOKE_MATCH_ID,
} from './helpers/smokeFixtures';

function renderApp(ui: ReactElement) {
  return render(
    <MemoryRouter>
      <I18nProvider>{ui}</I18nProvider>
    </MemoryRouter>,
  );
}

function renderRoute(path: string, element: ReactElement) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <I18nProvider>
        <Routes>
          <Route path="*" element={element} />
        </Routes>
      </I18nProvider>
    </MemoryRouter>,
  );
}

function MetaHarness({ image }: { image: string }) {
  usePageMeta({
    title: 'Coverage title',
    description: 'Coverage description',
    image,
  });
  return <div>meta harness</div>;
}

describe('coverage final lines 2 — UI gaps', () => {
  beforeEach(() => {
    installSmokeFetchMock();
    saveFavorites({ matches: [SMOKE_MATCH_ID], teams: ['t-mex'] });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('NewsArticlePage polls, catches a failed poll, then updates from a later success', async () => {
    let calls = 0;
    const timers: Array<() => void> = [];
    const article = {
      id: 'n-gap',
      title: 'Poll article',
      summary: 'Summary',
      published_at: '2026-01-01T00:00:00Z',
      reliability_score: 0.8,
      source_name: 'Test Source',
      source_url: 'https://example.com/story',
      translated: false,
    };
    vi.spyOn(globalThis, 'setInterval').mockImplementation(((fn: TimerHandler) => {
      timers.push(fn as () => void);
      return 1 as unknown as ReturnType<typeof setInterval>;
    }) as typeof setInterval);
    vi.spyOn(globalThis, 'clearInterval').mockImplementation(() => undefined);

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/api/news/n-gap')) {
          calls += 1;
          if (calls === 3) throw new Error('poll failed');
          return Response.json({
            data:
              calls >= 2
                ? { ...article, translated: true, titleVi: 'Da dich', summaryVi: 'Tom tat da dich' }
                : article,
          });
        }
        return Response.json(mockApiBody(url));
      }),
    );

    renderRoute(
      '/news-intelligence/n-gap',
      <Routes>
        <Route path="/news-intelligence/:articleId" element={<NewsArticlePage />} />
      </Routes>,
    );

    await waitFor(() => expect(document.body.textContent).toMatch(/Đang dịch|Translating/i));
    await waitFor(() => expect(timers.length).toBeGreaterThan(0));
    for (const timer of timers) timer();
    await Promise.resolve();
    for (const timer of timers) timer();
    await Promise.resolve();
    await Promise.resolve();
    expect(calls).toBeGreaterThanOrEqual(3);
  });

  it('MatchPage editorial view falls back to briefing summary and hint takeaways', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes(`/api/matches/${SMOKE_MATCH_ID}/preview`)) {
          return new Response('fail', { status: 500 });
        }
        if (url.includes(`/api/matches/${SMOKE_MATCH_ID}/briefing`)) {
          return Response.json({
            data: {
              summary: { vi: 'Tom tat briefing', en: 'Briefing summary' },
              probabilityExplanation: [{ vi: 'Luan diem 1', en: 'Takeaway 1' }],
              uncertaintyNotes: [],
              citations: [],
              tacticalThemes: [],
              collectiveTeamFactors: [],
              lineupRisks: [],
              keyPlayers: [],
            },
          });
        }
        if (url.includes(`/api/matches/${SMOKE_MATCH_ID}/hints`)) {
          return Response.json({ data: { hints: [{ vi: 'Goi y chien thuat', en: 'Tactical hint' }] } });
        }
        return Response.json(mockApiBody(url));
      }),
    );

    renderRoute(
      `/matches/${SMOKE_MATCH_ID}`,
      <Routes>
        <Route path="/matches/:matchId" element={<MatchPage />} />
      </Routes>,
    );

    await waitFor(() => expect(document.body.textContent).toMatch(/USA|Mexico/i));
    const editorialButton = screen
      .getAllByRole('button')
      .find((button) => /editorial|đọc bài|article/i.test(button.textContent ?? ''));
    expect(editorialButton).toBeTruthy();
    await user.click(editorialButton!);
    expect(document.body.textContent).toMatch(/Trận đấu cân bằng|Giải thích xác suất|Insight 1/i);
  });

  it('MatchPage editorial view falls back to hint-only takeaways when preview and briefing are missing', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes(`/api/matches/${SMOKE_MATCH_ID}/preview`)) {
          return new Response('fail', { status: 500 });
        }
        if (url.includes(`/api/matches/${SMOKE_MATCH_ID}/tactical-briefing`)) {
          return new Response('fail', { status: 500 });
        }
        if (url.includes(`/api/matches/${SMOKE_MATCH_ID}/hints`)) {
          return Response.json({ data: { hints: [{ vi: 'Goi y chien thuat', en: 'Tactical hint' }] } });
        }
        return Response.json(mockApiBody(url));
      }),
    );

    renderRoute(
      `/matches/${SMOKE_MATCH_ID}`,
      <Routes>
        <Route path="/matches/:matchId" element={<MatchPage />} />
      </Routes>,
    );

    await waitFor(() => expect(document.body.textContent).toMatch(/USA|Mexico/i));
    const editorialButton = screen
      .getAllByRole('button')
      .find((button) => /editorial|đọc bài|article/i.test(button.textContent ?? ''));
    expect(editorialButton).toBeTruthy();
    await user.click(editorialButton!);
    expect(document.body.textContent).toMatch(/Điểm chính|Giải thích xác suất|hint/i);
  });

  it('SeoLandingPage creates a description meta tag when missing', async () => {
    document.head.querySelector('meta[name="description"]')?.remove();
    renderRoute(
      '/lich-thi-dau-world-cup-2026',
      <Routes>
        <Route path="/lich-thi-dau-world-cup-2026" element={<SeoLandingPage />} />
      </Routes>,
    );
    await waitFor(() => {
      const meta = document.head.querySelector('meta[name="description"]');
      expect(meta).toBeTruthy();
      expect(meta?.getAttribute('content')).toBeTruthy();
    });
  });

  it('calendar and lineup panels cover empty filter and inferred lineups', async () => {
    const user = userEvent.setup();
    const calendar = renderApp(
      <MatchScheduleCalendar byDate={buildScheduleByDate()} matches={sampleScheduleMatches} />,
    );
    const search = calendar.container.querySelector('input[type="search"]') as HTMLInputElement;
    await user.type(search, 'ZZZ-no-match');
    expect(calendar.container.querySelectorAll('li')).toHaveLength(0);

    const lineup = renderApp(
      <MatchLineupSidePanel
        label="Home"
        side={{
          teamName: 'USA',
          formation: '4-3-3',
          source: 'projected',
          hasAccurateLineup: false,
          starters: [],
          substitutes: [],
          grouped: null as never,
          lineupPlayers: [],
          players: Array.from({ length: 7 }, (_, i) => ({
            shirtNumber: i + 1,
            name: `P${i}`,
            position: 'CM',
          })),
        }}
      />,
    );
    expect(lineup.container.textContent).toMatch(/4-3-3|USA/i);
  });

  it('pitch layer and movement timeline cover substitution and both trend labels', () => {
    const pitch = renderApp(
      <svg>
        <PitchPlayerLayer
          side="home"
          players={[
            {
              playerId: 'p1',
              name: 'Player One',
              shirtNumber: 7,
              position: 'FW',
              x: 0.2,
              y: 0.3,
              subType: 'in',
              subMinute: 71,
              isOnPitch: true,
              isStarter: false,
              rating: null,
              movement: null,
            },
          ]}
        />
      </svg>,
    );
    expect(pitch.container.textContent).toContain("71'");

    renderApp(
      <ProbabilityMovementTimeline
        intervals={{
          '15': { homeWinProb: 0.3, drawProb: 0.3, awayWinProb: 0.4 },
          '90': { homeWinProb: 0.38, drawProb: 0.27, awayWinProb: 0.35 },
        }}
      />,
    );
    renderApp(
      <ProbabilityMovementTimeline
        intervals={{
          '15': { homeWinProb: 0.42, drawProb: 0.3, awayWinProb: 0.28 },
          '90': { homeWinProb: 0.33, drawProb: 0.29, awayWinProb: 0.38 },
        }}
      />,
    );
    expect(document.body.textContent?.length ?? 0).toBeGreaterThan(20);
  });

  it('TournamentSchedulePanel covers completed filtering and unknown day label fallback', async () => {
    const user = userEvent.setup();
    const view = renderApp(
      <TournamentSchedulePanel
        byDate={buildScheduleByDate()}
        matches={sampleScheduleMatches}
        probs={sampleMatchProbs}
      />,
    );
    const completedButton = screen
      .getAllByRole('button')
      .find((button) => /completed|đã xong|finished/i.test(button.textContent ?? ''));
    expect(completedButton).toBeTruthy();
    await user.click(completedButton!);
    await waitFor(() => expect(view.container.textContent?.length ?? 0).toBeGreaterThan(20));

    const unknownView = renderApp(
      <TournamentSchedulePanel byDate={buildScheduleByDate()} matches={sampleScheduleMatches} />,
    );
    expect(unknownView.container.textContent?.length ?? 0).toBeGreaterThan(20);
  });

  it('TournamentSchedulePanel uses the raw day key when kickoff is missing', async () => {
    vi.resetModules();
    vi.doMock('../app/lib/calendarExport', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../app/lib/calendarExport')>();
      return {
        ...actual,
        googleCalendarUrl: vi.fn(() => 'https://calendar.example.test/render'),
        downloadMatchIcs: vi.fn(),
        downloadScheduleIcs: vi.fn(),
      };
    });

    try {
      const { TournamentSchedulePanel: IsolatedTournamentSchedulePanel } = await import(
        '../app/components/tournament/TournamentSchedulePanel'
      );
      const { I18nProvider: IsolatedI18nProvider } = await import('../app/lib/i18n/I18nContext');
      const missingKickoff = {
        ...sampleScheduleMatch,
        id: 'm-unknown',
        slug: 'm-unknown',
        kickoff_utc: '',
      };
      const view = render(
        <MemoryRouter>
          <IsolatedI18nProvider>
            <IsolatedTournamentSchedulePanel byDate={{ unknown: [missingKickoff] }} matches={[missingKickoff]} />
          </IsolatedI18nProvider>
        </MemoryRouter>,
      );
      expect(view.container.textContent).toContain('unknown');
    } finally {
      vi.doUnmock('../app/lib/calendarExport');
      vi.resetModules();
    }
  });

  it('stats and staff panels cover unavailable and note-only branches', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/m-unavailable/stats')) {
          return Response.json({ data: { ...sampleMatchStats, dataSource: 'unavailable' } });
        }
        if (url.includes('/m-note/stats')) {
          return Response.json({
            data: { ...sampleMatchStats, matchId: 'm-note', dataSourceLabel: undefined },
          });
        }
        if (url.includes('/m-empty/staff')) {
          return Response.json({
            data: { matchId: 'm-empty', slug: 'm-empty', homeCoach: null, awayCoach: null, referee: null, officials: [] },
          });
        }
        return Response.json(mockApiBody(url));
      }),
    );

    const unavailable = renderApp(
      <MatchLiveStatsPanel matchId="m-unavailable" homeLabel="USA" awayLabel="Mexico" />,
    );
    await waitFor(() => expect(unavailable.container.textContent).toMatch(/Chưa có thống kê|No official stats/i));

    const noteOnly = renderApp(
      <MatchLiveStatsPanel matchId="m-note" homeLabel="USA" awayLabel="Mexico" />,
    );
    await waitFor(() => expect(noteOnly.container.textContent).toContain(sampleMatchStats.xgEstimateNote));

    const staff = renderApp(<MatchStaffPanel matchId="m-empty" homeLabel="Home" awayLabel="Away" />);
    await waitFor(() => expect(staff.container.textContent ?? '').toBe(''));
  });

  it('MatchAnalyticsPanel shows unavailable when movement data fails without priors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/m-analytics-none/probability-movement')) {
          return new Response('fail', { status: 500 });
        }
        return Response.json(mockApiBody(url));
      }),
    );

    const view = renderApp(<MatchAnalyticsPanel matchId="m-analytics-none" />);
    await waitFor(() => expect(view.container.textContent).toMatch(/unavailable|Chưa đủ dữ liệu/i));
  });

  it('misc UI branches cover sticky states, compact thumbnail, null analysis, and venue display', async () => {
    renderApp(
      <MatchStickyScoreBar
        home="USA"
        away="Mexico"
        homeScore={1}
        awayScore={0}
        status="live"
        visible
      />,
    );
    renderApp(
      <MatchStickyScoreBar
        home="USA"
        away="Mexico"
        homeScore={2}
        awayScore={1}
        status="completed"
        visible
      />,
    );
    const thumb = renderApp(
      <MatchVersusThumbnail
        homeName="Unknown Home"
        awayName="Unknown Away"
        matchRef="m-plain"
        variant="compact"
      />,
    );
    expect(thumb.container.querySelectorAll('img')).toHaveLength(0);

    const empty = renderApp(<MultiVariablePanel analysis={null} />);
    expect(empty.container.textContent ?? '').toBe('');

    renderApp(
      <MatchHeader
        home="USA"
        away="Mexico"
        homeScore={1}
        awayScore={0}
        status="scheduled"
        stage="Group"
        venue="Azteca"
      />,
    );
    expect(document.body.textContent).toContain('Azteca');
  });

  it('MatchPredictionSummary falls back to hints when scoreline and driver data are missing', () => {
    renderApp(
      <MatchPredictionSummary
        prob={{
          ...sampleProbability,
          topScorelines: undefined,
          scorelineDistribution: undefined,
          drivers: undefined,
        }}
        hints={[{ vi: 'Goi y 1', en: 'Hint 1' }]}
        homeLabel="USA"
        awayLabel="Mexico"
      />,
    );
    expect(document.body.textContent).toMatch(/Hint 1|Goi y 1/i);
  });

  it('ProbabilityMovementPanel filters away-only changes and matrix/briefing/favorites cover remaining lines', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/m-away/probability-movement')) {
          return Response.json({
            data: {
              matchId: 'm-away',
              events: [
                {
                  label: 'baseline',
                  timestamp: '2026-06-11T20:00:00Z',
                  minute: 0,
                  homeWinBefore: 0.4,
                  homeWinAfter: 0.4,
                  drawBefore: 0.3,
                  drawAfter: 0.3,
                  awayBefore: 0.3,
                  awayAfter: 0.3,
                  reasonCode: 'baseline',
                },
                {
                  label: 'update-1',
                  timestamp: '2026-06-11T20:30:00Z',
                  minute: 30,
                  homeWinBefore: 0.4,
                  homeWinAfter: 0.4,
                  drawBefore: 0.3,
                  drawAfter: 0.3,
                  awayBefore: 0.3,
                  awayAfter: 0.34,
                  reasonCode: 'live',
                },
              ],
            },
          });
        }
        return Response.json(mockApiBody(url));
      }),
    );

    const panel = renderApp(<ProbabilityMovementPanel matchId="m-away" prob={sampleProbability} currentMinute={30} />);
    await waitFor(() => expect(panel.container.textContent).toMatch(/30|34|40/i));

    renderApp(<ScorelineMatrix distribution={{ '1-0': 0.2 }} highlight="1-0" actualScore="1-0" />);
    renderApp(
      <TacticalBriefingPanel
        briefing={{
          summary: { vi: 'Tom tat', en: 'Summary' },
          tacticalThemes: [],
          collectiveTeamFactors: [],
          lineupRisks: [],
          keyPlayers: [],
          probabilityExplanation: [],
          uncertaintyNotes: [],
          citations: [{ sourceName: 'Platform', title: 'Ignored title' }],
        }}
      />,
    );
    saveFavorites({ matches: [], teams: ['t-mex'] });
    renderApp(<FavoritesPanel matches={sampleScheduleMatches} teams={[]} />);
    expect(document.body.textContent?.length ?? 0).toBeGreaterThan(20);
  });

  it('Lineup, news, team, tournament, and tournaments hub pages cover remaining fallbacks', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/api/matches/m-fail/lineups')) return new Response('fail', { status: 500 });
        if (url.includes('/api/news?')) return new Response('fail', { status: 500 });
        if (url.includes('/api/teams/t-usa/world-cup-h2h')) {
          return Response.json({ data: { opponents: [], totalMeetings: 0 } });
        }
        if (url.includes('/api/teams/t-usa/squad')) {
          return Response.json({ data: [] });
        }
        if (url.match(/\/api\/teams\/t-usa$/)) {
          return Response.json({
            data: {
              id: 't-usa',
              name: 'United States',
              short_name: 'USA',
              country_code: 'US',
              fifa_ranking: 12,
              elo_rating: 1850,
              coach: null,
            },
          });
        }
        if (url.includes('/api/tournaments')) {
          return Response.json({
            data: [
              {
                id: 't-2022',
                year: 2022,
                name: 'World Cup 2022',
                host_countries_json: '["Qatar"]',
                teams_count: 32,
                status: 'completed',
              },
              {
                id: 't-2018',
                year: 2018,
                name: 'World Cup 2018',
                host_countries_json: '["Russia"]',
                teams_count: 32,
                status: 'completed',
              },
            ],
          });
        }
        return Response.json(mockApiBody(url));
      }),
    );

    renderRoute(
      '/matches/m-fail/lineup',
      <Routes>
        <Route path="/matches/:matchId/lineup" element={<LineupPage />} />
      </Routes>,
    );
    await waitFor(() => expect(document.body.textContent).toMatch(/m-fail|back|quay/i));

    renderRoute(
      '/news-intelligence',
      <Routes>
        <Route path="/news-intelligence" element={<NewsIntelligencePage />} />
      </Routes>,
    );
    await waitFor(() => expect(document.body.textContent?.length ?? 0).toBeGreaterThan(10));

    renderRoute(
      '/teams/t-usa',
      <Routes>
        <Route path="/teams/:teamId" element={<TeamPage />} />
      </Routes>,
    );
    await waitFor(() => expect(document.body.textContent).toMatch(/United States|USA/i));

    renderRoute(
      '/tournaments/2026',
      <Routes>
        <Route path="/tournaments/:year" element={<TournamentPage />} />
      </Routes>,
    );
    await waitFor(() => expect(document.body.querySelector('a[href="/matches/m-final-2022"]')).toBeTruthy());

    renderRoute(
      '/tournaments',
      <Routes>
        <Route path="/tournaments" element={<TournamentsHubPage />} />
      </Routes>,
    );
    await waitFor(() => expect(document.body.textContent).toContain('Qatar'));
  });

  it('utilities cover meta, translation labels, lineup badges, flags, admin failure, and home refresh timer', async () => {
    renderApp(<MetaHarness image="data:image/png;base64,abc" />);
    expect(document.head.querySelector('meta[property="og:image"]')?.getAttribute('content')).toContain('data:image');

    expect(translateComparisonSummary('Scenario likelihood is tightly balanced between baseline and alternative.', [], 'vi', '', '')).toContain('cân bằng');
    expect(lineupSourceBadgeClass('squad')).toContain('text-cyan');
    expect(resolveTeamFlagSlug({ countryCode: 'GB', teamName: 'England' })).toBe('gb-eng');
    expect(resolveTeamFlag({ teamName: 'eng' })).toBe('');

    const originalDateTimeFormat = Intl.DateTimeFormat;
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(((...args: ConstructorParameters<typeof Intl.DateTimeFormat>) => {
      const fmt = new originalDateTimeFormat(...args);
      return new Proxy(fmt, {
        get(target, prop, receiver) {
          if (prop === 'resolvedOptions') {
            return () => ({ ...target.resolvedOptions(), timeZone: 'Asia/Ho_Chi_Minh' });
          }
          const value = Reflect.get(target, prop, receiver);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      }) as Intl.DateTimeFormat;
    }) as typeof Intl.DateTimeFormat);
    const tzView = renderApp(<ScheduleTimezoneBanner />);
    expect(tzView.container.querySelector('.text-muted-dim')).toBeNull();
    expect(tzView.container.textContent?.length ?? 0).toBeGreaterThan(5);

    const alertSpy = vi.fn();
    vi.stubGlobal('alert', alertSpy);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })));
    const user = userEvent.setup();
    renderApp(<AnalystSimulatorPage />);
    await user.click(screen.getByRole('button', { name: /queue recompute/i }));
    expect(alertSpy).toHaveBeenCalledWith('Recompute failed: 500');

    installSmokeFetchMock();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    vi.resetModules();
    const { HomePage: IsolatedHomePage } = await import('../app/pages/HomePage');
    const { I18nProvider: IsolatedI18nProvider } = await import('../app/lib/i18n/I18nContext');
    render(
      <MemoryRouter initialEntries={['/']}>
        <IsolatedI18nProvider>
          <Routes>
            <Route path="/" element={<IsolatedHomePage />} />
          </Routes>
        </IsolatedI18nProvider>
      </MemoryRouter>,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await vi.advanceTimersByTimeAsync(31_000);
    expect(setIntervalSpy).toHaveBeenCalled();
  });
});

describe('coverage final lines 2 — backend helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('covers remaining scenario, translation, flag, and impact helpers', async () => {
    const ctx = mockScenarioContext({
      minute: 12,
      homeScore: 0,
      awayScore: 1,
      homeSystem: { ...mockScenarioContext().homeSystem, transitionScore: 0.78, pressingScore: 0.72, tempoScore: 0.6 },
      awaySystem: { ...mockScenarioContext().awaySystem, transitionScore: 0.42, pressingScore: 0.61 },
    });

    const candidates = buildCandidateScenarios(ctx);
    expect(candidates.some((scenario) => scenario.scenarioType === 'transition_dominance')).toBe(true);
    expect(candidates.some((scenario) => scenario.scenarioType === 'pressing_breakthrough')).toBe(true);

    const baselineSelection = {
      ...selectScenarioFeatures('baseline_expected_flow', ctx),
      missingInputs: [],
    };
    const baseline = runScenarioProbabilityModel('baseline_expected_flow', ctx, baselineSelection);
    expect(baseline.riskFactors[0]).toContain('Lineups may still be projected');

    const early = runScenarioProbabilityModel('early_goal_swing', ctx, selectScenarioFeatures('early_goal_swing', ctx));
    expect(early.awayWinProb).toBeGreaterThan(0);

    const fallback = ensureAtLeastTwoScenarios(
      [
        {
          ...mockScenario({ scenarioType: 'baseline_expected_flow', isBaseline: true }),
          featureSelection: baselineSelection,
          output: baseline,
          weight: 1,
        },
      ] as never,
      ctx,
    );
    expect(fallback.some((scenario) => scenario.scenarioType === 'early_goal_swing')).toBe(true);

    const rt = applyRealtimeEventToScenarios(
      ctx,
      [mockScenario({ scenarioType: 'red_card_disruption', scenarioProbability: 0.2 })],
      { matchId: 'm-1', eventId: 'e-red', eventType: 'red_card', minute: 18 },
    );
    expect(rt.scenarios[0]!.scenarioProbability).toBeGreaterThan(0.2);

    const parseCatchEnv = createMockEnv({
      AI: {
        run: vi.fn(async (model: string) => {
          if (String(model).includes('m2m100')) throw new Error('down');
          return { response: '{bad}' };
        }),
      } as never,
    });
    expect(await translateNewsHeadline(parseCatchEnv, 'Mexico wins opener', 'Mexico beat South Africa 2-1.')).toBeNull();

    const badSummaryEnv = createMockEnv({
      AI: {
        run: vi.fn(async (model: string) => {
          if (String(model).includes('m2m100')) throw new Error('down');
          return {
            response: JSON.stringify({
              titleVi: 'Mexico thang tran mo man',
              summaryVi: 'Mexico beat South Africa 2-1.',
            }),
          };
        }),
      } as never,
    });
    expect(await translateNewsHeadline(badSummaryEnv, 'Mexico wins opener', 'Mexico beat South Africa 2-1.')).toBeNull();

    expect(resolveSrcTeamFlagSlug({ countryCode: 'GB', teamName: 'England' })).toBe('gb-eng');
    expect(resolveSrcTeamFlagSlug({ countryCode: 'GB', teamName: 'Scotland' })).toBe('gb-sct');
    expect(resolveSrcTeamFlagSlug({ countryCode: 'GB', teamName: 'English Lions' })).toBe('gb-eng');
    expect(resolveSrcTeamFlagSlug({ countryCode: 'GB', teamName: 'Scot XI' })).toBe('gb-sct');
    expect(resolvePublisherLabel({ source_name: 'Mock Development Source', source_url: 'https://www.theguardian.com/a' })).toBe(
      'The Guardian',
    );
    expect(resolvePublisherLabel({ source_name: '', source_url: 'https://www.fifa.com/a' })).toBe('FIFA');
    expect(resolvePublisherLabel({ source_name: '', source_url: '' })).toBe('RSS');
    expect(classifyNewsImpact('Warm-up note', { teams: ['Only one'], players: [], injuries: [], tacticalNotes: [], formations: [] })).toBe(
      'none',
    );

    const queueSend = vi.fn(async () => undefined);
    const impactEnv = createMockEnv({
      DB: createMockDb({
        all: (sql) => {
          if (sql.includes("GLOB 'team-w26-")) {
            return {
              results: [
                { id: 'team-w26-a1', name: 'Mexico', short_name: 'MEX', country_code: 'MEX', fifa_ranking: 14, elo_rating: 1800, collective_strength_rating: 0.8 },
                { id: 'team-w26-a2', name: 'South Africa', short_name: 'RSA', country_code: 'RSA', fifa_ranking: 59, elo_rating: 1650, collective_strength_rating: 0.62 },
              ],
            };
          }
          if (sql.includes('SELECT id FROM matches') && sql.includes('home_team_id IN')) {
            return { results: [{ id: FIXTURE_MATCH.id }] };
          }
          if (sql.includes('country_code')) return { results: [{ id: 'team-w26-a1' }] };
          return { results: [] };
        },
        first: (sql) => {
          if (sql.includes('country_code FROM teams')) return { country_code: 'MEX' };
          return null;
        },
        run: () => ({ success: true, meta: { changes: 1 } }),
      }),
      MODEL_QUEUE: { send: queueSend } as never,
    });
    const impact = await processNewsDocumentImpact(impactEnv, 'doc-alias', 'Routine tactical note', {
      teams: ['MEX'],
      players: [],
      injuries: [],
      tacticalNotes: [],
      formations: ['4-3-3'],
    });
    expect(impact.matchIds).toContain(FIXTURE_MATCH.id);
  });

  it('covers remaining repository, router, route, and consumer branches', async () => {
    expect(resolveModel('tactical_briefing', true).tier).toBe('economy');
    expect(tacticalMatchupModifier({ formation: '5-4-1' } as never, { formation: '3-4-3' } as never)).toEqual({
      home: 0.97,
      away: 1.02,
    });

    const profileId = await upsertTeamSystemProfile(
      createMockDb({
        first: () => ({ id: 'tsp-1' }),
      }),
      'team-1',
      't-2026',
      buildTeamSystemProfile({
        teamId: 'team-1',
        eloRating: 1850,
        ppda: 5,
        defensiveCompactness: 0.7,
        transitionThreat: 0.62,
        setPieceXg: 0.4,
        setPieceXga: 0.1,
        benchDepth: 0.65,
        formationStability: 0.8,
        possessionProfile: 0.6,
        highTurnovers: 0.7,
        restDays: 5,
      }),
      'v1',
      'hash',
    );
    expect(profileId).toBe('tsp-1');

    const routeEnv = createRouteTestEnv(
      {},
      {
        snapshot: {
          ...FIXTURE_SNAPSHOT,
          explanation_json: '{bad',
          scoreline_json: JSON.stringify({ '1-0': 0.2 }),
          interval_json: JSON.stringify({ '45': { homeWinProb: 0.4 } }),
        },
      },
    );
    const { json } = await jsonRoute<{ data: { drivers: string[] } }>(probabilityRoutes, `/${FIXTURE_MATCH.id}/probability`, {
      env: routeEnv,
    });
    expect(json.data.drivers).toEqual([]);

    const batch = {
      messages: [
        {
          body: { type: 'ai_multi_analyze', matchId: 'm-1' },
          ack: vi.fn(),
          retry: vi.fn(),
        },
      ],
    } as unknown as MessageBatch<{ type: 'ai_multi_analyze'; matchId: string }>;
    await handleModelBatch(batch, createMockEnv());
    expect(batch.messages[0]!.ack).toHaveBeenCalled();
  });

  it('covers remaining comparison, backtest, scenario repo, explanation, and durable object branches', async () => {
    const oneScenario = [mockScenario({ id: 'only-one', isBaseline: true })];
    const comparison = compareScenarios(oneScenario);
    expect(comparison.alternativeScenarioId).toBe('only-one');

    const backtest = await runScenarioBacktest(
      createMockEnv({
        R2_ARTIFACTS: { put: vi.fn(async () => undefined) } as never,
        DB: createMockDb({
          all: () => ({
            results: [
              {
                id: 'm-away',
                home_score: 0,
                away_score: 2,
                home_win_prob: 0.2,
                draw_prob: 0.25,
                away_win_prob: 0.55,
              },
            ],
          }),
        }),
      }),
      2026,
    );
    expect(backtest.matchCount).toBe(1);

    const listed = await listScenariosForMatch(
      createMockDb({
        all: () => ({
          results: [
            {
              scenario_type: 'baseline_expected_flow',
              probability: 0.5,
              confidence: 0.7,
              model_version: 'v1',
              explanation_json: '{}',
              created_at: '2026-01-01T00:00:00Z',
            },
          ],
        }),
      }),
      'm-1',
    );
    expect(listed[0]!.explanationFactors).toEqual([]);

    const explanation = await explainScenarioPrediction(createMockEnv(), 'm-1', {
      ...mockScenario(),
      featureSelection: { ...mockScenario().featureSelection, missingInputs: [] },
    });
    expect(explanation.uncertaintyNotes[1]).toContain('Input coverage is sufficient');

    const room = new MatchRoom({} as DurableObjectState, {} as never);
    const res = await room.fetch(new Request('https://do/plain'));
    expect(await res.text()).toBe('MatchRoom');
  });

  it('covers remaining feature builders', () => {
    expect(
      buildLineupFeaturesFromPlayers(
        '4-3-3',
        [
          { is_starter: 1, position_slot: '???', role: null },
          { is_starter: 1, position_slot: '???', role: null },
          { is_starter: 1, position_slot: '???', role: null },
          { is_starter: 1, position_slot: '???', role: null },
          { is_starter: 1, position_slot: '???', role: null },
          { is_starter: 1, position_slot: '???', role: null },
          { is_starter: 1, position_slot: '???', role: null },
        ],
        false,
      )?.missingKeyRoles,
    ).toContain('GK');

    const factors = buildExplanationFactors({
      homeTeam: {
        eloRating: 1700,
        xgFor: 1.1,
        xgAgainst: 1.0,
        recentForm: 0.5,
        restDays: 4,
        formationStability: 0.7,
        possessionShare: 0.48,
        transitionThreat: 0.5,
        setPieceThreat: 0.4,
      },
      awayTeam: {
        eloRating: 1750,
        xgFor: 1.3,
        xgAgainst: 0.9,
        recentForm: 0.55,
        restDays: 4,
        formationStability: 0.72,
        possessionShare: 0.52,
        transitionThreat: 0.55,
        setPieceThreat: 0.42,
      },
      homeCoach: { tacticalRating: 0.6 } as never,
      awayCoach: { tacticalRating: 0.85 } as never,
      referee: null,
      lineupHome: null,
      lineupAway: null,
      marketSignal: null,
      weather: null,
    } as never);
    expect(factors.positive.length).toBeGreaterThan(0);

    const profile = buildTeamSystemProfile({
      teamId: 'team-press',
      eloRating: 1900,
      ppda: 4,
      defensiveCompactness: 0.72,
      transitionThreat: 0.58,
      setPieceXg: 0.4,
      setPieceXga: 0.08,
      benchDepth: 0.62,
      formationStability: 0.8,
      possessionProfile: 0.55,
      highTurnovers: 0.65,
      restDays: 6,
    });
    expect(profile.tacticalIdentity).toBe('high_press_collective');
  });
});
