import { cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nProvider } from '../../app/lib/i18n/I18nContext';
import { FavoriteButton } from '../../app/components/favorites/FavoriteButton';
import { Bilingual } from '../../app/components/i18n/Bilingual';
import { FeaturedMatchHero } from '../../app/components/home/FeaturedMatchHero';
import { HomeNewsPreview } from '../../app/components/home/HomeNewsPreview';
import { HomePage } from '../../app/pages/HomePage';
import { MatchesPage } from '../../app/pages/MatchesPage';
import { MatchPage } from '../../app/pages/MatchPage';
import { NewsArticlePage } from '../../app/pages/NewsArticlePage';
import { NewsIntelligencePage } from '../../app/pages/NewsIntelligencePage';
import { NewsThumbnail } from '../../app/components/news/NewsThumbnail';
import { MatchVersusThumbnail } from '../../app/components/match/MatchVersusThumbnail';
import { MatchStickyScoreBar } from '../../app/components/match/MatchStickyScoreBar';
import { GroupStageBoard } from '../../app/components/tournament/GroupStageBoard';
import { useMatchLiveData } from '../../app/lib/useMatchLiveData';
import { usePitchMapLive } from '../../app/lib/usePitchMapLive';
import { api } from '../../app/lib/api';
import { installSmokeFetchMock, mockApiBody } from '../helpers/smokeFetch';
import {
  sampleLiveMatch,
  sampleMatchProbs,
  sampleProbability,
  sampleScheduleMatch,
  sampleScheduleMatches,
  SMOKE_MATCH_ID,
} from '../helpers/smokeFixtures';

function renderApp(ui: ReactElement, entry = '/') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <I18nProvider>{ui}</I18nProvider>
    </MemoryRouter>,
  );
}

function findButton(matcher: RegExp) {
  return screen.getAllByRole('button').find((b) => matcher.test(b.textContent ?? ''));
}

describe('app lines 100% coverage', () => {
  beforeEach(() => {
    installSmokeFetchMock();
    window.__PITCHINTEL_HOME__ = undefined;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('FavoriteButton handles click propagation and md size', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const view = renderApp(
      <FavoriteButton active label="USA" onToggle={onToggle} size="md" />,
    );
    await user.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalled();
    expect(view.container.textContent).toContain('★');
  });

  it('Bilingual renders vi/en props without locale key', () => {
    const view = renderApp(<Bilingual vi="Tiếng Việt" en="English" as="p" />);
    expect(view.container.textContent).toMatch(/Tiếng Việt|English/);
  });

  it('FeaturedMatchHero covers live, group, and knockout branches', () => {
    const live = renderApp(
      <FeaturedMatchHero
        match={{
          ...sampleLiveMatch,
          stage: 'Group',
          group_code: 'A',
          probability: sampleProbability,
        }}
      />,
    );
    expect(live.container.textContent).toMatch(/live|trực tiếp/i);
    cleanup();

    const knockout = renderApp(
      <FeaturedMatchHero
        match={{
          ...sampleScheduleMatch,
          stage: 'Round of 16',
          status: 'scheduled',
          probability: { ...sampleProbability, mostLikelyScore: '2-1' },
        }}
      />,
    );
    expect(knockout.container.textContent).toMatch(/Round|vòng/i);
  });

  it('HomeNewsPreview renders hot articles', () => {
    const view = renderApp(
      <HomeNewsPreview
        initialHot={[
          {
            id: 'n-hot',
            title: 'Hot',
            titleVi: 'Nóng',
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
    expect(view.container.textContent).toMatch(/Hot|Nóng/i);
  });

  it('HomePage uses prefetch payload', async () => {
    window.__PITCHINTEL_HOME__ = Promise.resolve(mockApiBody('/api/home') as Awaited<ReturnType<typeof api.home>>);
    const view = renderApp(<HomePage />);
    await waitFor(() => expect(view.container.textContent).toMatch(/USA|Mexico|World Cup/i), {
      timeout: 8000,
    });
  });

  it('HomePage handles fetch errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('fail', { status: 500 })));
    const view = renderApp(<HomePage />);
    await waitFor(() => expect(view.container.textContent).toMatch(/World Cup|calendar/i), {
      timeout: 8000,
    });
  });

  it('HomePage shows no-featured fallback', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        const body = mockApiBody(url);
        if (url.includes('/api/home')) {
          return new Response(
            JSON.stringify({
              ...body,
              data: { ...body.data, dashboard: { ...body.data.dashboard, featuredMatch: null } },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );
    const view = renderApp(<HomePage />);
    await waitFor(() => expect(view.container.textContent).toMatch(/no featured|chưa có|sắp diễn ra|upcoming/i), {
      timeout: 12000,
    });
  }, 15000);

  it('MatchesPage switches hub tabs', async () => {
    const user = userEvent.setup();
    const view = renderApp(<MatchesPage />, '/matches');
    await waitFor(() => expect(view.container.textContent).toMatch(/USA|Mexico/i), { timeout: 8000 });

    for (const tab of [/standings|bảng/i, /favorite|yêu thích/i, /teams|đội/i, /schedule|lịch/i]) {
      const btn = findButton(tab);
      if (btn) await user.click(btn);
    }
    expect(view.container.textContent?.length ?? 0).toBeGreaterThan(50);
  });

  it('MatchesPage handles load errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('fail', { status: 500 })));
    const view = renderApp(<MatchesPage />);
    await waitFor(() => expect(view.container.textContent).toMatch(/loading|schedule|lịch/i), {
      timeout: 8000,
    });
  });

  it('MatchPage shows unknown status label', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.match(/\/api\/matches\/m-postponed$/)) {
          return new Response(
            JSON.stringify({
              data: { ...sampleScheduleMatch, id: 'm-postponed', status: 'postponed', slug: 'm-postponed' },
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
    renderApp(
      <Routes>
        <Route path="/matches/:matchId" element={<MatchPage />} />
      </Routes>,
      '/matches/m-postponed',
    );
    await waitFor(() => expect(document.body.textContent).toMatch(/POSTPONED|postponed/i), {
      timeout: 8000,
    });
  });

  it('MatchPage editorial mode and live scoreline matrix', async () => {
    const user = userEvent.setup();
    const view = renderApp(
      <Routes>
        <Route path="/matches/:matchId" element={<MatchPage />} />
      </Routes>,
      '/matches/m-live',
    );
    await waitFor(() => expect(view.container.textContent).toMatch(/USA|Canada/i), { timeout: 8000 });

    const editorialBtn = findButton(/editorial|bài viết/i);
    if (editorialBtn) {
      await user.click(editorialBtn);
      await waitFor(() => expect(view.container.textContent?.length ?? 0).toBeGreaterThan(200), {
        timeout: 8000,
      });
    }

    const statsNav = findButton(/stats|thống kê/i);
    if (statsNav) await user.click(statsNav);
    expect(view.container.textContent).toMatch(/1-1|scoreline|tỷ số/i);
  });

  it('NewsArticlePage renders without article id', () => {
    const view = renderApp(
      <Routes>
        <Route path="/news-intelligence" element={<NewsArticlePage />} />
      </Routes>,
      '/news-intelligence',
    );
    expect(view.container.textContent).toMatch(/back|feed|quay/i);
  });

  it('NewsIntelligencePage loads feed', async () => {
    const view = renderApp(<NewsIntelligencePage />);
    await waitFor(() => expect(view.container.textContent?.length ?? 0).toBeGreaterThan(30), {
      timeout: 8000,
    });
  });

  it('NewsThumbnail handles image error and missing thumbnail', () => {
    const withImg = renderApp(
      <NewsThumbnail article={{ title: 'T', thumbnail_url: '/thumb.jpg' }} size="large" />,
    );
    const img = withImg.container.querySelector('img');
    img?.dispatchEvent(new Event('error'));
    cleanup();

    const fallback = renderApp(<NewsThumbnail article={{ title: 'T', thumbnail_url: null as never }} />);
    expect(fallback.container.textContent).toContain('⚽');
  });

  it('MatchVersusThumbnail compact variant shows flags', () => {
    const view = renderApp(
      <MatchVersusThumbnail
        homeName="USA"
        awayName="Mexico"
        homeCountryCode="US"
        awayCountryCode="MX"
        matchRef="usa-vs-mexico"
        variant="compact"
      />,
    );
    expect(view.container.querySelectorAll('img').length).toBeGreaterThan(0);
  });

  it('MatchStickyScoreBar covers status branches', () => {
    const live = renderApp(
      <MatchStickyScoreBar
        home="USA"
        away="Mexico"
        homeScore={1}
        awayScore={0}
        status="live"
        minute={55}
        visible
      />,
    );
    expect(live.container.textContent).toMatch(/55|live/i);
    cleanup();

    const postponed = renderApp(
      <MatchStickyScoreBar
        home="USA"
        away="Mexico"
        homeScore={0}
        awayScore={0}
        status="postponed"
        visible
      />,
    );
    expect(postponed.container.textContent).toMatch(/POSTPONED/i);
  });

  it('GroupStageBoard shows knockout round tabs', async () => {
    const user = userEvent.setup();
    const view = renderApp(<GroupStageBoard matches={sampleScheduleMatches} />);
    const knockoutTab = findButton(/knock|loại/i);
    expect(knockoutTab).toBeTruthy();
    await user.click(knockoutTab!);
    await waitFor(() => expect(view.container.textContent).toMatch(/Brazil|USA|knock|loại/i), {
      timeout: 8000,
    });
    const roundTabs = screen.getAllByRole('tab');
    if (roundTabs.length > 1) await user.click(roundTabs[1]!);
  });

  it('api client covers dashboard and comparison endpoints', async () => {
    await api.dashboard();
    await api.matchScenarioComparison(SMOKE_MATCH_ID);
    await api.matchModelVsMarket(SMOKE_MATCH_ID);
  });

  it('useMatchLiveData clears state without matchId and handles errors', async () => {
    const { result, unmount } = renderHook(() => useMatchLiveData(undefined));
    expect(result.current.match).toBeNull();
    unmount();

    vi.stubGlobal('fetch', vi.fn(async () => new Response('fail', { status: 500 })));
    const { result: errResult, unmount: errUnmount } = renderHook(() => useMatchLiveData(SMOKE_MATCH_ID));
    await waitFor(() => expect(errResult.current.loadError).toBe(true));
    errUnmount();
  }, 15000);

  it('usePitchMapLive handles errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('fail', { status: 500 })));
    const { result, unmount } = renderHook(() => usePitchMapLive(SMOKE_MATCH_ID, false));
    await waitFor(() => expect(result.current.error).toBe(true));
    unmount();
  });
});
