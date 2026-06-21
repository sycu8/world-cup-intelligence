import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCountdown, getCountdownParts } from '../../app/lib/useCountdown';
import { useFavorites } from '../../app/lib/useFavorites';
import { FAVORITES_CHANGED, saveFavorites } from '../../app/lib/favorites';
import { useLegacyMatchRedirect } from '../../app/lib/useLegacyMatchRedirect';
import { useMatchScenarioLive } from '../../app/lib/useMatchScenarioLive';
import { SMOKE_MATCH_ID } from '../helpers/smokeFixtures';

const navigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

describe('useCountdown', () => {
  it('returns expired parts when target is null', () => {
    const { result } = renderHook(() => useCountdown(null));
    expect(result.current.expired).toBe(true);
  });

  it('computes countdown parts and initial hook state', () => {
    const now = Date.parse('2026-06-04T12:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const parts = getCountdownParts('2026-06-04T12:01:30Z', now);
    expect(parts.minutes).toBe(1);
    const { result, unmount } = renderHook(() => useCountdown('2026-06-04T12:00:05Z'));
    expect(result.current.seconds).toBe(5);
    unmount();
    vi.useRealTimers();
  });
});

describe('useFavorites', () => {
  it('loads, toggles, and syncs favorites', () => {
    saveFavorites({ matches: ['m-a'], teams: ['t-a'] });
    const { result } = renderHook(() => useFavorites());
    expect(result.current.isMatchFavorite('m-a')).toBe(true);
    act(() => {
      result.current.toggleMatch('m-b');
    });
    act(() => {
      result.current.toggleTeam('t-b');
    });
    expect(result.current.favoriteMatchIds).toEqual(['m-a', 'm-b']);
    act(() => {
      saveFavorites({ matches: ['m-sync'], teams: [] });
      window.dispatchEvent(new CustomEvent(FAVORITES_CHANGED));
    });
    expect(result.current.favoriteMatchIds).toEqual(['m-sync']);
  });
});

describe('useLegacyMatchRedirect', () => {
  it('navigates from legacy id to slug path', () => {
    navigate.mockClear();
    renderHook(() => useLegacyMatchRedirect('m-w26-ga-1v2', 'vong-bang-a-usa-vs-mex', (s) => `/matches/${s}`));
    expect(navigate).toHaveBeenCalledWith('/matches/vong-bang-a-usa-vs-mex', { replace: true });
  });

  it('skips redirect when slug matches url ref', () => {
    navigate.mockClear();
    renderHook(() => useLegacyMatchRedirect('m-test', 'm-test', (s) => `/matches/${s}`));
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('useMatchScenarioLive', () => {
  it('does not connect when disabled', () => {
    const { unmount } = renderHook(() => useMatchScenarioLive(SMOKE_MATCH_ID, vi.fn(), false));
    unmount();
  });
});
