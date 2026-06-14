import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { ScheduleMatch, TeamSummary } from '../../lib/api';
import { resolveMatchHref } from '../../lib/matchPaths';
import { useFavorites } from '../../lib/useFavorites';
import { useI18n } from '../../lib/i18n/I18nContext';
import { FavoriteButton } from '../favorites/FavoriteButton';
import { MatchTeamsWithFlags } from '../team/TeamNameWithFlag';
import { MatchKickoffDisplay } from '../match/MatchKickoffDisplay';

type Props = {
  matches: ScheduleMatch[];
  teams: TeamSummary[];
};

export function FavoritesPanel({ matches, teams }: Props) {
  const { mode, t } = useI18n();
  const { favoriteMatchIds, favoriteTeamIds, toggleMatch, toggleTeam, isMatchFavorite, isTeamFavorite } =
    useFavorites();
  const locale = mode === 'en' ? 'en' : 'vi-VN';

  const favoriteMatches = useMemo(
    () => matches.filter((m) => favoriteMatchIds.includes(m.id)),
    [matches, favoriteMatchIds],
  );

  const favoriteTeams = useMemo(
    () => teams.filter((team) => favoriteTeamIds.includes(team.id)),
    [teams, favoriteTeamIds],
  );

  const teamMatches = useMemo(() => {
    if (favoriteTeamIds.length === 0) return [];
    return matches.filter(
      (m) =>
        (m.home_team_id && favoriteTeamIds.includes(m.home_team_id)) ||
        (m.away_team_id && favoriteTeamIds.includes(m.away_team_id)),
    );
  }, [matches, favoriteTeamIds]);

  return (
    <div className="space-y-6">
      <header className="panel-dense">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-pressing">{t('favorites.title')}</h2>
        <p className="mt-1 text-xs text-muted">{t('favorites.subtitle')}</p>
      </header>

      <section className="panel space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan">{t('favorites.matchesTab')}</h3>
        {favoriteMatches.length === 0 ? (
          <p className="text-sm text-muted">{t('favorites.noMatches')}</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {favoriteMatches.map((m) => (
              <li key={m.id} className="flex items-center gap-2 py-2">
                <Link to={resolveMatchHref(m)} className="min-w-0 flex-1 text-sm hover:text-cyan">
                  <MatchTeamsWithFlags
                    homeName={m.home_name}
                    awayName={m.away_name}
                    homeShort={m.home_short}
                    awayShort={m.away_short}
                    homeCountryCode={m.home_country_code}
                    awayCountryCode={m.away_country_code}
                    separator={mode === 'en' ? ' vs ' : ' – '}
                  />
                  <span className="ml-2 text-xs text-muted">
                    <MatchKickoffDisplay kickoffUtc={m.kickoff_utc} showDate showLocalReference />
                  </span>
                </Link>
                <FavoriteButton
                  active={isMatchFavorite(m.id)}
                  onToggle={() => toggleMatch(m.id)}
                  label={m.id}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan">{t('favorites.teamsTab')}</h3>
        {favoriteTeams.length === 0 ? (
          <p className="text-sm text-muted">{t('favorites.noTeams')}</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {favoriteTeams.map((team) => (
              <li key={team.id}>
                <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-panel2/30 px-3 py-2">
                  <Link to={`/teams/${team.id}`} className="min-w-0 flex-1 text-sm font-medium hover:text-cyan">
                    {team.short_name ?? team.name}
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

      {teamMatches.length > 0 && (
        <section className="panel space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-pressing">{t('favorites.teamFixtures')}</h3>
          <ul className="divide-y divide-border/40">
            {teamMatches.slice(0, 20).map((m) => (
              <li key={m.id}>
                <Link
                  to={resolveMatchHref(m)}
                  className="flex items-center justify-between gap-2 py-2 text-sm transition hover:text-cyan"
                >
                  <span>
                    <MatchTeamsWithFlags
                      homeName={m.home_name}
                      awayName={m.away_name}
                      homeShort={m.home_short}
                      awayShort={m.away_short}
                      homeCountryCode={m.home_country_code}
                      awayCountryCode={m.away_country_code}
                      separator={mode === 'en' ? ' vs ' : ' – '}
                    />
                  </span>
                  <time className="text-xs text-muted">
                    <MatchKickoffDisplay kickoffUtc={m.kickoff_utc} showDate showLocalReference={false} />
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
