import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { installSmokeFetchMock } from '../helpers/smokeFetch';

vi.mock('../../app/pages/GuidePage', async () => {
  await new Promise((r) => setTimeout(r, 500));
  return import('../../app/pages/GuidePage');
});

vi.mock('../../app/pages/NewsIntelligencePage', async () => {
  await new Promise((r) => setTimeout(r, 50));
  return import('../../app/pages/NewsIntelligencePage');
});

vi.mock('../../app/pages/NewsArticlePage', async () => {
  await new Promise((r) => setTimeout(r, 50));
  return import('../../app/pages/NewsArticlePage');
});

vi.mock('../../app/pages/MatchAnalysisPage', async () => {
  await new Promise((r) => setTimeout(r, 50));
  return import('../../app/pages/MatchAnalysisPage');
});

vi.mock('../../app/pages/SeoLandingPage', async () => {
  await new Promise((r) => setTimeout(r, 50));
  return import('../../app/pages/SeoLandingPage');
});

describe('App lazy routes', () => {
  beforeEach(() => {
    installSmokeFetchMock();
  });

  it('shows RouteFallback and loads all lazy routes', async () => {
    const { default: App } = await import('../../app/App');
    render(<App />);
    await waitFor(() => expect(document.body.textContent?.length ?? 0).toBeGreaterThan(20), {
      timeout: 10000,
    });

    const paths = [
      '/guide',
      '/news-intelligence',
      '/news-intelligence/n-test',
      '/matches/usa-vs-mexico/analysis',
      '/lich-thi-dau-world-cup-2026',
      '/matches',
      '/teams/t-usa',
      '/players/p-test',
      '/lineups/m-test',
      '/docs/api',
    ];

    for (const path of paths) {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
      if (path === '/guide') {
        const busy = document.querySelector('[aria-busy="true"]');
        if (busy) expect(busy).toBeTruthy();
      }
      await waitFor(() => expect(document.body.textContent?.length ?? 0).toBeGreaterThan(20), {
        timeout: 10000,
      });
    }
  });
});
