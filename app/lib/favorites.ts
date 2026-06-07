const STORAGE_KEY = 'wc-favorites-v1';

export type FavoritesStore = {
  matches: string[];
  teams: string[];
};

export const FAVORITES_CHANGED = 'wc-favorites-changed';

function emptyStore(): FavoritesStore {
  return { matches: [], teams: [] };
}

export function loadFavorites(): FavoritesStore {
  if (typeof window === 'undefined') return emptyStore();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<FavoritesStore>;
    return {
      matches: Array.isArray(parsed.matches) ? parsed.matches : [],
      teams: Array.isArray(parsed.teams) ? parsed.teams : [],
    };
  } catch {
    return emptyStore();
  }
}

export function saveFavorites(store: FavoritesStore): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new CustomEvent(FAVORITES_CHANGED, { detail: store }));
}

export function toggleInList(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}
