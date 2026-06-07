import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type SquadPlayer } from '../lib/api';
import { resolveTeamDisplayName } from '../lib/matchTeams';
import { TeamWorldCupH2HPanel, type TeamWcOpponentRecord } from '../components/match/MatchHistoryPanel';
import { FavoriteButton } from '../components/favorites/FavoriteButton';
import { TeamNameWithFlag } from '../components/team/TeamNameWithFlag';
import { useFavorites } from '../lib/useFavorites';
import { useI18n } from '../lib/i18n/I18nContext';

function groupSquad(players: SquadPlayer[]) {
  const order = ['GK', 'DF', 'MF', 'FW'];
  const buckets: Record<string, SquadPlayer[]> = { GK: [], DF: [], MF: [], FW: [], Other: [] };
  for (const p of players) {
    const pos = (p.listed_position ?? p.position ?? '').toUpperCase();
    const key =
      pos.startsWith('G') ? 'GK' : pos.startsWith('D') ? 'DF' : pos.startsWith('M') ? 'MF' : pos.startsWith('F') ? 'FW' : 'Other';
    buckets[key].push(p);
  }
  for (const list of Object.values(buckets)) {
    list.sort((a, b) => (a.shirt_number ?? 99) - (b.shirt_number ?? 99));
  }
  return order
    .filter((k) => buckets[k].length > 0)
    .map((k) => ({ label: k, players: buckets[k] }));
}

export function TeamPage() {
  const { teamId } = useParams();
  const { t } = useI18n();
  const { toggleTeam, isTeamFavorite } = useFavorites();
  const [team, setTeam] = useState<Awaited<ReturnType<typeof api.team>>['data'] | null>(null);
  const [wcH2h, setWcH2h] = useState<{ opponents: TeamWcOpponentRecord[]; totalMeetings: number } | null>(
    null,
  );
  const [squad, setSquad] = useState<SquadPlayer[]>([]);

  useEffect(() => {
    if (!teamId) return;
    api.team(teamId).then((r) => setTeam(r.data)).catch(() => setTeam(null));
    api
      .teamWcH2h(teamId)
      .then((r) => setWcH2h({ opponents: r.data.opponents, totalMeetings: r.data.totalMeetings }))
      .catch(() => setWcH2h(null));
    api
      .teamSquad(teamId)
      .then((r) => setSquad(r.data))
      .catch(() => setSquad([]));
  }, [teamId]);

  const squadGroups = useMemo(() => groupSquad(squad), [squad]);

  if (!team) {
    return <div className="text-muted">{t('match.loading')}</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/matches" className="text-sm text-muted hover:text-cyan">
        ← {t('nav.matches')}
      </Link>

      <header className="panel max-w-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-3xl text-foreground">
              <TeamNameWithFlag name={team.name} countryCode={team.country_code} flagClassName="h-8 w-12 rounded-sm object-cover ring-1 ring-white/10" />
            </h1>
            {team.short_name && team.short_name !== team.name && (
              <p className="mt-1 text-sm text-muted">{team.short_name}</p>
            )}
          </div>
          <FavoriteButton
            active={isTeamFavorite(team.id)}
            onToggle={() => toggleTeam(team.id)}
            label={team.name}
            size="md"
          />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <dt className="text-muted">{t('team.fifaRank')}</dt>
          <dd>{team.fifa_ranking ?? '—'}</dd>
          <dt className="text-muted">{t('team.elo')}</dt>
          <dd>{team.elo_rating?.toFixed(0) ?? '—'}</dd>
          <dt className="text-muted">{t('team.coach')}</dt>
          <dd>{t('team.coachPending')}</dd>
        </dl>
      </header>

      <section className="panel space-y-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-pressing">{t('team.squadTitle')}</h2>
          <p className="mt-1 text-xs text-muted">{t('team.squadSubtitle')}</p>
        </div>
        {squad.length === 0 ? (
          <p className="text-sm text-muted">{t('team.squadEmpty')}</p>
        ) : (
          <div className="space-y-4">
            {squadGroups.map((group) => (
              <div key={group.label}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-cyan">{group.label}</h3>
                <ul className="grid gap-1 sm:grid-cols-2">
                  {group.players.map((p) => (
                    <li
                      key={p.player_id}
                      className="flex items-center gap-2 rounded-lg border border-border/50 bg-panel2/30 px-2 py-1.5 text-sm"
                    >
                      <span className="w-6 font-mono-data text-xs text-muted">{p.shirt_number ?? '—'}</span>
                      <Link to={`/players/${p.player_id}`} className="min-w-0 flex-1 truncate hover:text-cyan">
                        {p.name}
                      </Link>
                      <span className="text-[10px] text-muted">{p.listed_position ?? p.position ?? ''}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {wcH2h && (
        <TeamWorldCupH2HPanel
          teamName={team.name ?? resolveTeamDisplayName(teamId)}
          opponents={wcH2h.opponents}
          totalMeetings={wcH2h.totalMeetings}
        />
      )}
    </div>
  );
}
