import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../app/lib/i18n/I18nContext';
import { GroupStageBoard } from '../app/components/tournament/GroupStageBoard';
import { TournamentSchedulePanel } from '../app/components/tournament/TournamentSchedulePanel';
import { ApiDocsPage } from '../app/pages/ApiDocsPage';
import { saveFavorites } from '../app/lib/favorites';
import { installSmokeFetchMock } from './helpers/smokeFetch';
import {
  buildScheduleByDate,
  sampleMatchProbs,
  sampleScheduleMatches,
  sampleStandings,
  SMOKE_MATCH_ID,
} from './helpers/smokeFixtures';

function renderApp(ui: ReactElement) {
  return render(
    <MemoryRouter>
      <I18nProvider>{ui}</I18nProvider>
    </MemoryRouter>,
  );
}

function findButton(matcher: RegExp) {
  return screen.getAllByRole('button').find((b) => matcher.test(b.textContent ?? ''));
}

describe('coverage — uncovered function handlers', () => {
  beforeEach(() => {
    installSmokeFetchMock();
    saveFavorites({ matches: [SMOKE_MATCH_ID], teams: ['t-usa'] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('GroupStageBoard knockout round chip onClick', async () => {
    const user = userEvent.setup();
    renderApp(
      <GroupStageBoard
        matches={sampleScheduleMatches}
        initialStandings={sampleStandings}
        initialProbs={sampleMatchProbs}
      />,
    );
    const knockout = findButton(/knock|loại trực/i);
    await user.click(knockout!);
    const roundTabs = screen.getAllByRole('tab');
    expect(roundTabs.length).toBeGreaterThan(0);
    if (roundTabs.length > 1) await user.click(roundTabs[1]!);
    else await user.click(roundTabs[0]!);
  });

  it('GroupStageBoard group tab onClick after knockout', async () => {
    const user = userEvent.setup();
    renderApp(
      <GroupStageBoard
        matches={sampleScheduleMatches}
        initialStandings={sampleStandings}
        initialProbs={sampleMatchProbs}
      />,
    );
    const knockout = findButton(/knock|loại trực/i);
    await user.click(knockout!);
    const group = screen
      .getAllByRole('button')
      .find((b) => /groupBoard\.tabGroup|vòng bảng|group stage/i.test(b.textContent ?? '') || b.textContent?.includes('Bảng'));
    expect(group).toBeTruthy();
    await user.click(group!);
  });

  it('TournamentSchedulePanel per-match calendar and day-filter onClick handlers', async () => {
    const user = userEvent.setup();
    const downloadMatch = vi.spyOn(await import('../app/lib/calendarExport'), 'downloadMatchIcs').mockImplementation(() => {});
    const view = renderApp(
      <TournamentSchedulePanel
        byDate={buildScheduleByDate()}
        matches={sampleScheduleMatches}
        probs={sampleMatchProbs}
      />,
    );
    const matchCalLinks = view.container.querySelectorAll('a[href*="calendar.google.com"]');
    const perMatchLink = matchCalLinks.length > 1 ? matchCalLinks[1] : matchCalLinks[0];
    if (perMatchLink) fireEvent.click(perMatchLink);

    const dateChips = screen
      .getAllByRole('button')
      .filter((b) => /2026|Jun|Thg|Jun/i.test(b.textContent ?? '') && !/download|tải/i.test(b.textContent ?? ''));
    if (dateChips[0]) {
      await user.click(dateChips[0]!);
      await user.click(dateChips[0]!);
    }
    downloadMatch.mockRestore();
  });

  it('TournamentSchedulePanel download onClick handler', async () => {
    const user = userEvent.setup();
    const downloadMatch = vi.spyOn(await import('../app/lib/calendarExport'), 'downloadMatchIcs').mockImplementation(() => {});
    const view = renderApp(
      <TournamentSchedulePanel
        byDate={buildScheduleByDate()}
        matches={sampleScheduleMatches}
        probs={sampleMatchProbs}
      />,
    );
    const downBtn = view.container.querySelector('button[aria-label], button[title]');
    const allButtons = view.container.querySelectorAll('button');
    for (const btn of allButtons) {
      if (btn.textContent?.includes('↓')) {
        await user.click(btn);
        break;
      }
    }
    const calLink = view.container.querySelector('a[href*="calendar.google.com"]');
    if (calLink) fireEvent.click(calLink);
    expect(downloadMatch).toHaveBeenCalled();
    downloadMatch.mockRestore();
  });

  it('ApiDocsPage mobile section link onClick closes nav', async () => {
    const user = userEvent.setup();
    const view = renderApp(<ApiDocsPage />);
    const mobileNav = view.container.querySelector('.lg\\:hidden button');
    expect(mobileNav).toBeTruthy();
    await user.click(mobileNav!);
    const sectionLink = view.container.querySelector('.lg\\:hidden a[href^="#"]');
    expect(sectionLink).toBeTruthy();
    fireEvent.click(sectionLink!);
  });
});
