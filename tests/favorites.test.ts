import { describe, expect, it, vi } from 'vitest';
import { FAVORITES_CHANGED, loadFavorites, saveFavorites, toggleInList } from '../app/lib/favorites';

describe('favorites', () => {
  it('toggleInList adds and removes ids', () => {
    expect(toggleInList([], 'a')).toEqual(['a']);
    expect(toggleInList(['a'], 'a')).toEqual([]);
    expect(toggleInList(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('loadFavorites returns empty store when storage missing', () => {
    expect(loadFavorites()).toEqual({ matches: [], teams: [] });
  });

  it('loadFavorites parses stored JSON and tolerates invalid shape', () => {
    localStorage.setItem('wc-favorites-v1', JSON.stringify({ matches: ['m1'], teams: null }));
    expect(loadFavorites()).toEqual({ matches: ['m1'], teams: [] });

    localStorage.setItem('wc-favorites-v1', '{bad json');
    expect(loadFavorites()).toEqual({ matches: [], teams: [] });
  });

  it('saveFavorites persists and emits change event', () => {
    const listener = vi.fn();
    window.addEventListener(FAVORITES_CHANGED, listener);
    saveFavorites({ matches: ['m1'], teams: ['t1'] });

    expect(JSON.parse(localStorage.getItem('wc-favorites-v1')!)).toEqual({
      matches: ['m1'],
      teams: ['t1'],
    });
    expect(listener).toHaveBeenCalled();
    window.removeEventListener(FAVORITES_CHANGED, listener);
  });
});
