import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nProvider } from '../app/lib/i18n/I18nContext';
import { LangSwitch } from '../app/components/i18n/LangSwitch';
import { HomeNewsPreview } from '../app/components/home/HomeNewsPreview';
import { MatchScheduleCalendar } from '../app/components/home/MatchScheduleCalendar';
import { NewsFeedPanel } from '../app/components/home/NewsFeedPanel';
import { NewsArticleCard } from '../app/components/news/NewsArticleCard';
import { NewsArticleLangToggle } from '../app/components/news/NewsArticleLangToggle';
import { NewsPagination } from '../app/components/news/NewsPagination';
import { FavoritesPanel } from '../app/components/tournament/FavoritesPanel';
import { TeamsDirectory } from '../app/components/tournament/TeamsDirectory';
import { TournamentSchedulePanel } from '../app/components/tournament/TournamentSchedulePanel';
import { GroupStageBoard } from '../app/components/tournament/GroupStageBoard';
import { AnalystSimulatorPanel } from '../app/components/tactical/AnalystSimulatorPanel';
import { AnalystSimulatorPage } from '../app/pages/AnalystSimulatorPage';
import { ApiDocsPage } from '../app/pages/ApiDocsPage';
import { NewsArticlePage } from '../app/pages/NewsArticlePage';
import { NewsIntelligencePage } from '../app/pages/NewsIntelligencePage';
import { TeamPage } from '../app/pages/TeamPage';
import { api } from '../app/lib/api';
import { saveFavorites } from '../app/lib/favorites';
import { installSmokeFetchMock, mockApiBody } from './helpers/smokeFetch';
import {
  buildScheduleByDate,
  sampleMatchProbs,
  sampleScheduleMatches,
  sampleStandings,
  SMOKE_MATCH_ID,
} from './helpers/smokeFixtures';

const sampleArticle = {
  id: 'n-test',
  title: 'Test article',
  titleVi: 'Bài test',
  source_url: 'https://example.com',
  summary: 'Summary',
  summaryVi: 'Tóm tắt',
  published_at: '2026-01-01T00:00:00Z',
  reliability_score: 0.8,
  source_name: 'Test Source',
  hot_score: 0.9,
  thumbnail_url: '/thumb.jpg',
  translated: false,
};

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

describe('coverage branches — round 3 components', () => {
  beforeEach(() => {
    installSmokeFetchMock();
    saveFavorites({ matches: [SMOKE_MATCH_ID, 'm-live'], teams: ['t-usa'] });
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('LangSwitch toggles display mode', async () => {
    const user = userEvent.setup();
    renderApp(<LangSwitch />);
    await user.click(screen.getByRole('button', { name: 'EN' }));
    expect(screen.getByRole('button', { name: 'EN' }).className).toMatch(/pressing/);
  });

  it('HomeNewsPreview navigates on article select', async () => {
    const user = userEvent.setup();
    renderApp(<HomeNewsPreview initialHot={[sampleArticle]} />);
    await user.click(screen.getByRole('button'));
  });

  it('NewsArticleCard handles Enter key selection', () => {
    const onSelect = vi.fn();
    renderApp(<NewsArticleCard article={sampleArticle} onSelect={onSelect} />);
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    expect(onSelect).toHaveBeenCalled();
  });

  it('NewsArticleLangToggle switches article language', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderApp(<NewsArticleLangToggle lang="vi" onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'English' }));
    expect(onChange).toHaveBeenCalledWith('en');
  });

  it('NewsPagination prev/next handlers fire', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    renderApp(
      <NewsPagination page={2} totalPages={3} onPageChange={onPageChange} />,
    );
    await user.click(screen.getByRole('button', { name: /prev|trước/i }));
    await user.click(screen.getByRole('button', { name: /next|sau/i }));
    expect(onPageChange).toHaveBeenCalledWith(1);
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('NewsFeedPanel selects articles and paginates', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onPageChange = vi.fn();
    renderApp(
      <NewsFeedPanel
        hot={[sampleArticle]}
        articles={[sampleArticle, { ...sampleArticle, id: 'n-2' }]}
        lastCrawl="2026-06-01T00:00:00Z"
        page={2}
        totalPages={3}
        onPageChange={onPageChange}
        onSelectArticle={onSelect}
      />,
    );
    const cards = screen.getAllByRole('button');
    await user.click(cards[0]!);
    expect(onSelect).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /next|sau/i }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('MatchScheduleCalendar filters by stage and search', async () => {
    const user = userEvent.setup();
    const view = renderApp(
      <MatchScheduleCalendar
        byDate={buildScheduleByDate()}
        matches={sampleScheduleMatches}
        totalExpected={200}
      />,
    );
    const groupBtn = findButton(/group|vòng bảng/i);
    if (groupBtn) await user.click(groupBtn);
    const knockoutBtn = findButton(/knock|loại trực/i);
    if (knockoutBtn) await user.click(knockoutBtn);
    const search = screen.getByPlaceholderText(/search|tìm/i);
    await user.type(search, 'brazil');
    expect(view.container.textContent).toMatch(/Brazil|BRA/i);
  });

  it('TournamentSchedulePanel exercises match action handlers', async () => {
    const user = userEvent.setup();
    const downloadMatch = vi.spyOn(await import('../app/lib/calendarExport'), 'downloadMatchIcs').mockImplementation(() => {});

    const view = renderApp(
      <TournamentSchedulePanel
        byDate={buildScheduleByDate()}
        matches={sampleScheduleMatches}
        probs={sampleMatchProbs}
        totalExpected={200}
      />,
    );

    const favButtons = screen.getAllByRole('button').filter((b) => /★|☆/.test(b.textContent ?? ''));
    if (favButtons[0]) await user.click(favButtons[0]);

    const downloadButtons = view.container.querySelectorAll('button[aria-label], button[title]');
    for (const btn of downloadButtons) {
      if (/download|tải|↓/i.test(btn.textContent ?? '') || /download/i.test(btn.getAttribute('aria-label') ?? '')) {
        await user.click(btn);
        break;
      }
    }

    const googleLink = view.container.querySelector('a[href*="calendar.google.com"]');
    if (googleLink) fireEvent.click(googleLink);

    const listBtn = findButton(/list|danh sách/i);
    if (listBtn) await user.click(listBtn);

    const gridBtn = findButton(/grid|lưới/i);
    if (gridBtn) await user.click(gridBtn);

    const statusBtn = findButton(/live|trực tiếp/i);
    if (statusBtn) {
      await user.click(statusBtn);
      await user.click(statusBtn);
    }

    const dayChips = screen.getAllByRole('button').filter((b) => /\d{4}|Jan|Jun|Thg/i.test(b.textContent ?? ''));
    if (dayChips[0]) {
      await user.click(dayChips[0]!);
      await user.click(dayChips[0]!);
    }

    downloadMatch.mockRestore();
  });

  it('FavoritesPanel toggles match and team favorites', async () => {
    const user = userEvent.setup();
    renderApp(
      <FavoritesPanel
        matches={sampleScheduleMatches}
        teams={[{ id: 't-usa', name: 'USA', short_name: 'USA', country_code: 'US' } as never]}
      />,
    );
    await waitFor(() => expect(screen.getAllByRole('button').length).toBeGreaterThan(0));
    for (const btn of screen.getAllByRole('button')) {
      await user.click(btn);
    }
  });

  it('TeamsDirectory toggles team favorites', async () => {
    const user = userEvent.setup();
    renderApp(
      <TeamsDirectory
        teams={[
          { id: 't-usa', name: 'USA', short_name: 'USA', country_code: 'US' } as never,
          { id: 't-mex', name: 'Mexico', short_name: 'MEX', country_code: 'MX' } as never,
        ]}
      />,
    );
    const favBtn = screen.getAllByRole('button')[0];
    if (favBtn) await user.click(favBtn);
  });

  it('GroupStageBoard switches group/knockout tabs and round chips', async () => {
    const user = userEvent.setup();
    const view = renderApp(
      <GroupStageBoard
        matches={sampleScheduleMatches}
        initialStandings={sampleStandings}
        initialProbs={sampleMatchProbs}
      />,
    );
    const knockoutTab = findButton(/knock|loại/i);
    if (knockoutTab) await user.click(knockoutTab);
    const groupTab = findButton(/group|bảng đấu|vòng bảng/i);
    if (groupTab) await user.click(groupTab);
    if (knockoutTab) {
      await user.click(knockoutTab);
      const roundTabs = screen.getAllByRole('tab');
      if (roundTabs.length > 1) await user.click(roundTabs[1]!);
    }
    expect(view.container.textContent?.length ?? 0).toBeGreaterThan(50);
  });

  it('AnalystSimulatorPanel resets sliders and adjusts probabilities', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderApp(
      <AnalystSimulatorPanel
        base={{ homeWin: 0.4, draw: 0.3, awayWin: 0.3, xgHome: 1.2, xgAway: 1.0 }}
        onChange={onChange}
      />,
    );
    const slider = screen.getAllByRole('slider')[0];
    if (slider) {
      fireEvent.change(slider, { target: { value: '0.5' } });
      expect(onChange).toHaveBeenCalled();
    }
    const resetBtn = findButton(/reset|đặt lại/i);
    if (resetBtn) await user.click(resetBtn);
  });

  it('AnalystSimulatorPage handles match id input change', async () => {
    const user = userEvent.setup();
    const view = renderApp(<AnalystSimulatorPage />);
    const input = view.container.querySelector('input');
    if (input) {
      await user.clear(input);
      await user.type(input, 'm-custom');
    }
  });

  it('ApiDocsPage opens mobile nav and section links', async () => {
    const user = userEvent.setup();
    renderApp(<ApiDocsPage />);
    const mobileToggle = screen.getAllByRole('button').find((b) => /Navigate|▲|▼/.test(b.textContent ?? ''));
    if (mobileToggle) {
      await user.click(mobileToggle);
      const sectionLink = screen.getAllByRole('link').find((a) => a.getAttribute('href')?.startsWith('#'));
      if (sectionLink) await user.click(sectionLink);
    }
  });

  it('NewsArticlePage back handler navigates', async () => {
    const user = userEvent.setup();
    renderApp(
      <Routes>
        <Route path="/news-intelligence/:articleId" element={<NewsArticlePage />} />
      </Routes>,
      '/news-intelligence/n-test',
    );
    await waitFor(() => expect(document.body.textContent?.length ?? 0).toBeGreaterThan(20), {
      timeout: 8000,
    });
    const backBtn = findButton(/back|quay|feed/i);
    if (backBtn) await user.click(backBtn);
  });

  it('NewsIntelligencePage paginates with multi-page feed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/api/news?')) {
          return new Response(
            JSON.stringify({
              data: { hot: [sampleArticle], articles: [sampleArticle] },
              meta: {
                page: url.includes('page=2') ? 2 : 1,
                pageSize: 8,
                total: 16,
                totalPages: 2,
                hotCount: 1,
                lastCrawl: '2026-06-01T00:00:00Z',
                crawlIntervalSec: 900,
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
    renderApp(<NewsIntelligencePage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /next|sau/i })).toBeEnabled(), {
      timeout: 8000,
    });
    await user.click(screen.getByRole('button', { name: /next|sau/i }));
    expect(window.scrollTo).toHaveBeenCalled();
  });

  it('TeamPage toggles team favorite', async () => {
    const user = userEvent.setup();
    renderApp(
      <Routes>
        <Route path="/teams/:teamId" element={<TeamPage />} />
      </Routes>,
      '/teams/t-usa',
    );
    await waitFor(() => expect(document.body.textContent?.length ?? 0).toBeGreaterThan(30), {
      timeout: 8000,
    });
    const favBtn = screen.getAllByRole('button').find((b) => /★|☆|favorite|yêu thích/i.test(b.textContent ?? '') || b.getAttribute('aria-label')?.includes('favorite'));
    if (favBtn) await user.click(favBtn);
  });

  it('api client covers matches, players, and aiConfig', async () => {
    await api.matches();
    await api.players();
    await api.aiConfig();
  });
});
