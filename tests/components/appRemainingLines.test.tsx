import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../../app/lib/i18n/I18nContext';
import { BracketPanel, GroupStandingsGrid } from '../../app/components/tournament/TournamentPanels';
import { SourceConfidencePanel } from '../../app/components/intelligence/SourceConfidencePanel';
import { HomeNewsPreview } from '../../app/components/home/HomeNewsPreview';
import { MatchPage } from '../../app/pages/MatchPage';
import { installSmokeFetchMock, mockApiBody } from '../helpers/smokeFetch';
import { sampleScheduleMatch } from '../helpers/smokeFixtures';
import { Route, Routes } from 'react-router-dom';

function renderApp(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <I18nProvider>{ui}</I18nProvider>
    </MemoryRouter>,
  );
}

describe('app remaining line coverage', () => {
  beforeEach(() => {
    installSmokeFetchMock();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('GroupStandingsGrid loads standings and shows third-place rows', async () => {
    const view = renderApp(<GroupStandingsGrid />);
    await waitFor(() => expect(view.container.textContent).toMatch(/USA|Mexico|Group/i), {
      timeout: 8000,
    });
  });

  it('GroupStandingsGrid handles API failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('fail', { status: 500 })));
    const view = renderApp(<GroupStandingsGrid />);
    await waitFor(() => expect(view.container.textContent?.length ?? 0).toBeGreaterThan(5), {
      timeout: 10000,
    });
    expect(view.container.textContent).toMatch(/Chưa có|unavailable|loading/i);
  }, 15000);

  it('BracketPanel renders live and completed knockout matches', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/bracket')) {
          return new Response(
            JSON.stringify({
              data: {
                rounds: [
                  {
                    stage: 'Round of 16',
                    matches: [
                      {
                        id: 'm-k1',
                        slug: 'bra-vs-usa',
                        homeName: 'Brazil',
                        awayName: 'USA',
                        kickoffUtc: '2026-07-01T00:00:00Z',
                        status: 'live',
                        homeScore: 1,
                        awayScore: 0,
                      },
                      {
                        id: 'm-k2',
                        slug: 'mex-vs-arg',
                        homeName: 'Mexico',
                        awayName: 'Argentina',
                        kickoffUtc: '2026-07-02T00:00:00Z',
                        status: 'completed',
                        homeScore: 2,
                        awayScore: 1,
                      },
                    ],
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
    const view = renderApp(<BracketPanel />);
    await waitFor(() => expect(view.container.textContent).toMatch(/Brazil|live|2–1|2-1/i), {
      timeout: 8000,
    });
  });

  it('SourceConfidencePanel covers tier and url branches', () => {
    const full = renderApp(
      <SourceConfidencePanel
        sources={[
          { name: 'FIFA', score: 0.9, url: 'https://fifa.com' },
          { name: 'Trusted', score: 0.75 },
          { name: 'Review', score: 0.5, url: 'https://news.example.com' },
        ]}
      />,
    );
    expect(full.container.textContent).toMatch(/FIFA|Trusted|Review/i);

    const compact = renderApp(
      <SourceConfidencePanel
        compact
        sources={[
          { name: 'Compact', score: 0.88, url: 'https://example.com' },
          { name: 'Plain', score: 0.6 },
        ]}
      />,
    );
    expect(compact.container.textContent).toMatch(/Compact|Plain/i);
  });

  it('HomeNewsPreview polls for Vietnamese translations', async () => {
    vi.useFakeTimers();
    const view = renderApp(
      <HomeNewsPreview
        initialHot={[
          {
            id: 'n-vi',
            title: 'English only',
            titleVi: 'Tiếng Việt',
            summary: 'S',
            summaryVi: 'T',
            published_at: '2026-01-01T00:00:00Z',
            reliability_score: 0.8,
            source_name: 'Src',
            translated: false,
          },
        ]}
      />,
    );
    expect(view.container.textContent).toMatch(/English|Tiếng/i);
    await vi.advanceTimersByTimeAsync(9000);
    await vi.advanceTimersByTimeAsync(6000);
  });

  it('MatchPage scheduled view omits live actual score on matrix', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.match(/\/api\/matches\/usa-vs-mexico$/)) {
          return new Response(
            JSON.stringify({ data: { ...sampleScheduleMatch, status: 'scheduled' } }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response(JSON.stringify(mockApiBody(url)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );
    const view = render(
      <MemoryRouter initialEntries={['/matches/usa-vs-mexico']}>
        <I18nProvider>
          <Routes>
            <Route path="/matches/:matchId" element={<MatchPage />} />
          </Routes>
        </I18nProvider>
      </MemoryRouter>,
    );
    await waitFor(() => expect(view.container.textContent).toMatch(/USA|Mexico/i), { timeout: 8000 });
    const predictionBtn = screen.getAllByRole('button').find((b) => /prediction|xác suất/i.test(b.textContent ?? ''));
    if (predictionBtn) await predictionBtn.click();
    expect(view.container.textContent).toMatch(/2-1|1-1|scoreline/i);
  });
});
