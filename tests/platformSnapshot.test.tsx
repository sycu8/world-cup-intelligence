import { beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { I18nProvider } from '../app/lib/i18n/I18nContext';
import { PlatformSnapshot } from '../app/components/home/PlatformSnapshot';
import type { DashboardData } from '../app/lib/api';

function renderSnapshot(dashboard: DashboardData | null, compact = false) {
  return render(
    <I18nProvider>
      <PlatformSnapshot dashboard={dashboard} compact={compact} />
    </I18nProvider>,
  );
}

const baseDashboard: DashboardData = {
  featuredMatch: null,
  matchCount: 12,
  lastDataRefresh: '2026-06-11T19:00:00Z',
  lastNewsCrawl: '2026-06-11T18:00:00Z',
  refreshIntervalSec: 60,
  newsCrawlIntervalSec: 300,
  expectedMatches: 104,
  hostCountries: ['Canada', 'Mexico', 'United States'],
  teamsCount: 48,
  groupCount: 12,
  statusCounts: {
    scheduled: 3,
    live: 2,
    completed: 4,
    finished: 1,
  },
};

describe('PlatformSnapshot', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = 'vi';
  });

  it('returns nothing when dashboard is unavailable', () => {
    const view = renderSnapshot(null);
    expect(view.container.firstChild).toBeNull();
  });

  it('renders Vietnamese defaults and compact layout fallbacks', () => {
    const view = renderSnapshot(
      {
        ...baseDashboard,
        expectedMatches: undefined,
        hostCountries: undefined,
        teamsCount: undefined,
        groupCount: undefined,
        lastDataRefresh: null,
        lastNewsCrawl: null,
        statusCounts: { scheduled: 0, live: 0, completed: 0, finished: 0 },
      },
      true,
    );
    expect(view.container.textContent).toContain('—');
    expect(view.container.textContent).toContain('12/104');
    expect(view.container.textContent).toContain('12');
    expect(view.container.textContent).toContain('48');
    expect(view.container.textContent).toContain('0');
    expect(view.container.querySelector('section')?.className).toContain('flex flex-1');
    expect(view.container.textContent).not.toContain('Dữ liệu:');
    expect(view.container.textContent).not.toContain('Tin tức:');
  });

  it('renders English host separators, totals, and refresh timestamps', () => {
    localStorage.setItem('wc-display-mode', 'en');
    const view = renderSnapshot(baseDashboard, false);
    expect(view.container.textContent).toContain('Canada, Mexico, United States');
    expect(view.container.textContent).toContain('12/104');
    expect(view.container.textContent).toContain('5');
    expect(view.container.textContent).toContain('Data:');
    expect(view.container.textContent).toContain('News:');
    expect(view.container.querySelector('section')?.className).toContain('sm:grid-cols-2');
  });
});
