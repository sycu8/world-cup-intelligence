import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MatchesPage } from '../app/pages/MatchesPage';
import { I18nProvider } from '../app/lib/i18n/I18nContext';

vi.mock('../app/lib/api', () => ({
  api: {
    schedule: vi.fn(async () => ({
      data: { byDate: {}, matches: [], tournamentId: 't-2026', total: 0 },
    })),
    teams: vi.fn(async () => ({ data: [] })),
    tournamentMatchProbabilities: vi.fn(async () => ({ data: {} })),
  },
}));

function LocationProbe({ onChange }: { onChange: (search: string) => void }) {
  const { search } = useLocation();
  onChange(search);
  return null;
}

function renderMatches(initial: string, onLocation?: (search: string) => void) {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={[initial]}>
        {onLocation ? <LocationProbe onChange={onLocation} /> : null}
        <Routes>
          <Route path="/matches" element={<MatchesPage />} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe('MatchesPage hub tabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens standings tab from ?tab=standings query', async () => {
    renderMatches('/matches?tab=standings');
    const standingsBtn = await screen.findByRole('button', { name: /standings|bảng xếp hạng/i });
    await waitFor(() => {
      expect(standingsBtn.className).toContain('border-pressing');
    });
  });

  it('updates URL when switching to favorites tab', async () => {
    const user = userEvent.setup();
    let search = '';
    renderMatches('/matches', (s) => {
      search = s;
    });
    const favBtn = await screen.findByRole('button', { name: /favorites|yêu thích/i });
    await user.click(favBtn);
    await waitFor(() => {
      expect(search).toContain('tab=favorites');
    });
  });
});
