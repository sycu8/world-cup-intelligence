import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { resolveTeamDisplayName } from '../lib/matchTeams';
import { TeamWorldCupH2HPanel, type TeamWcOpponentRecord } from '../components/match/MatchHistoryPanel';
import { useI18n } from '../lib/i18n/I18nContext';

export function TeamPage() {
  const { teamId } = useParams();
  const { t } = useI18n();
  const [team, setTeam] = useState<Awaited<ReturnType<typeof api.team>>['data'] | null>(null);
  const [wcH2h, setWcH2h] = useState<{ opponents: TeamWcOpponentRecord[]; totalMeetings: number } | null>(
    null,
  );

  useEffect(() => {
    if (!teamId) return;
    api.team(teamId).then((r) => setTeam(r.data)).catch(() => setTeam(null));
    api
      .teamWcH2h(teamId)
      .then((r) => setWcH2h({ opponents: r.data.opponents, totalMeetings: r.data.totalMeetings }))
      .catch(() => setWcH2h(null));
  }, [teamId]);

  if (!team) {
    return <div className="text-muted">{t('match.loading')}</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/matches" className="text-sm text-muted hover:text-cyan">
        ← {t('nav.matches')}
      </Link>

      <header className="panel max-w-xl">
        <h1 className="font-heading text-3xl text-foreground">{team.name}</h1>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <dt className="text-muted">{t('team.fifaRank')}</dt>
          <dd>{team.fifa_ranking ?? '—'}</dd>
          <dt className="text-muted">{t('team.elo')}</dt>
          <dd>{team.elo_rating?.toFixed(0) ?? '—'}</dd>
        </dl>
      </header>

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
