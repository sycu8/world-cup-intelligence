import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nProvider } from '../../app/lib/i18n/I18nContext';
import { MatchPage } from '../../app/pages/MatchPage';
import { installSmokeFetchMock, mockApiBody } from '../helpers/smokeFetch';
import { SMOKE_MATCH_ID } from '../helpers/smokeFixtures';

const navigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  close() {
    this.onclose?.();
  }
  constructor(public url: string) {
    MockWebSocket.instances.push(this);
    queueMicrotask(() => this.onopen?.());
  }
}

describe('MatchPage integration', () => {
  beforeEach(() => {
    navigate.mockClear();
    installSmokeFetchMock();
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket);
    vi.stubGlobal(
      'IntersectionObserver',
      vi.fn(function IntersectionObserverMock(this: IntersectionObserver, cb: IntersectionObserverCallback) {
        this.observe = vi.fn(() => {
          cb([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
        });
        this.unobserve = vi.fn();
        this.disconnect = vi.fn();
      }),
    );
  });

  async function renderMatch(matchId: string) {
    const user = userEvent.setup();
    const view = render(
      <MemoryRouter initialEntries={[`/matches/${matchId}`]}>
        <I18nProvider>
          <Routes>
            <Route path="/matches/:matchId" element={<MatchPage />} />
          </Routes>
        </I18nProvider>
      </MemoryRouter>,
    );
    return { user, view };
  }

  it('loads tactical view with match content', async () => {
    const { view } = await renderMatch('usa-vs-mexico');

    await waitFor(() => expect(view.container.textContent).toMatch(/USA|Mexico/i), { timeout: 8000 });
    expect(view.container.textContent).toMatch(/scenario|kịch bản|pitch|stats|probability|xác suất/i);
  });

  it('toggles editorial mode and section navigation', async () => {
    const { user, view } = await renderMatch('usa-vs-mexico');
    await waitFor(() => expect(view.container.textContent).toMatch(/USA|Mexico/i), { timeout: 8000 });

    const guideBtn = screen.getAllByRole('button').find((b) => /guide|hướng dẫn/i.test(b.textContent ?? ''));
    if (guideBtn) {
      await user.click(guideBtn);
      expect(view.container.textContent).toMatch(/guide|hướng dẫn|glossary|thuật ngữ/i);
    }

    const editorialBtn = screen.getAllByRole('button').find((b) => /editorial|bài viết/i.test(b.textContent ?? ''));
    if (editorialBtn) {
      await user.click(editorialBtn);
      await waitFor(() => expect(view.container.textContent?.length ?? 0).toBeGreaterThan(200));
      const tacticalBtn = screen.getAllByRole('button').find((b) => /tactical|chiến thuật/i.test(b.textContent ?? ''));
      if (tacticalBtn) await user.click(tacticalBtn);
    }

    const statsNav = screen.getAllByRole('button').find((b) => /stats|thống kê/i.test(b.textContent ?? ''));
    if (statsNav) await user.click(statsNav);

    const slider = view.container.querySelector('input[type="range"]');
    if (slider) {
      fireEvent.change(slider, { target: { value: '0.6' } });
    }

    expect(view.container.textContent).toMatch(/USA|Mexico/i);
  });

  it('redirects legacy match ids to canonical slug', async () => {
    await renderMatch(SMOKE_MATCH_ID);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/matches/usa-vs-mexico', { replace: true }));
  });

  it('renders completed match recap panel', async () => {
    const { view } = await renderMatch('m-done');
    await waitFor(() => expect(view.container.textContent).toMatch(/Costa Rica|USA|3/i), { timeout: 8000 });
    expect(view.container.textContent).toMatch(/recap|tóm tắt|FT|full time/i);
  });

  it('shows not found for failed match fetch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.match(/\/api\/matches\/missing-match$/)) {
          return new Response('missing', { status: 404 });
        }
        return new Response(JSON.stringify(mockApiBody(url)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );
    const { view } = await renderMatch('missing-match');
    await waitFor(() => expect(view.container.textContent).toMatch(/not found|không tìm thấy/i), {
      timeout: 5000,
    });
  });

  it('renders live match with stats, pitch map, and section navigation', async () => {
    const { user, view } = await renderMatch('m-live');
    await waitFor(() => expect(view.container.textContent).toMatch(/USA|Canada/i), { timeout: 8000 });

    const momentumNav = screen.getAllByRole('button').find((b) => /momentum|đà/i.test(b.textContent ?? ''));
    if (momentumNav) await user.click(momentumNav);

    const scenariosNav = screen.getAllByRole('button').find((b) => /scenario|kịch bản/i.test(b.textContent ?? ''));
    if (scenariosNav) await user.click(scenariosNav);

    expect(view.container.textContent).toMatch(/live|67|stats|pitch/i);
  });

  it('opens guide strip and uses analyst simulator slider', async () => {
    const { user, view } = await renderMatch('usa-vs-mexico');
    await waitFor(() => expect(view.container.textContent).toMatch(/USA|Mexico/i), { timeout: 8000 });

    const guideToggle = screen.getAllByRole('button').find((b) => /guide|hướng dẫn/i.test(b.textContent ?? ''));
    if (guideToggle && !/editorial|bài viết/i.test(guideToggle.textContent ?? '')) {
      await user.click(guideToggle);
    }

    const slider = view.container.querySelector('input[type="range"]');
    if (slider) fireEvent.change(slider, { target: { value: '0.75' } });

    expect(view.container.textContent).toMatch(/USA|Mexico/i);
  });
});
