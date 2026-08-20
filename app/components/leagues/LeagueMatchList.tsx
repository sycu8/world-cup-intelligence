import { Link } from 'react-router-dom';
import type { ScheduleMatch } from '../../lib/api';
import { resolveMatchHref } from '../../lib/matchPaths';
import { useI18n } from '../../lib/i18n/I18nContext';
import { CompactMatchProb } from '../tournament/CompactMatchProb';
import { MatchKickoffDisplay } from '../match/MatchKickoffDisplay';
import { MatchResultScore, hasMatchResult } from '../match/MatchResultScore';
import { TeamNameWithFlag } from '../team/TeamNameWithFlag';

type Props = {
  matches: ScheduleMatch[];
  probs?: Record<string, { homeWin: number; draw: number; awayWin: number }>;
  emptyKey?: 'leagues.emptyMatches';
};

export function LeagueMatchList({ matches, probs = {}, emptyKey = 'leagues.emptyMatches' }: Props) {
  const { t } = useI18n();
  if (!matches.length) {
    return <p className="text-sm text-muted">{t(emptyKey)}</p>;
  }

  return (
    <ul className="divide-y divide-border/40">
      {matches.map((match) => {
        const prob = probs[match.id];
        const live = match.status === 'live';
        return (
          <li key={match.id}>
            <Link
              to={resolveMatchHref(match)}
              className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <TeamNameWithFlag name={match.home_name} countryCode={match.home_country_code} />
                  <span className="text-muted">{t('common.vs')}</span>
                  <TeamNameWithFlag name={match.away_name} countryCode={match.away_country_code} />
                </p>
                <p className="mt-1 text-xs text-muted">
                  <MatchKickoffDisplay kickoffUtc={match.kickoff_utc} showLocalReference={false} />
                  {match.stage ? ` · ${match.stage}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {live ? <span className="text-xs font-semibold text-cyan">{t('common.live')}</span> : null}
                {hasMatchResult(match.status) || live ? (
                  <MatchResultScore homeScore={match.home_score} awayScore={match.away_score} status={match.status} />
                ) : (
                  <CompactMatchProb homeWin={prob?.homeWin} draw={prob?.draw} awayWin={prob?.awayWin} />
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
