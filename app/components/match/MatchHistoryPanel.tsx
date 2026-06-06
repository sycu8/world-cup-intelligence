import { Link } from 'react-router-dom';
import { Bilingual } from '../i18n/Bilingual';
import { useI18n } from '../../lib/i18n/I18nContext';
import { matchStageLabel } from '../../lib/i18n/stageLabels';

export type HistoryMatch = {
  id: string;
  kickoff_utc: string;
  stage: string | null;
  home_name: string;
  away_name: string;
  home_short?: string | null;
  away_short?: string | null;
  home_score: number;
  away_score: number;
  tournament_year?: number;
};

export type H2HSummary = {
  totalMatches: number;
  homeTeamWins: number;
  awayTeamWins: number;
  draws: number;
  avgGoalsHome: number;
  avgGoalsAway: number;
  recentFormHome: string;
  recentFormAway: string;
};

type Props = {
  homeName: string;
  awayName: string;
  history: HistoryMatch[];
  summary: H2HSummary;
  titleKey?: 'match.wcHistory' | 'match.history';
};

function stageLabel(stage: string | null, t: ReturnType<typeof useI18n>['t']) {
  return matchStageLabel(stage, t);
}

function MeetingRow({ m, mode, t }: { m: HistoryMatch; mode: string; t: ReturnType<typeof useI18n>['t'] }) {
  return (
    <li>
      <div className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2.5 text-sm">
        <div className="min-w-0 flex-1">
          <span className="font-medium">
            {m.home_short ?? m.home_name}{' '}
            <span className="font-mono-data tabular-nums">
              {m.home_score}–{m.away_score}
            </span>{' '}
            {m.away_short ?? m.away_name}
          </span>
          <p className="text-xs text-muted">
            {stageLabel(m.stage, t)}
            {m.tournament_year ? ` · WC ${m.tournament_year}` : ''} ·{' '}
            {new Date(m.kickoff_utc).toLocaleDateString(mode === 'en' ? 'en' : 'vi-VN')}
          </p>
        </div>
      </div>
    </li>
  );
}

export function MatchHistoryPanel({
  homeName,
  awayName,
  history,
  summary,
  titleKey = 'match.wcHistory',
}: Props) {
  const { mode, t } = useI18n();

  return (
    <section className="panel space-y-4">
      <div>
        <Bilingual k={titleKey} as="h3" className="text-sm font-semibold uppercase tracking-wider text-pressing" />
        <p className="mt-1 text-xs text-muted">{t('match.wcHistoryHint')}</p>
      </div>

      {history.length === 0 ? (
        <Bilingual k="match.wcHistoryEmpty" as="p" className="text-sm text-muted" />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-panel2/60 p-3 text-center text-xs">
            <div>
              <p className="font-bold text-defending">{summary.homeTeamWins}</p>
              <p className="truncate text-muted">{homeName}</p>
            </div>
            <div>
              <p className="font-bold text-muted">{summary.draws}</p>
              <p className="text-muted">{t('common.draws')}</p>
            </div>
            <div>
              <p className="font-bold text-shooting">{summary.awayTeamWins}</p>
              <p className="truncate text-muted">{awayName}</p>
            </div>
          </div>

          <div className="flex justify-between gap-2 text-xs text-muted">
            <span className="truncate">
              {t('common.form')}: {summary.recentFormHome}
            </span>
            <span className="truncate text-right">{summary.recentFormAway}</span>
          </div>

          <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {history.map((m) => (
              <MeetingRow key={m.id} m={m} mode={mode} t={t} />
            ))}
          </ul>

          <p className="text-xs text-muted">
            {t('history.avgGoals')
              .replace('{home}', summary.avgGoalsHome.toFixed(1))
              .replace('{away}', summary.avgGoalsAway.toFixed(1))
              .replace('{n}', String(summary.totalMatches))}
          </p>
        </>
      )}
    </section>
  );
}

export type TeamWcOpponentRecord = {
  opponentId: string;
  opponentName: string;
  opponentShort: string | null;
  meetings: HistoryMatch[];
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
};

type TeamPanelProps = {
  teamName: string;
  opponents: TeamWcOpponentRecord[];
  totalMeetings: number;
};

export function TeamWorldCupH2HPanel({ teamName, opponents, totalMeetings }: TeamPanelProps) {
  const { t } = useI18n();

  if (opponents.length === 0) {
    return (
      <section className="panel space-y-2">
        <Bilingual k="team.wcH2hTitle" as="h2" className="text-lg font-semibold text-foreground" />
        <Bilingual k="team.wcH2hEmpty" as="p" className="text-sm text-muted" />
      </section>
    );
  }

  return (
    <section className="panel space-y-4">
      <div>
        <Bilingual k="team.wcH2hTitle" as="h2" className="text-lg font-semibold text-foreground" />
        <p className="mt-1 text-sm text-muted">
          {t('team.wcH2hSubtitle')
            .replace('{team}', teamName)
            .replace('{n}', String(totalMeetings))}
        </p>
      </div>

      <div className="space-y-4">
        {opponents.map((opp) => (
          <article
            key={opp.opponentId}
            className="rounded-xl border border-border/50 bg-panel2/30 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link
                  to={`/teams/${opp.opponentId}`}
                  className="font-heading text-base text-cyan hover:underline"
                >
                  {opp.opponentShort ?? opp.opponentName}
                </Link>
                <p className="text-xs text-muted">
                  {t('team.wcH2hRecord')
                    .replace('{w}', String(opp.wins))
                    .replace('{d}', String(opp.draws))
                    .replace('{l}', String(opp.losses))
                    .replace('{gf}', String(opp.goalsFor))
                    .replace('{ga}', String(opp.goalsAgainst))}
                </p>
              </div>
              <span className="font-mono-data text-xs text-muted">
                {opp.meetings.length} {t('team.wcH2hMeetings')}
              </span>
            </div>

            <ul className="mt-3 space-y-2">
              {opp.meetings.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/30 px-3 py-2 text-sm"
                >
                  <span className="font-medium">
                    {m.home_short ?? m.home_name}{' '}
                    <span className="font-mono-data tabular-nums">
                      {m.home_score}–{m.away_score}
                    </span>{' '}
                    {m.away_short ?? m.away_name}
                  </span>
                  <span className="text-xs text-muted">
                    WC {m.tournament_year} · {stageLabel(m.stage, t)}
                  </span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
