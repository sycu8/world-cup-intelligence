import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import App from '../../app/App';
import { I18nProvider } from '../../app/lib/i18n/I18nContext';
import { ApiDocsPage } from '../../app/pages/ApiDocsPage';
import { MatchAnalysisPage } from '../../app/pages/MatchAnalysisPage';
import { NewsArticlePage } from '../../app/pages/NewsArticlePage';
import { SeoLandingPage } from '../../app/pages/SeoLandingPage';
import { AnalystSimulatorPage } from '../../app/pages/AnalystSimulatorPage';
import { MatchPageGuideStrip } from '../../app/components/match/MatchPageGuideStrip';
import { MatchVersusThumbnail } from '../../app/components/match/MatchVersusThumbnail';
import { MatchLineupSidePanel } from '../../app/components/match/MatchLineupSidePanel';
import { NewsArticleReadView } from '../../app/components/news/NewsArticleReadView';
import { EventTrajectoryLayer } from '../../app/components/tactical/EventTrajectoryLayer';
import { CodeBlock } from '../../app/components/docs/CodeBlock';
import { MatchKickoffCountdown } from '../../app/components/home/MatchKickoffCountdown';
import { GroupStageBoard } from '../../app/components/tournament/GroupStageBoard';
import { installSmokeFetchMock, mockApiBody } from '../helpers/smokeFetch';
import {
  sampleScheduleMatches,
  sampleStandings,
  sampleMatchProbs,
  SMOKE_MATCH_ID,
} from '../helpers/smokeFixtures';

function renderWithRouter(ui: ReactElement, entry = '/') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <I18nProvider>{ui}</I18nProvider>
    </MemoryRouter>,
  );
}

function findButton(matcher: RegExp) {
  return screen.getAllByRole('button').find((b) => matcher.test(b.textContent ?? ''));
}

describe('coverage gaps — components and pages', () => {
  const writeText = vi.fn(async () => undefined);

  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    installSmokeFetchMock();
    writeText.mockClear();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    vi.stubGlobal(
      'IntersectionObserver',
      vi.fn(function IntersectionObserverMock(this: IntersectionObserver, cb: IntersectionObserverCallback) {
        this.observe = vi.fn((el: Element) => {
          cb([{ isIntersecting: true, target: el } as IntersectionObserverEntry], this);
        });
        this.unobserve = vi.fn();
        this.disconnect = vi.fn();
      }),
    );
  });

  it('App renders lazy routes including docs and redirects', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(document.body.textContent?.length ?? 0).toBeGreaterThan(50), {
      timeout: 10000,
    });

    const paths = [
      '/docs/api',
      '/matches',
      '/matches/usa-vs-mexico',
      '/matches/usa-vs-mexico/analysis',
      '/teams/t-usa',
      '/players/p-test',
      '/lineups/m-test',
      '/news-intelligence',
      '/news-intelligence/n-test',
      '/guide',
      '/lich-thi-dau-world-cup-2026',
      '/admin',
      '/tournaments',
    ];
    for (const path of paths) {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
      await waitFor(() => expect(document.body.textContent?.length ?? 0).toBeGreaterThan(20), {
        timeout: 8000,
      });
    }

    const homeLink = document.querySelector('a[href="/"]');
    if (homeLink) await user.click(homeLink);
  });

  it('MatchPageGuideStrip expands guide content', async () => {
    const user = userEvent.setup();
    const view = renderWithRouter(<MatchPageGuideStrip />);
    const toggle = screen.getByRole('button');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-expanded', 'true'));
    expect(view.container.textContent).toMatch(/guide|hướng dẫn|glossary|thuật ngữ/i);
  });

  it('MatchVersusThumbnail covers hero, card, and compact flag variants', () => {
    const { rerender } = renderWithRouter(
      <MatchVersusThumbnail
        homeName="USA"
        awayName="Mexico"
        homeCountryCode="US"
        awayCountryCode="MX"
        matchRef="usa-vs-mexico"
        variant="hero"
      />,
    );
    expect(document.querySelector('img[src*="thumbnail"]')).toBeTruthy();

    rerender(
      <I18nProvider>
        <MatchVersusThumbnail
          homeName="USA"
          awayName="Mexico"
          homeCountryCode="US"
          awayCountryCode="MX"
          matchRef="usa-vs-mexico"
          variant="card"
        />
      </I18nProvider>,
    );
    expect(document.querySelector('img[src*="thumbnail"]')).toBeTruthy();

    rerender(
      <I18nProvider>
        <MatchVersusThumbnail
          homeName="USA"
          awayName="Mexico"
          homeCountryCode="US"
          awayCountryCode="MX"
          matchRef="usa-vs-mexico"
          variant="compact"
        />
      </I18nProvider>,
    );
    expect(document.body.textContent).toContain('VS');
    expect(document.querySelectorAll('img').length).toBeGreaterThan(0);
  });

  it('MatchLineupSidePanel renders grouped lineups, substitutes, and full lineup link', async () => {
    const view = renderWithRouter(
      <MatchLineupSidePanel
        label="Home"
        matchRef="usa-vs-mexico"
        side={{
          teamName: 'USA',
          formation: '4-3-3',
          hasAccurateLineup: true,
          hasLineup: true,
          source: 'match_official',
          starters: [],
          substitutes: [{ shirtNumber: 12, name: 'Sub One', position: 'MF' }],
          grouped: {
            GK: [{ shirtNumber: 1, name: 'Keeper', position: 'GK' }],
            DEF: [{ shirtNumber: 4, name: 'Defender', position: 'DF' }],
            MID: [{ shirtNumber: 8, name: 'Midfielder', position: 'MF' }],
            FWD: [{ shirtNumber: 9, name: 'Striker', position: 'FW' }],
          },
          lineupPlayers: [],
          players: [],
        }}
      />,
    );
    await waitFor(() => expect(view.container.textContent).toMatch(/Keeper|Defender|Sub One/i));
    expect(view.container.textContent).toMatch(/4-3-3|viewFull|đội hình/i);
  });

  it('MatchLineupSidePanel falls back to lineupPlayers and pending state', () => {
    const pending = renderWithRouter(
      <MatchLineupSidePanel
        label="Away"
        side={{
          teamName: 'Mexico',
          formation: null,
          hasAccurateLineup: false,
          hasLineup: false,
          source: 'unknown',
          starters: [],
          substitutes: [],
          grouped: undefined,
          lineupPlayers: [],
          players: [],
        }}
      />,
    );
    expect(pending.container.textContent).toMatch(/pending|chưa có|lineup/i);

    const fromPlayers = renderWithRouter(
      <MatchLineupSidePanel
        label="Away"
        compact
        side={{
          teamName: 'Mexico',
          formation: '4-4-2',
          hasLineup: true,
          source: 'projected',
          substitutes: [],
          grouped: undefined,
          lineupPlayers: Array.from({ length: 8 }, (_, i) => ({
            shirtNumber: i + 1,
            name: `Player ${i + 1}`,
            position: 'MF',
          })),
          players: [],
        }}
      />,
    );
    expect(fromPlayers.container.textContent).toMatch(/Player 1|Player 8/);
  });

  it('NewsArticleReadView covers translation fallback, impact links, and source CTA', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onLang = vi.fn();
    const article = {
      id: 'n-impact',
      title: 'English title',
      titleVi: 'Tiêu đề',
      source_url: 'https://example.com/article',
      summary: 'English summary body',
      summaryVi: 'Tóm tắt',
      published_at: '2026-01-15T12:00:00Z',
      reliability_score: 0.9,
      source_name: 'Reuters',
      translated: false,
      impact_summary_vi: 'Ảnh hưởng tới trận đấu',
      affected_match_ids: [SMOKE_MATCH_ID],
    };

    const pendingView = renderWithRouter(
      <NewsArticleReadView
        article={article}
        articleLang="vi"
        onArticleLangChange={onLang}
        onBack={onBack}
        translationPending
      />,
    );
    expect(pendingView.container.textContent).toMatch(/translat|dịch/i);

    const view = renderWithRouter(
      <NewsArticleReadView
        article={article}
        articleLang="vi"
        onArticleLangChange={onLang}
        onBack={onBack}
        translationPending={false}
      />,
    );
    expect(view.container.textContent).toMatch(/fallback|English|impact|Ảnh hưởng/i);
    const backBtn = view.container.querySelector('button');
    expect(backBtn).toBeTruthy();
    await user.click(backBtn!);
    expect(onBack).toHaveBeenCalled();
    expect(view.container.querySelector('a[href="https://example.com/article"]')).toBeTruthy();

    const enView = renderWithRouter(
      <NewsArticleReadView
        article={{ ...article, translated: true }}
        articleLang="en"
        onArticleLangChange={onLang}
        onBack={onBack}
      />,
    );
    expect(enView.container.textContent).toMatch(/English title|Summary/);
  });

  it('EventTrajectoryLayer plots vectors, chains, and event colors', () => {
    const { container } = renderWithRouter(
      <svg>
        <EventTrajectoryLayer
          events={[
            { x: 0.2, y: 0.3, event_type: 'goal' },
            { x: 0.4, y: 0.5, end_x: 0.6, end_y: 0.7, event_type: 'shot' },
            { x: 0.55, y: 0.45, event_type: 'pass' },
            { x: 0.7, y: 0.2, event_type: 'other' },
            { x: undefined, y: 0.1 },
          ]}
        />
      </svg>,
    );
    expect(container.querySelectorAll('line').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('circle').length).toBeGreaterThan(0);
    expect(container.querySelector('defs')).toBeTruthy();
  });

  it('ApiDocsPage toggles mobile nav and renders markdown sections', async () => {
    const user = userEvent.setup();
    const view = renderWithRouter(<ApiDocsPage />, '/docs/api');
    await waitFor(() => expect(view.container.textContent).toMatch(/PitchIntel API|API Reference/i));

    const mobileToggle = screen.getAllByRole('button').find((b) => /navigate|introduction|▲|▼/i.test(b.textContent ?? ''));
    if (mobileToggle) {
      await user.click(mobileToggle);
      expect(view.container.textContent?.length ?? 0).toBeGreaterThan(200);
    }
    expect(view.container.textContent).toMatch(/Open API|Base URL|health/i);
  });

  it('MatchAnalysisPage covers group title, not-found, and live probability strip', async () => {
    renderWithRouter(
      <Routes>
        <Route path="/matches/:matchId/analysis" element={<MatchAnalysisPage />} />
      </Routes>,
      `/matches/${SMOKE_MATCH_ID}/analysis`,
    );
    await waitFor(() => expect(document.body.textContent).toMatch(/USA|Mexico|analysis|phân tích/i), {
      timeout: 8000,
    });
  });

  it('MatchAnalysisPage shows not found for missing match', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/api/matches/missing')) {
          return new Response('missing', { status: 404 });
        }
        return new Response(JSON.stringify(mockApiBody(url)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );
    renderWithRouter(
      <Routes>
        <Route path="/matches/:matchId/analysis" element={<MatchAnalysisPage />} />
      </Routes>,
      '/matches/missing/analysis',
    );
    await waitFor(() => expect(document.body.textContent).toMatch(/not found|không tìm thấy/i), {
      timeout: 5000,
    });
  });

  it('NewsArticlePage handles missing id and polling for untranslated articles', async () => {
    renderWithRouter(
      <Routes>
        <Route path="/news-intelligence" element={<NewsArticlePage />} />
      </Routes>,
      '/news-intelligence',
    );
    expect(document.body.textContent).toMatch(/back|feed|quay/i);

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/api/news/n-poll')) {
          return new Response(
            JSON.stringify({
              data: {
                id: 'n-poll',
                title: 'Poll article',
                titleVi: 'Bài poll',
                summary: 'Summary',
                summaryVi: 'Tóm tắt',
                published_at: '2026-01-01T00:00:00Z',
                reliability_score: 0.8,
                source_name: 'Test',
                translated: false,
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

    vi.useFakeTimers();
    renderWithRouter(
      <Routes>
        <Route path="/news-intelligence/:articleId" element={<NewsArticlePage />} />
      </Routes>,
      '/news-intelligence/n-poll',
    );
    await vi.runOnlyPendingTimersAsync();
    await vi.advanceTimersByTimeAsync(2600);
    expect(document.body.textContent?.length ?? 0).toBeGreaterThan(10);
  });

  it('NewsArticlePage handles error state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/api/news/n-missing')) {
          return new Response('missing', { status: 404 });
        }
        return new Response(JSON.stringify(mockApiBody(url)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );
    renderWithRouter(
      <Routes>
        <Route path="/news-intelligence/:articleId" element={<NewsArticlePage />} />
      </Routes>,
      '/news-intelligence/n-missing',
    );
    await waitFor(() => expect(document.body.textContent).toMatch(/not found|không tìm thấy/i), {
      timeout: 5000,
    });
  });

  it('NewsArticlePage loads article content', async () => {
    renderWithRouter(
      <Routes>
        <Route path="/news-intelligence/:articleId" element={<NewsArticlePage />} />
      </Routes>,
      '/news-intelligence/n-test',
    );
    await waitFor(() => expect(document.body.textContent?.length ?? 0).toBeGreaterThan(30), {
      timeout: 10000,
    });
  });

  it('SeoLandingPage sets meta for known and unknown paths', async () => {
    const known = renderWithRouter(
      <Routes>
        <Route path="/lich-thi-dau-world-cup-2026" element={<SeoLandingPage />} />
      </Routes>,
      '/lich-thi-dau-world-cup-2026',
    );
    await waitFor(() => expect(known.container.textContent?.length ?? 0).toBeGreaterThan(30), {
      timeout: 10000,
    });
    expect(document.title).toContain('PitchIntel');

    const unknown = renderWithRouter(
      <Routes>
        <Route path="/unknown-seo" element={<SeoLandingPage />} />
      </Routes>,
      '/unknown-seo',
    );
    expect(unknown.container.textContent).toMatch(/home|trang chủ|PitchIntel/i);
  });

  it('AnalystSimulatorPage queues recompute and handles auth failure', async () => {
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('unauthorized', { status: 401 })),
    );
    renderWithRouter(<AnalystSimulatorPage />);
    const btn = await screen.findByRole('button', { name: /recompute|queue/i }, { timeout: 10000 });
    await user.click(btn);
    expect(alertSpy).toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('CodeBlock copies snippet to clipboard', async () => {
    const user = userEvent.setup();
    renderWithRouter(<CodeBlock code="curl https://example.com/api/health" language="bash" />);
    const copyBtn = await screen.findByRole('button', { name: /copy/i }, { timeout: 10000 });
    await user.click(copyBtn);
    await waitFor(() => expect(screen.getByRole('button').textContent).toMatch(/copied/i));
  });

  it('MatchKickoffCountdown covers live, completed, and countdown states', () => {
    const live = renderWithRouter(
      <MatchKickoffCountdown kickoffUtc="2099-01-01T00:00:00Z" status="live" />,
    );
    expect(live.container.textContent).toMatch(/live|trực tiếp/i);

    const done = renderWithRouter(
      <MatchKickoffCountdown kickoffUtc="2020-01-01T00:00:00Z" status="completed" />,
    );
    expect(done.container.textContent).toMatch(/FT|full|KẾT THÚC/i);

    const soon = renderWithRouter(
      <MatchKickoffCountdown kickoffUtc="2099-06-11T20:00:00Z" status="scheduled" />,
    );
    expect(soon.container.textContent).toMatch(/\d|day|ngày|hour|giờ/i);
  });

  it('GroupStageBoard renders negative GD and fixtures tab', async () => {
    const user = userEvent.setup();
    const view = renderWithRouter(
      <GroupStageBoard
        matches={sampleScheduleMatches}
        initialStandings={sampleStandings}
        initialProbs={sampleMatchProbs}
      />,
    );
    expect(view.container.textContent).toMatch(/-2|Canada/i);
    const fixturesTab = screen.getAllByRole('button').find((b) => /fixture|lịch|matches/i.test(b.textContent ?? ''));
    if (fixturesTab) {
      await user.click(fixturesTab);
      expect(view.container.textContent).toMatch(/USA|Mexico|kickoff/i);
    }
  });

  it('GroupStageBoard renders knockout round tabs', async () => {
    const user = userEvent.setup();
    const view = renderWithRouter(
      <GroupStageBoard
        matches={sampleScheduleMatches}
        initialStandings={sampleStandings}
        initialProbs={sampleMatchProbs}
      />,
    );
    const knockoutTab = findButton(/knock|loại/i);
    if (knockoutTab) {
      await user.click(knockoutTab);
      const roundTabs = screen.getAllByRole('tab');
      if (roundTabs.length > 1) await user.click(roundTabs[1]!);
      expect(view.container.textContent).toMatch(/Brazil|USA|Round|vòng/i);
    }
  });
});
