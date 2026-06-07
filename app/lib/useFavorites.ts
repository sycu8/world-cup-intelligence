import { useCallback, useEffect, useState } from 'react';
import {
  FAVORITES_CHANGED,
  loadFavorites,
  saveFavorites,
  toggleInList,
  type FavoritesStore,
} from './favorites';

export function useFavorites() {
  const [store, setStore] = useState<FavoritesStore>(() => loadFavorites());

  useEffect(() => {
    const sync = () => setStore(loadFavorites());
    window.addEventListener(FAVORITES_CHANGED, sync);
    return () => window.removeEventListener(FAVORITES_CHANGED, sync);
  }, []);

  const persist = useCallback((next: FavoritesStore) => {
    setStore(next);
    saveFavorites(next);
  }, []);

  const toggleMatch = useCallback(
    (matchId: string) => {
      persist({ ...store, matches: toggleInList(store.matches, matchId) });
    },
    [persist, store],
  );

  const toggleTeam = useCallback(
    (teamId: string) => {
      persist({ ...store, teams: toggleInList(store.teams, teamId) });
    },
    [persist, store],
  );

  const isMatchFavorite = useCallback(
    (matchId: string) => store.matches.includes(matchId),
    [store.matches],
  );

  const isTeamFavorite = useCallback(
    (teamId: string) => store.teams.includes(teamId),
    [store.teams],
  );

  return {
    favoriteMatchIds: store.matches,
    favoriteTeamIds: store.teams,
    toggleMatch,
    toggleTeam,
    isMatchFavorite,
    isTeamFavorite,
  };
}
