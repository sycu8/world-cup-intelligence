import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { TeamSummary } from '../../lib/api';
import { useFavorites } from '../../lib/useFavorites';
import { useI18n } from '../../lib/i18n/I18nContext';
import { FavoriteButton } from '../favorites/FavoriteButton';
import { TeamNameWithFlag } from '../team/TeamNameWithFlag';

type Props = {
  teams: TeamSummary[];
};

export function TeamsDirectory({ teams }: Props) {
  const { t } = useI18n();
  const { toggleTeam, isTeamFavorite } = useFavorites();
  const [query, setQuery] = useState('');

  const sorted = useMemo(() => {
    return [...teams].sort((a, b) => (a.fifa_ranking ?? 999) - (b.fifa_ranking ?? 999));
  }, [teams]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((team) => {
      const blob = `${team.name} ${team.short_name ?? ''}`.toLowerCase();
      return blob.includes(q);
    });
  }, [sorted, query]);

  return (
    <section className="panel space-y-4">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-pressing">{t('teams.directoryTitle')}</h2>
        <p className="mt-1 text-xs text-muted">{t('teams.directorySubtitle')}</p>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('teams.searchPlaceholder')}
        className="w-full max-w-md rounded-lg border border-border bg-panel2/80 px-3 py-2 text-sm outline-none focus:border-pressing"
      />

      {filtered.length === 0 ? (
        <p className="text-sm text-muted">{t('common.noFilterMatch')}</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((team) => (
            <li key={team.id}>
              <div className="flex h-full items-center gap-2 rounded-xl border border-border/60 bg-panel2/30 px-3 py-2.5 transition hover:border-pressing/40">
                <Link to={`/teams/${team.id}`} className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    <TeamNameWithFlag
                      name={team.short_name ?? team.name}
                      flagName={team.name}
                      countryCode={team.country_code}
                    />
                  </p>
                  <p className="truncate text-xs text-muted">{team.name}</p>
                  <p className="mt-1 text-[10px] text-muted-dim">
                    FIFA #{team.fifa_ranking ?? '—'} · Elo {team.elo_rating?.toFixed(0) ?? '—'}
                  </p>
                </Link>
                <FavoriteButton
                  active={isTeamFavorite(team.id)}
                  onToggle={() => toggleTeam(team.id)}
                  label={team.name}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
