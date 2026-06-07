import { useCallback, useEffect, useState } from 'react';
import { api, type ScheduleMatch, type TeamSummary } from '../lib/api';
import { GroupStageBoard } from '../components/tournament/GroupStageBoard';
import { TournamentSchedulePanel } from '../components/tournament/TournamentSchedulePanel';
import { FavoritesPanel } from '../components/tournament/FavoritesPanel';
import { TeamsDirectory } from '../components/tournament/TeamsDirectory';
import { Bilingual } from '../components/i18n/Bilingual';
import { useI18n } from '../lib/i18n/I18nContext';
import type { LocaleKey } from '../lib/i18n/locales';

const REFRESH_MS = 30_000;

type HubTab = 'schedule' | 'standings' | 'favorites' | 'teams';

const TABS: { id: HubTab; key: LocaleKey }[] = [
  { id: 'schedule', key: 'matches.tabSchedule' },
  { id: 'standings', key: 'matches.tabStandings' },
  { id: 'favorites', key: 'favorites.tab' },
  { id: 'teams', key: 'teams.tab' },
];

export function MatchesPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<HubTab>('schedule');
  const [byDate, setByDate] = useState<Record<string, ScheduleMatch[]>>({});
  const [matches, setMatches] = useState<ScheduleMatch[]>([]);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [probs, setProbs] = useState<Record<string, { homeWin: number; draw: number; awayWin: number }>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [scheduleRes, teamsRes, probRes] = await Promise.all([
        api.schedule(),
        api.teams(),
        api.tournamentMatchProbabilities(2026),
      ]);
      setByDate(scheduleRes.data.byDate);
      setMatches(scheduleRes.data.matches);
      setTeams(teamsRes.data);
      setProbs(probRes.data);
    } catch {
      setByDate({});
      setMatches([]);
      setTeams([]);
      setProbs({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <div className="space-y-6">
      <header>
        <Bilingual
          k="matches.pageTitle"
          as="h1"
          className="font-heading text-3xl tracking-tight sm:text-4xl md:text-5xl"
        />
        <Bilingual
          k="matches.hubSubtitle"
          as="p"
          className="mt-2 max-w-3xl text-sm text-foreground/80 sm:mt-3 sm:text-base"
        />
      </header>

      <nav className="flex flex-wrap gap-2 border-b border-border/60 pb-3" aria-label={t('matches.hubNav')}>
        {TABS.map(({ id, key }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              tab === id
                ? 'border-pressing bg-pressing/15 text-pressing'
                : 'border-border text-muted hover:border-pressing/40 hover:text-foreground'
            }`}
          >
            {t(key)}
          </button>
        ))}
      </nav>

      {loading ? (
        <div className="panel text-muted">
          <Bilingual k="matches.loading" />
        </div>
      ) : tab === 'schedule' ? (
        <TournamentSchedulePanel byDate={byDate} matches={matches} probs={probs} />
      ) : tab === 'standings' ? (
        <GroupStageBoard matches={matches} />
      ) : tab === 'favorites' ? (
        <FavoritesPanel matches={matches} teams={teams} />
      ) : (
        <TeamsDirectory teams={teams} />
      )}
    </div>
  );
}
