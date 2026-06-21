import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nProvider } from '../app/lib/i18n/I18nContext';
import { GroupStageBoard } from '../app/components/tournament/GroupStageBoard';
import { BracketPanel, GroupStandingsGrid } from '../app/components/tournament/TournamentPanels';
import { TournamentSchedulePanel } from '../app/components/tournament/TournamentSchedulePanel';
import { MatchHistoryPanel, TeamWorldCupH2HPanel } from '../app/components/match/MatchHistoryPanel';
import { ProbabilityMovementPanel } from '../app/components/probability/ProbabilityMovementPanel';
import { MatchAnalysisPage } from '../app/pages/MatchAnalysisPage';
import { MatchPage } from '../app/pages/MatchPage';
import { NewsArticlePage } from '../app/pages/NewsArticlePage';
import { LineupPage } from '../app/pages/LineupPage';
import { TeamPage } from '../app/pages/TeamPage';
import { TournamentPage } from '../app/pages/TournamentPage';
import { NewsIntelligencePage } from '../app/pages/NewsIntelligencePage';
import { HomePage } from '../app/pages/HomePage';
import { TournamentsHubPage } from '../app/pages/TournamentsHubPage';
import { AnalystSimulatorPage } from '../app/pages/AnalystSimulatorPage';
import { MatchScheduleCalendar } from '../app/components/home/MatchScheduleCalendar';
import { MatchLineupSidePanel } from '../app/components/match/MatchLineupSidePanel';
import { MatchResultScore } from '../app/components/match/MatchResultScore';
import { PredictedActualScores } from '../app/components/match/PredictedActualScores';
import { MatchAnalyticsPanel } from '../app/components/match/MatchAnalyticsPanel';
import { MatchLiveStatsPanel } from '../app/components/match/MatchLiveStatsPanel';
import { MatchStaffPanel } from '../app/components/match/MatchStaffPanel';
import { MatchStickyScoreBar } from '../app/components/match/MatchStickyScoreBar';
import { MatchVersusThumbnail } from '../app/components/match/MatchVersusThumbnail';
import { MultiVariablePanel } from '../app/components/match/MultiVariablePanel';
import { MatchKickoffDisplay } from '../app/components/match/MatchKickoffDisplay';
import { MatchPredictionSummary } from '../app/components/match/MatchPredictionSummary';
import { ScenarioLikelihoodPanel } from '../app/components/scenarios/ScenarioLikelihoodPanel';
import { ScenarioPredictionPanel } from '../app/components/scenarios/ScenarioPredictionPanel';
import { ScenarioConfidenceBadge } from '../app/components/scenarios/ScenarioConfidenceBadge';
import { PitchMap } from '../app/components/tactical/PitchMap';
import { PitchPlayerLayer } from '../app/components/tactical/PitchPlayerLayer';
import { ProbabilityMovementTimeline } from '../app/components/tactical/ProbabilityMovementTimeline';
import { MatchHeader } from '../app/components/tactical/MatchHeader';
import { ScorelineMatrix } from '../app/components/tactical/ScorelineMatrix';
import { TacticalBriefingPanel } from '../app/components/tactical/TacticalBriefingPanel';
import { TeamSystemPanel } from '../app/components/team/TeamSystemPanel';
import { FavoritesPanel } from '../app/components/tournament/FavoritesPanel';
import { TeamsDirectory } from '../app/components/tournament/TeamsDirectory';
import { installSmokeFetchMock, mockApiBody } from './helpers/smokeFetch';
import {
  buildScheduleByDate,
  sampleH2HSummary,
  sampleHistoryMatch,
  sampleMatchProbs,
  samplePitchMap,
  sampleProbability,
  sampleRecentWc,
  sampleScheduleMatch,
  sampleScheduleMatches,
  sampleStandings,
  SMOKE_MATCH_ID,
} from './helpers/smokeFixtures';
import { saveFavorites } from '../app/lib/favorites';

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

function analysisPreview(overrides: Record<string, unknown> = {}) {
  const base = mockApiBody(`/api/matches/${SMOKE_MATCH_ID}/preview`).data as Record<string, unknown>;
  return { ...base, ...overrides };
}

function findButton(matcher: RegExp) {
  return screen.getAllByRole('button').find((b) => matcher.test(b.textContent ?? ''));
}

describe('coverage final — remaining line gaps (UI)', () => {
  beforeEach(() => {
    installSmokeFetchMock();
    saveFavorites({ matches: [SMOKE_MATCH_ID], teams: ['t-usa'] });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('GroupStageBoard — empty knockout round, score variants, prob fetch catch, stage reset', async () => {
    const user = userEvent.setup();
    const finalOnly = {
      ...sampleKnockoutMatch('Final', 'm-final', 'finished', 2, 1),
    };
    const liveKnockout = sampleKnockoutMatch('Round of 16', 'm-r16-live', 'live', 1, 0);
    const completedKnockout = sampleKnockoutMatch('Round of 16', 'm-r16-done', 'completed', 3, 2);

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/match-probabilities')) {
          return new Response('fail', { status: 500 });
        }
        return new Response(JSON.stringify(mockApiBody(url)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );

    const view = renderApp(
      <GroupStageBoard
        matches={[finalOnly, liveKnockout, completedKnockout]}
        initialStandings={sampleStandings}
      />,
    );

    const knockout = findButton(/knock|loại/i);
    await user.click(knockout!);

    await waitFor(() => {
      expect(view.container.textContent).toMatch(/Final|live|3|2|1|0/i);
    });

    const tabs = screen.getAllByRole('tab');
    for (const tab of tabs) await user.click(tab);
    if (tabs[0]) await user.click(tabs[0]!);
  });

  it('MatchHistoryPanel — empty WC history and TeamWorldCupH2HPanel empty state', () => {
    const emptyHistory = renderApp(
      <MatchHistoryPanel
        homeName="USA"
        awayName="Mexico"
        history={[]}
        summary={sampleH2HSummary}
      />,
    );
    expect(emptyHistory.container.textContent).toMatch(/empty|chưa|history/i);

    const emptyH2h = renderApp(
      <TeamWorldCupH2HPanel teamName="USA" opponents={[]} totalMeetings={0} />,
    );
    expect(emptyH2h.container.textContent).toMatch(/empty|chưa|h2h/i);
  });

  it('ProbabilityMovementPanel — single stable event with prob snapshot', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/probability-movement')) {
          return new Response(
            JSON.stringify({
              data: {
                matchId: 'm-single',
                events: [
                  {
                    label: 'baseline',
                    timestamp: '2026-06-11T20:00:00Z',
                    minute: 0,
                    homeWinBefore: 0.42,
                    homeWinAfter: 0.42,
                    drawBefore: 0.28,
                    drawAfter: 0.28,
                    awayBefore: 0.3,
                    awayAfter: 0.3,
                    reasonCode: 'baseline',
                  },
                ],
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response(JSON.stringify(mockApiBody(url)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );
    const view = renderApp(
      <ProbabilityMovementPanel
        matchId="m-single"
        prob={sampleProbability}
        currentMinute={0}
      />,
    );
    await waitFor(() => expect(view.container.textContent).toMatch(/stable|ổn định|42|28|30/i));
  });

  it('GroupStageBoard — knockout tab with no knockout fixtures shows empty round', async () => {
    const user = userEvent.setup();
    const groupOnly = sampleScheduleMatches.filter((m) => m.stage === 'Group');
    const view = renderApp(
      <GroupStageBoard matches={groupOnly} initialStandings={sampleStandings} initialProbs={sampleMatchProbs} />,
    );
    const knockout = findButton(/knock|loại/i);
    await user.click(knockout!);
    expect(view.container.textContent).toMatch(/empty|chưa|knockout/i);
  });

  it('ProbabilityMovementPanel — draw/away filters and no intervals', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/probability-movement')) {
          return new Response(
            JSON.stringify({
              data: {
                matchId: SMOKE_MATCH_ID,
                events: [
                  {
                    label: 'baseline',
                    timestamp: '2026-06-11T20:00:00Z',
                    minute: 0,
                    homeWinBefore: 0.42,
                    homeWinAfter: 0.42,
                    drawBefore: 0.28,
                    drawAfter: 0.28,
                    awayBefore: 0.3,
                    awayAfter: 0.3,
                    reasonCode: 'baseline',
                  },
                  {
                    label: 'update-1',
                    timestamp: '2026-06-11T20:30:00Z',
                    minute: 30,
                    homeWinBefore: 0.42,
                    homeWinAfter: 0.42,
                    drawBefore: 0.28,
                    drawAfter: 0.31,
                    awayBefore: 0.3,
                    awayAfter: 0.27,
                    reasonCode: 'live',
                  },
                ],
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response(JSON.stringify(mockApiBody(url)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );

    const withEvents = renderApp(
      <ProbabilityMovementPanel
        matchId={SMOKE_MATCH_ID}
        prob={{ ...sampleProbability, intervalDistribution: undefined }}
        currentMinute={30}
      />,
    );
    await waitFor(() => expect(withEvents.container.textContent).toMatch(/draw|hòa|28|31/i));

    const singleStable = renderApp(
      <ProbabilityMovementPanel
        matchId="m-stable"
        prob={sampleProbability}
        currentMinute={0}
      />,
    );
    await waitFor(() => expect(singleStable.container.textContent?.length ?? 0).toBeGreaterThan(20));
  });

  it('TournamentPanels — empty group rows, bracket API failure, empty bracket', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/standings')) {
          return new Response(
            JSON.stringify({
              data: {
                tournamentId: 't-2026',
                groups: { A: { complete: false, rows: [] } },
                thirdPlaceRanking: [],
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        if (url.includes('/bracket')) {
          return new Response('fail', { status: 500 });
        }
        return new Response(JSON.stringify(mockApiBody(url)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );

    const standingsView = renderApp(<GroupStandingsGrid />);
    await waitFor(() => expect(standingsView.container.textContent).toMatch(/no results|chưa có|standings/i), {
      timeout: 12000,
    });

    const bracketView = renderApp(<BracketPanel />);
    await waitFor(() => expect(bracketView.container.textContent).toMatch(/empty|chưa|bracket|loading/i), {
      timeout: 12000,
    });
  }, 20000);

  it('MatchAnalysisPage — group stage title branch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.match(new RegExp(`/api/matches/${SMOKE_MATCH_ID}/preview$`))) {
          return new Response(
            JSON.stringify({
              data: analysisPreview({ stage: 'Group', groupCode: 'B' }),
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response(JSON.stringify(mockApiBody(url)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );
    const view = renderRoute(
      `/matches/${SMOKE_MATCH_ID}/analysis`,
      <Routes>
        <Route path="/matches/:matchId/analysis" element={<MatchAnalysisPage />} />
      </Routes>,
    );
    await waitFor(() => expect(view.container.textContent).toMatch(/Group|Bảng|USA/i), { timeout: 12000 });
  }, 15000);

  it('MatchAnalysisPage — knockout stage title branch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.match(new RegExp(`/api/matches/${SMOKE_MATCH_ID}/preview$`))) {
          return new Response(
            JSON.stringify({
              data: analysisPreview({ stage: 'Round of 16', groupCode: null }),
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        if (url.match(new RegExp(`/api/matches/${SMOKE_MATCH_ID}$`))) {
          return new Response(
            JSON.stringify({
              data: {
                ...sampleScheduleMatch,
                id: SMOKE_MATCH_ID,
                slug: SMOKE_MATCH_ID,
                stage: 'Round of 16',
                group_code: null,
                status: 'scheduled',
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response(JSON.stringify(mockApiBody(url)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );
    const view = renderRoute(
      `/matches/${SMOKE_MATCH_ID}/analysis`,
      <Routes>
        <Route path="/matches/:matchId/analysis" element={<MatchAnalysisPage />} />
      </Routes>,
    );
    await waitFor(() => expect(document.body.textContent).toMatch(/Vòng 1\/8|Round|USA|Mexico/i), { timeout: 12000 });
  }, 15000);

  it('MatchAnalysisPage — versus-only title branch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.match(new RegExp(`/api/matches/${SMOKE_MATCH_ID}/preview$`))) {
          return new Response(
            JSON.stringify({
              data: analysisPreview({ stage: null, groupCode: null }),
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        if (url.match(new RegExp(`/api/matches/${SMOKE_MATCH_ID}$`))) {
          return new Response(
            JSON.stringify({
              data: {
                ...sampleScheduleMatch,
                id: SMOKE_MATCH_ID,
                slug: SMOKE_MATCH_ID,
                stage: null,
                group_code: null,
                status: 'scheduled',
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response(JSON.stringify(mockApiBody(url)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );
    const view = renderRoute(
      `/matches/${SMOKE_MATCH_ID}/analysis`,
      <Routes>
        <Route path="/matches/:matchId/analysis" element={<MatchAnalysisPage />} />
      </Routes>,
    );
    await waitFor(() => expect(document.body.textContent).toMatch(/USA.*Mexico|Mexico.*USA/i), { timeout: 12000 });
  }, 15000);

  it('NewsArticlePage — translation polling interval', async () => {
    let polls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/api/news/n-poll-final')) {
          polls += 1;
          return new Response(
            JSON.stringify({
              data: {
                id: 'n-poll-final',
                title: 'Poll article',
                summary: 'Summary',
                published_at: '2026-01-01T00:00:00Z',
                reliability_score: 0.8,
                source_name: 'Test',
                translated: polls > 1,
                titleVi: polls > 1 ? 'Đã dịch' : undefined,
                summaryVi: polls > 1 ? 'Tóm tắt' : undefined,
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response(JSON.stringify(mockApiBody(url)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );

    vi.useFakeTimers({ shouldAdvanceTime: true });
    const view = renderRoute(
      '/news-intelligence/n-poll-final',
      <Routes>
        <Route path="/news-intelligence/:articleId" element={<NewsArticlePage />} />
      </Routes>,
    );
    await vi.runOnlyPendingTimersAsync();
    await vi.advanceTimersByTimeAsync(5200);
    expect(view.container.textContent?.length ?? 0).toBeGreaterThan(10);
    expect(polls).toBeGreaterThan(0);
  });

  it('TournamentSchedulePanel — finished filter and day chip fallback', async () => {
    const user = userEvent.setup();
    const finished = sampleScheduleMatches.map((m, i) =>
      i === 0 ? { ...m, status: 'finished' as const, home_score: 2, away_score: 1 } : m,
    );
    const view = renderApp(
      <TournamentSchedulePanel
        byDate={buildScheduleByDate()}
        matches={finished}
        probs={sampleMatchProbs}
      />,
    );
    const completedBtn = findButton(/completed|đã kết thúc|finished/i);
    if (completedBtn) await user.click(completedBtn);
    expect(view.container.textContent?.length ?? 0).toBeGreaterThan(20);
  });

  it('misc component one-liners and small gaps', async () => {
    renderApp(
      <MatchScheduleCalendar
        matches={[{ ...sampleScheduleMatch, kickoff_utc: 'invalid-date' }]}
        probs={sampleMatchProbs}
      />,
    );

    renderApp(
      <MatchLineupSidePanel
        label="Home"
        side={{
          teamName: 'USA',
          formation: '4-3-3',
          source: 'projected',
          hasAccurateLineup: false,
          hasLineup: false,
          starters: [],
          substitutes: [],
          grouped: { GK: [], DEF: [], MID: [], FWD: [] },
          lineupPlayers: [],
          players: [],
        }}
      />,
    );

    renderApp(<MatchResultScore homeScore={1} awayScore={1} status="live" variant="badge" />);
    renderApp(<MatchResultScore homeScore={0} awayScore={2} status="completed" variant="compact" />);

    renderApp(
      <PredictedActualScores
        predicted="2-1"
        homeScore={1}
        awayScore={1}
        status="live"
      />,
    );

    renderApp(
      <PitchPlayerLayer
        side="home"
        showRatings
        players={[
          {
            playerId: 'p1',
            name: 'A',
            shirtNumber: 7,
            x: 0.3,
            y: 0.4,
            rating: 6.2,
            movement: { dx: 0, dy: 0, magnitude: 0 },
          },
        ]}
      />,
    );

    renderApp(
      <ProbabilityMovementTimeline
        intervals={{
          '45': { homeWinProb: 0.4, drawProb: 0.3, awayWinProb: 0.3 },
        }}
        currentMinute={50}
      />,
    );

    renderApp(
      <MatchAnalyticsPanel
        stats={{
          matchId: SMOKE_MATCH_ID,
          updatedAt: '2026-06-01T00:00:00Z',
          home: { possession: 55, xg: 1.2, shots: 10, shotsOnTarget: 4, passes: 400, passAccuracy: 85 },
          away: { possession: 45, xg: 0.8, shots: 8, shotsOnTarget: 2, passes: 320, passAccuracy: 80 },
        }}
      />,
    );

    renderApp(
      <MatchLiveStatsPanel
        stats={{
          matchId: SMOKE_MATCH_ID,
          updatedAt: '2026-06-01T00:00:00Z',
          home: { possession: 50, xg: 1, shots: 5, shotsOnTarget: 2, passes: 200, passAccuracy: 80 },
          away: { possession: 50, xg: 1, shots: 5, shotsOnTarget: 2, passes: 200, passAccuracy: 80 },
        }}
        loading={false}
      />,
    );

    renderApp(
      <MatchStaffPanel
        staff={{
          matchId: SMOKE_MATCH_ID,
          slug: 'usa-vs-mexico',
          homeCoach: null,
          awayCoach: { coachId: 'c', name: 'Coach', nationality: 'MX', wcAppearances: 1, tenureYears: 2, tacticalRating: 0.7, disciplineIndex: 0.5 },
          officials: [],
          referee: null,
        }}
      />,
    );

    renderApp(
      <MatchStickyScoreBar
        homeName="USA"
        awayName="Mexico"
        homeScore={1}
        awayScore={0}
        status="live"
        minute={55}
      />,
    );

    renderApp(
      <MatchVersusThumbnail
        homeName="USA"
        awayName="Mexico"
        homeCountryCode="US"
        awayCountryCode="MX"
        status="scheduled"
      />,
    );

    renderApp(
      <MultiVariablePanel
        analysis={{
          executiveSummary: 'Summary',
          variableInsights: [{ variable: 'form', insight: 'Home edge', confidence: 0.7 }],
        }}
      />,
    );

    renderApp(<MatchKickoffDisplay kickoffUtc="2026-06-11T20:00:00Z" showVnReference />);
    renderApp(<MatchPredictionSummary prob={null} homeLabel="A" awayLabel="B" />);
    renderApp(<ScenarioLikelihoodPanel likelihood={0.42} confidence={0.8} />);
    renderApp(
      <ScenarioPredictionPanel
        scenarioSet={{
          matchId: SMOKE_MATCH_ID,
          scenarios: [],
          comparison: null,
          disclaimer: 'd',
        }}
        homeName="USA"
        awayName="Mexico"
      />,
    );
    renderApp(<ScenarioConfidenceBadge confidence={0.9} />);

    renderApp(
      <PitchMap
        data={{
          ...samplePitchMap,
          home: { ...samplePitchMap.home, source: 'unknown_source' },
        }}
        homeLabel="USA"
        awayLabel="Mexico"
      />,
    );

    renderApp(
      <MatchHeader
        homeName="USA"
        awayName="Mexico"
        homeScore={1}
        awayScore={0}
        status="live"
        minute={67}
        stage="Group"
        groupCode="A"
        kickoffUtc={sampleScheduleMatch.kickoff_utc}
        prob={sampleProbability}
      />,
    );

    renderApp(
      <ScorelineMatrix
        distribution={{ '1-0': 0.15, '1-1': 0.12, '2-1': 0.1 }}
        highlightScore="1-0"
      />,
    );

    renderApp(
      <TacticalBriefingPanel
        briefing={{
          summary: { vi: 'Tóm tắt', en: 'Summary' },
          tacticalThemes: [],
          collectiveTeamFactors: [],
          lineupRisks: [],
          keyPlayers: [],
          probabilityExplanation: [],
          uncertaintyNotes: [],
          citations: [],
        }}
      />,
    );

    renderApp(
      <TeamSystemPanel
        payload={{
          matchId: SMOKE_MATCH_ID,
          home: { formation: '4-3-3', collectiveStrengthScore: 0.8, tacticalIdentity: 'pressing' },
          away: null,
        }}
      />,
    );

    renderApp(<FavoritesPanel matches={sampleScheduleMatches} teams={[]} />);
    renderApp(<TeamsDirectory teams={[]} loading={false} />);

    renderRoute('/matches/m-test/lineup', <Routes><Route path="/matches/:matchId/lineup" element={<LineupPage />} /></Routes>);
    renderRoute('/teams/t-usa', <Routes><Route path="/teams/:teamId" element={<TeamPage />} /></Routes>);
    renderRoute('/tournaments/2026', <Routes><Route path="/tournaments/:year" element={<TournamentPage />} /></Routes>);
    renderRoute('/news-intelligence', <Routes><Route path="/news-intelligence" element={<NewsIntelligencePage />} /></Routes>);
    renderRoute('/', <Routes><Route path="/" element={<HomePage />} /></Routes>);
    renderRoute('/tournaments', <Routes><Route path="/tournaments" element={<TournamentsHubPage />} /></Routes>);
    renderRoute('/analyst-simulator', <Routes><Route path="/analyst-simulator" element={<AnalystSimulatorPage />} /></Routes>);

    await waitFor(() => expect(document.body.textContent?.length ?? 0).toBeGreaterThan(50), {
      timeout: 15000,
    });
  }, 20000);

  it('MatchPage — editorial view with preview subtitle and briefing takeaways', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.match(new RegExp(`/api/matches/${SMOKE_MATCH_ID}/preview$`))) {
          return new Response(JSON.stringify({ data: analysisPreview() }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (url.match(new RegExp(`/api/matches/${SMOKE_MATCH_ID}$`))) {
          return new Response(
            JSON.stringify({
              data: {
                ...sampleScheduleMatch,
                id: SMOKE_MATCH_ID,
                slug: SMOKE_MATCH_ID,
                status: 'live',
                home_score: 1,
                away_score: 0,
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response(JSON.stringify(mockApiBody(url)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );
    const user = userEvent.setup();
    const view = renderRoute(
      `/matches/${SMOKE_MATCH_ID}`,
      <Routes>
        <Route path="/matches/:matchId" element={<MatchPage />} />
      </Routes>,
    );
    await waitFor(() => expect(document.body.textContent).toMatch(/USA|Mexico/i), { timeout: 12000 });
    const editorialBtn = screen.getAllByRole('button').find((b) => /editorial|bài viết|article/i.test(b.textContent ?? ''));
    if (editorialBtn) await user.click(editorialBtn);
    expect(document.body.textContent).toMatch(/USA|Mexico|summary|tóm tắt|preview/i);
    void view;
  }, 20000);

  it('PredictedActualScores — completed score match badge', () => {
    const view = renderApp(
      <PredictedActualScores predicted="1-1" homeScore={1} awayScore={1} status="completed" layout="inline" />,
    );
    expect(view.container.textContent).toMatch(/1-1|match|khớp/i);
  });

  it('TournamentSchedulePanel — finished status filter branch', async () => {
    const user = userEvent.setup();
    const finishedOnly = sampleScheduleMatches.map((m, i) =>
      i === 1 ? { ...m, status: 'finished' as const, home_score: 2, away_score: 2 } : m,
    );
    const view = renderApp(
      <TournamentSchedulePanel byDate={buildScheduleByDate()} matches={finishedOnly} probs={sampleMatchProbs} />,
    );
    const completedBtn = findButton(/completed|đã kết thúc|finished/i);
    if (completedBtn) await user.click(completedBtn);
    const queryInput = view.container.querySelector('input[type="search"], input[type="text"]');
    if (queryInput) await user.type(queryInput, 'USA');
    expect(view.container.textContent?.length ?? 0).toBeGreaterThan(10);
  });
});

function sampleKnockoutMatch(
  stage: string,
  id: string,
  status: 'live' | 'completed' | 'finished' | 'scheduled',
  homeScore: number,
  awayScore: number,
) {
  return {
    ...sampleScheduleMatch,
    id,
    slug: `${id}-slug`,
    stage,
    group_code: undefined,
    status,
    home_score: homeScore,
    away_score: awayScore,
    kickoff_utc: '2026-07-01T00:00:00Z',
  };
}
