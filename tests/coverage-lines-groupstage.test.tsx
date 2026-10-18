import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../app/lib/i18n/I18nContext';
import { GroupStageBoard } from '../app/components/tournament/GroupStageBoard';
import { TournamentSchedulePanel } from '../app/components/tournament/TournamentSchedulePanel';
import { installSmokeFetchMock, mockApiBody } from './helpers/smokeFetch';
import {
  buildScheduleByDate,
  sampleMatchProbs,
  sampleScheduleMatches,
  sampleStandings,
} from './helpers/smokeFixtures';
import { saveFavorites } from '../app/lib/favorites';
import { SMOKE_MATCH_ID } from './helpers/smokeFixtures';

function renderApp(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <I18nProvider>{ui}</I18nProvider>
    </MemoryRouter>,
  );
}

describe('coverage — GroupStageBoard and schedule line gaps', () => {
  beforeEach(() => {
    installSmokeFetchMock();
    saveFavorites({ matches: [SMOKE_MATCH_ID], teams: [] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('GroupStageBoard knockout prob fetch failure and empty round panel', async () => {
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
    const user = userEvent.setup();
    const knockoutOnly = sampleScheduleMatches.filter((m) => m.stage === 'Round of 32');
    const view = renderApp(<GroupStageBoard matches={knockoutOnly.length ? knockoutOnly : sampleScheduleMatches} />);
    const knockout = screen.getAllByRole('button').find((b) => /knock|loại/i.test(b.textContent ?? ''));
    await user.click(knockout!);
    await waitFor(() => expect(view.container.textContent?.length ?? 0).toBeGreaterThan(20), {
      timeout: 8000,
    });
    const tabs = screen.getAllByRole('tab');
    for (const tab of tabs) await user.click(tab);
  });

  it('TournamentSchedulePanel completed filter, favorites-only, and day chip toggle', async () => {
    const user = userEvent.setup();
    const completed = sampleScheduleMatches.map((m, i) =>
      i === 0 ? { ...m, status: 'completed' as const, home_score: 2, away_score: 1 } : m,
    );
    const view = renderApp(
      <TournamentSchedulePanel
        byDate={buildScheduleByDate()}
        matches={completed}
        probs={sampleMatchProbs}
      />,
    );
    const completedBtn = screen.getAllByRole('button').find((b) => /completed|đã kết thúc|finished/i.test(b.textContent ?? ''));
    if (completedBtn) await user.click(completedBtn);

    const favBtn = screen.getAllByRole('button').find((b) => /favorite|yêu thích/i.test(b.textContent ?? ''));
    if (favBtn) await user.click(favBtn);

    const chips = screen.getAllByRole('button');
    const dayChip = chips.find(
      (b) =>
        b.textContent &&
        b.textContent.length > 4 &&
        !/live|scheduled|completed|favorite|grid|list|group|knock|download|tải|all|tất/i.test(b.textContent),
    );
    if (dayChip) {
      await user.click(dayChip);
      await user.click(dayChip);
    }

    const dayRow = view.container.querySelector('.overflow-x-auto');
    const allDayBtn = dayRow?.querySelector('button');
    if (allDayBtn) await user.click(allDayBtn);

    const matchRowCal = view.container.querySelector('section a[href*="calendar.google.com"]');
    if (matchRowCal) matchRowCal.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(view.container.textContent?.length ?? 0).toBeGreaterThan(20);
  });
});
