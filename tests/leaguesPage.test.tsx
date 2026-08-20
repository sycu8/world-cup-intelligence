import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LeaguesPage } from '../app/pages/LeaguesPage';
import { LeagueHubPage } from '../app/pages/LeagueHubPage';
import { I18nProvider } from '../app/lib/i18n/I18nContext';
import { sampleLeagueCatalog, sampleLeagueHub } from './helpers/smokeFixtures';

vi.mock('../app/lib/api', () => ({
  api: {
    leagues: vi.fn(async () => ({ data: sampleLeagueCatalog })),
    league: vi.fn(async () => ({ data: sampleLeagueHub })),
  },
}));

function renderAt(path: string) {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/leagues" element={<LeaguesPage />} />
          <Route path="/leagues/:slug" element={<LeagueHubPage />} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe('league picker and hub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders regional league cards for selection', async () => {
    renderAt('/leagues');
    expect(await screen.findByRole('heading', { name: /chọn giải đấu|choose a league/i })).toBeTruthy();
    expect(await screen.findByRole('link', { name: /la liga/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /v\.league/i })).toBeTruthy();
  });

  it('opens a league hub with standings and live tabs', async () => {
    const user = userEvent.setup();
    renderAt('/leagues/la-liga');
    expect(await screen.findByRole('heading', { name: /la liga/i })).toBeTruthy();
    expect(screen.getAllByText(/real madrid/i).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: /bảng|table/i }));
    await waitFor(() => {
      expect(screen.getByText('22')).toBeTruthy();
    });
  });
});
