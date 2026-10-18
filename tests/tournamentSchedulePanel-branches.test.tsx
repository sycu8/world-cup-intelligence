import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../app/lib/i18n/I18nContext';
import { TournamentSchedulePanel } from '../app/components/tournament/TournamentSchedulePanel';
import type { ScheduleMatch } from '../app/lib/api';

function renderPanel(matches: ScheduleMatch[]) {
  return render(
    <MemoryRouter>
      <I18nProvider>
        <TournamentSchedulePanel byDate={{ '2026-06-11': matches }} matches={matches} probs={{}} />
      </I18nProvider>
    </MemoryRouter>,
  );
}

const baseMatches: ScheduleMatch[] = [
  {
    id: 'm-finished',
    slug: 'usa-vs-mexico',
    kickoff_utc: '2026-06-11T19:00:00Z',
    tournament_id: 't-2026',
    stage: 'Group',
    group_code: 'A',
    status: 'finished',
    minute: 90,
    home_score: 2,
    away_score: 1,
    home_team_id: 'team-usa',
    away_team_id: 'team-mex',
    home_name: 'United States',
    away_name: 'Mexico',
    home_short: 'USA',
    away_short: 'MEX',
    home_country_code: 'USA',
    away_country_code: 'MEX',
  },
  {
    id: 'm-null-fields',
    slug: 'canada-vs-japan',
    kickoff_utc: '2026-06-12T19:00:00Z',
    tournament_id: 't-2026',
    stage: null,
    group_code: null,
    status: 'scheduled',
    minute: 0,
    home_score: 0,
    away_score: 0,
    home_team_id: 'team-can',
    away_team_id: 'team-jpn',
    home_name: 'Canada',
    away_name: 'Japan',
    home_short: null,
    away_short: null,
    home_country_code: 'CAN',
    away_country_code: 'JPN',
  },
];

describe('TournamentSchedulePanel branch coverage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('uses English separators in both grid and list views and tolerates null search fields', async () => {
    localStorage.setItem('wc-display-mode', 'en');
    const user = userEvent.setup();
    const view = renderPanel(baseMatches);
    expect(view.container.textContent).toContain('USAvsMEX');

    const search = screen.getByRole('searchbox');
    await user.type(search, 'canada');
    expect(view.container.textContent).toContain('CanadavsJapan');

    const listButton = screen.getAllByRole('button').find((button) => /list/i.test(button.textContent ?? ''));
    expect(listButton).toBeTruthy();
    await user.click(listButton!);
    expect(view.container.textContent).toContain('CanadavsJapan');
  });

  it('toggles the completed filter back to all results on second click', async () => {
    localStorage.setItem('wc-display-mode', 'en');
    const user = userEvent.setup();
    const view = renderPanel(baseMatches);
    const completedButton = screen
      .getAllByRole('button')
      .find((button) => /completed|finished/i.test(button.textContent ?? ''));
    expect(completedButton).toBeTruthy();

    await user.click(completedButton!);
    expect(view.container.textContent).toContain('USAvsMEX');
    expect(view.container.textContent).not.toContain('CanadavsJapan');

    await user.click(completedButton!);
    expect(view.container.textContent).toContain('CanadavsJapan');
  });
});
