import { describe, expect, it } from 'vitest';
import { loadFavorites, toggleInList } from '../app/lib/favorites';

describe('favorites', () => {
  it('toggleInList adds and removes ids', () => {
    expect(toggleInList([], 'a')).toEqual(['a']);
    expect(toggleInList(['a'], 'a')).toEqual([]);
    expect(toggleInList(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('loadFavorites returns empty store when storage missing', () => {
    expect(loadFavorites()).toEqual({ matches: [], teams: [] });
  });
});
