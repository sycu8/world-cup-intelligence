import { useState } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HomeNewsPreview } from '../app/components/home/HomeNewsPreview';
import { I18nProvider } from '../app/lib/i18n/I18nContext';
import { api, type NewsArticle } from '../app/lib/api';

vi.mock('../app/lib/api', () => ({
  api: {
    news: vi.fn(),
  },
}));

const article = {
  id: 'doc-1',
  title: 'Lời bài hát trận đấu',
  titleVi: 'Lời bài hát trận đấu',
  titleEn: 'Match of the day',
  source_url: 'https://example.com/story',
  summary: 'Tóm tắt trận',
  summaryVi: 'Tóm tắt trận',
  summaryEn: 'Match summary',
  published_at: '2026-10-18T00:00:00.000Z',
  reliability_score: 0.8,
  source_name: 'BBC',
  translated: true,
} satisfies NewsArticle;

function renderPreview() {
  function Harness() {
    const [tick, setTick] = useState(0);
    return (
      <>
        <button type="button" onClick={() => setTick(tick + 1)}>
          rerender {tick}
        </button>
        <HomeNewsPreview />
      </>
    );
  }
  return render(
    <I18nProvider>
      <MemoryRouter>
        <Harness />
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe('HomeNewsPreview', () => {
  beforeEach(() => {
    vi.mocked(api.news).mockReset();
  });

  it('keeps loaded stories after the parent re-renders', async () => {
    vi.mocked(api.news).mockResolvedValue({
      data: { hot: [article], articles: [] },
      meta: {
        page: 1,
        pageSize: 6,
        total: 1,
        totalPages: 1,
        hotCount: 1,
        lastCrawl: null,
        crawlIntervalSec: 900,
      },
    });
    renderPreview();
    expect(await screen.findByText('Lời bài hát trận đấu')).toBeTruthy();
    expect(screen.getByText('Nổi bật')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /rerender/i }));
    expect(screen.getByText('Lời bài hát trận đấu')).toBeTruthy();
  });

  it('shows latest articles when the hot list is empty', async () => {
    vi.mocked(api.news).mockResolvedValue({
      data: { hot: [], articles: [article] },
      meta: {
        page: 1,
        pageSize: 6,
        total: 1,
        totalPages: 1,
        hotCount: 0,
        lastCrawl: null,
        crawlIntervalSec: 900,
      },
    });
    renderPreview();
    expect(await screen.findByText('Lời bài hát trận đấu')).toBeTruthy();
    expect(screen.queryByText('Nổi bật')).toBeNull();
  });

  it('shows an empty state when news cannot be loaded', async () => {
    vi.mocked(api.news).mockResolvedValue({
      data: { hot: [], articles: [] },
      meta: {
        page: 1,
        pageSize: 6,
        total: 0,
        totalPages: 1,
        hotCount: 0,
        lastCrawl: null,
        crawlIntervalSec: 900,
      },
    });
    renderPreview();
    expect(await screen.findByText(/Chưa có tin/)).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByRole('list')).toBeNull();
    });
  });
});
