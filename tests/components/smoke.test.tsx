import { type ComponentType, type ReactElement } from 'react';
import { describe, it, beforeEach, expect } from 'vitest';
import { render, waitFor, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  BrowserRouter,
  MemoryRouter,
  Routes,
  Route,
} from 'react-router-dom';
import { I18nProvider } from '../../app/lib/i18n/I18nContext';
import { SEO_PAGES } from '../../app/lib/seoPages';
import { installSmokeFetchMock } from '../helpers/smokeFetch';
import { COMPONENT_PROPS, ROUTE_WRAPPED_COMPONENTS, ASYNC_SMOKE_COMPONENTS } from '../helpers/smokeProps';

import { AdminPage } from '../../app/pages/AdminPage';
import { AnalystSimulatorPage } from '../../app/pages/AnalystSimulatorPage';
import { ApiDocsPage } from '../../app/pages/ApiDocsPage';
import { GuidePage } from '../../app/pages/GuidePage';
import { HomePage } from '../../app/pages/HomePage';
import { LineupPage } from '../../app/pages/LineupPage';
import { MatchAnalysisPage } from '../../app/pages/MatchAnalysisPage';
import { MatchPage } from '../../app/pages/MatchPage';
import { MatchesPage } from '../../app/pages/MatchesPage';
import { NewsArticlePage } from '../../app/pages/NewsArticlePage';
import { NewsIntelligencePage } from '../../app/pages/NewsIntelligencePage';
import { PlayerPage } from '../../app/pages/PlayerPage';
import { SeoLandingPage } from '../../app/pages/SeoLandingPage';
import { TeamPage } from '../../app/pages/TeamPage';
import { TournamentPage } from '../../app/pages/TournamentPage';
import { TournamentsHubPage } from '../../app/pages/TournamentsHubPage';
import { GroupStageBoard } from '../../app/components/tournament/GroupStageBoard';
import { TournamentSchedulePanel } from '../../app/components/tournament/TournamentSchedulePanel';
import { MatchHistoryPanel } from '../../app/components/match/MatchHistoryPanel';
import { MatchLiveStatsPanel } from '../../app/components/match/MatchLiveStatsPanel';
import { PitchMap } from '../../app/components/tactical/PitchMap';
import {
  sampleHistoryMatch,
  sampleH2HSummary,
  sampleMatchProbs,
  samplePitchMap,
  sampleRecentWc,
  sampleScheduleMatches,
  sampleStandings,
  SMOKE_MATCH_ID,
} from '../helpers/smokeFixtures';

const REEXPORT_SUFFIXES = [
  '/match/TacticalBriefingPanel.tsx',
  '/match/ScorelineMatrix.tsx',
  '/match/IntervalProbabilityChart.tsx',
  '/match/MatchHeader.tsx',
  '/match/PitchMap.tsx',
  '/match/ProbabilityStrip.tsx',
  '/intelligence/SourceConfidenceBadge.tsx',
];

const NON_COMPONENT_EXPORTS = new Set(['hasMatchResult']);

const componentModules = import.meta.glob<{ [key: string]: unknown }>(
  '../../app/components/**/*.tsx',
  { eager: true },
);

type PageCase = {
  name: string;
  path: string;
  entry: string;
  Component: ComponentType;
  suspense?: boolean;
};

const PAGE_CASES: PageCase[] = [
  { name: 'HomePage', path: '/', entry: '/', Component: HomePage },
  { name: 'MatchesPage', path: '/matches', entry: '/matches', Component: MatchesPage },
  { name: 'MatchPage', path: '/matches/:matchId', entry: '/matches/m-test', Component: MatchPage },
  {
    name: 'MatchAnalysisPage',
    path: '/matches/:matchId/analysis',
    entry: '/matches/m-test/analysis',
    Component: MatchAnalysisPage,
  },
  { name: 'TeamPage', path: '/teams/:teamId', entry: '/teams/t-usa', Component: TeamPage },
  { name: 'PlayerPage', path: '/players/:playerId', entry: '/players/p-test', Component: PlayerPage },
  { name: 'LineupPage', path: '/lineups/:matchId', entry: '/lineups/m-test', Component: LineupPage },
  {
    name: 'NewsIntelligencePage',
    path: '/news-intelligence',
    entry: '/news-intelligence',
    Component: NewsIntelligencePage,
  },
  {
    name: 'NewsArticlePage',
    path: '/news-intelligence/:articleId',
    entry: '/news-intelligence/n-test',
    Component: NewsArticlePage,
  },
  { name: 'GuidePage', path: '/guide', entry: '/guide', Component: GuidePage },
  { name: 'ApiDocsPage', path: '/docs/api', entry: '/docs/api', Component: ApiDocsPage },
  { name: 'AdminPage', path: '/admin', entry: '/admin', Component: AdminPage },
  {
    name: 'AnalystSimulatorPage',
    path: '/analyst/simulator',
    entry: '/analyst/simulator',
    Component: AnalystSimulatorPage,
  },
  { name: 'TournamentPage', path: '/tournaments', entry: '/tournaments', Component: TournamentPage },
  {
    name: 'TournamentsHubPage',
    path: '/tournaments-hub',
    entry: '/tournaments-hub',
    Component: TournamentsHubPage,
  },
  ...SEO_PAGES.map((page) => ({
    name: `SeoLandingPage${page.path}`,
    path: page.path,
    entry: page.path,
    Component: SeoLandingPage,
  })),
];

function isReexport(filePath: string) {
  return REEXPORT_SUFFIXES.some((suffix) => filePath.endsWith(suffix));
}

function renderWithProviders(
  ui: ReactElement,
  {
    router = 'browser',
    initialEntries = ['/'],
    routePath,
  }: {
    router?: 'browser' | 'memory';
    initialEntries?: string[];
    routePath?: string;
  } = {},
) {
  const routed = routePath ? (
    <Routes>
      <Route path={routePath} element={ui} />
    </Routes>
  ) : (
    ui
  );

  const inner = <I18nProvider>{routed}</I18nProvider>;

  if (router === 'memory') {
    return render(<MemoryRouter initialEntries={initialEntries}>{inner}</MemoryRouter>);
  }

  return render(<BrowserRouter>{inner}</BrowserRouter>);
}

async function smokeRender(
  label: string,
  renderFn: () => ReturnType<typeof render>,
  skipped: string[] = [],
  wait = false,
  timeout = 3000,
) {
  try {
    const result = renderFn();
    if (wait) {
      await waitFor(
        () => {
          expect(result.container.textContent?.length ?? 0).toBeGreaterThan(0);
        },
        { timeout },
      );
    } else {
      expect(result.container).toBeTruthy();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    skipped.push(`${label}: ${message}`);
  }
}

beforeEach(() => {
  installSmokeFetchMock();
  window.__PITCHINTEL_HOME__ = undefined;
});

describe('page smoke renders', () => {
  const skipped: string[] = [];

  for (const page of PAGE_CASES) {
    it(`renders ${page.name}`, async () => {
      const longWait = page.name === 'MatchPage' || page.name === 'MatchAnalysisPage';
      await smokeRender(
        page.name,
        () =>
          renderWithProviders(<page.Component />, {
            router: 'memory',
            initialEntries: [page.entry],
            routePath: page.path,
          }),
        skipped,
        true,
        longWait ? 8000 : 3000,
      );
    });
  }

  it('reports skipped pages', () => {
    expect(skipped, skipped.join('\n')).toEqual([]);
  });
});

describe('component smoke renders', () => {
  const skipped: string[] = [];

  for (const [filePath, mod] of Object.entries(componentModules)) {
    if (isReexport(filePath)) continue;

    const fileName = filePath.split('/').pop()!.replace('.tsx', '');

    for (const [exportName, value] of Object.entries(mod)) {
      if (typeof value !== 'function') continue;
      if (!/^[A-Z]/.test(exportName)) continue;
      if (NON_COMPONENT_EXPORTS.has(exportName)) continue;

      const label = `${fileName}.${exportName}`;
      const Component = value as ComponentType<Record<string, unknown>>;
      const props = COMPONENT_PROPS[exportName] ?? {};

      it(`renders ${label}`, async () => {
        const needsWait = ASYNC_SMOKE_COMPONENTS.has(exportName);
        await smokeRender(label, () => {
          const element = <Component {...props} />;

          if (ROUTE_WRAPPED_COMPONENTS.has(exportName)) {
            return render(
              <MemoryRouter initialEntries={['/']}>
                <I18nProvider>
                  <Routes>
                    <Route element={element}>
                      <Route index element={<div data-testid="outlet-child" />} />
                    </Route>
                  </Routes>
                </I18nProvider>
              </MemoryRouter>,
            );
          }

          return renderWithProviders(element);
        }, skipped, needsWait);
      });
    }
  }

  it('reports skipped components', () => {
    expect(skipped, skipped.join('\n')).toEqual([]);
  });
});

describe('App', () => {
  it('renders with MemoryRouter via BrowserRouter shim', async () => {
    const { default: App } = await import('../../app/App');
    const result = render(<App />);
    await waitFor(() => expect(result.container.textContent?.length ?? 0).toBeGreaterThan(0), {
      timeout: 5000,
    });
  });
});

describe('data-rich component branches', () => {
  beforeEach(() => {
    installSmokeFetchMock();
  });

  it('GroupStageBoard renders group standings and knockout tab', async () => {
    const user = userEvent.setup();
    const view = renderWithProviders(
      <GroupStageBoard
        matches={sampleScheduleMatches}
        initialStandings={sampleStandings}
        initialProbs={sampleMatchProbs}
      />,
    );

    expect(view.container.textContent).toMatch(/USA|MEX|Mexico/i);
    const knockoutBtn = screen.getAllByRole('button').find((b) => /knock|loại/i.test(b.textContent ?? ''));
    if (knockoutBtn) {
      await user.click(knockoutBtn);
      expect(view.container.textContent).toMatch(/Brazil|BRA/i);
    }
  });

  it('TournamentSchedulePanel filters matches and toggles view', async () => {
    const user = userEvent.setup();
    const view = renderWithProviders(
      <TournamentSchedulePanel
        byDate={{ '2026-06-11': sampleScheduleMatches }}
        matches={sampleScheduleMatches}
        probs={sampleMatchProbs}
        totalExpected={104}
      />,
    );

    expect(view.container.textContent).toMatch(/USA|Mexico/i);
    const liveBtn = screen.getAllByRole('button').find((b) => /live|đang diễn ra/i.test(b.textContent ?? ''));
    if (liveBtn) {
      await user.click(liveBtn);
      expect(view.container.textContent).toMatch(/Canada|CAN/i);
    }
  });

  it('MatchHistoryPanel shows H2H summary and recent WC form', async () => {
    renderWithProviders(
      <MatchHistoryPanel
        homeName="USA"
        awayName="Mexico"
        history={[sampleHistoryMatch]}
        summary={sampleH2HSummary}
        homeRecentWc={[sampleRecentWc]}
        awayRecentWc={[{ ...sampleRecentWc, result: 'L', teamScore: 0, opponentScore: 2 }]}
      />,
    );

    expect((await screen.findAllByText(/2.0/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/WDL|LDW/).length).toBeGreaterThan(0);
  });

  it('MatchLiveStatsPanel loads live stats from API', async () => {
    renderWithProviders(
      <MatchLiveStatsPanel matchId={SMOKE_MATCH_ID} homeLabel="USA" awayLabel="Mexico" live />,
    );

    expect(await screen.findByText(/58%|58 %/)).toBeTruthy();
    expect(screen.getByText(/FIFA Live|fifa live/i)).toBeTruthy();
  });

  it('GroupStageBoard loads standings from API when initial data omitted', async () => {
    const view = renderWithProviders(<GroupStageBoard matches={sampleScheduleMatches} />);
    await waitFor(() => expect(view.container.textContent).toMatch(/USA|Mexico/i), { timeout: 5000 });
  });

  it('PitchMap renders formations and players', async () => {
    renderWithProviders(
      <PitchMap data={samplePitchMap} homeLabel="USA" awayLabel="Mexico" />,
    );

    expect(await screen.findByText(/4-3-3/)).toBeTruthy();
    expect(screen.getByText(/Player One/i)).toBeTruthy();
  });
});
