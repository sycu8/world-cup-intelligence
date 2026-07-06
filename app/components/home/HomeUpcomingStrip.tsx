import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { ScheduleMatch } from '../../lib/api';
import { resolveMatchHref } from '../../lib/matchPaths';
import { useI18n } from '../../lib/i18n/I18nContext';
import { MatchKickoffDisplay } from '../match/MatchKickoffDisplay';
import { MatchResultScore, hasMatchResult } from '../match/MatchResultScore';
import { MatchForecastScore } from '../match/MatchForecastScore';
import { TeamNameWithFlag } from '../team/TeamNameWithFlag';

type Props = {
  matches: ScheduleMatch[];
  probs?: Record<string, { mostLikelyScore?: string }>;
};

export function HomeUpcomingStrip({ matches, probs = {} }: Props) {
  const { t } = useI18n();

  const stripMatches = useMemo(() => {
    const now = Date.now();
    const ranked = [...matches].sort((a, b) => {
      const rank = (m: ScheduleMatch) => {
        if (m.status === 'live') return 0;
        if (m.status === 'scheduled') return 1;
        return 2;
      };
      const r = rank(a) - rank(b);
      if (r !== 0) return r;
      return a.kickoff_utc.localeCompare(b.kickoff_utc);
    });

    const live = ranked.filter((m) => m.status === 'live');
    const upcoming = ranked.filter(
      (m) => m.status === 'scheduled' && new Date(m.kickoff_utc).getTime() >= now - 3_600_000,
    );
    const recent = ranked.filter(
      (m) =>
        (m.status === 'completed' || m.status === 'finished') &&
        new Date(m.kickoff_utc).getTime() >= now - 86_400_000 * 2,
    );

    const picked = [...live, ...upcoming.slice(0, 6), ...recent.slice(0, 2)];
    const seen = new Set<string>();
    return picked.filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    }).slice(0, 8);
  }, [matches]);

  if (stripMatches.length === 0) return null;

  return (
    <section className="home-section">
      <div className="mb-3 flex items-end justify-between gap-2">
        <div>
          <h2 className="section-title">{t('home.upcomingTitle')}</h2>
          <p className="section-subtitle">{t('home.upcomingSubtitle')}</p>
        </div>
        <Link to="/matches" className="shrink-0 text-sm font-medium text-cyan hover:underline">
          {t('home.exploreSchedule')} →
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin">
        {stripMatches.map((m) => {
          const forecast = !hasMatchResult(m.status) ? probs[m.id]?.mostLikelyScore : undefined;
          const isLive = m.status === 'live';

          return (
            <Link
              key={m.id}
              to={resolveMatchHref(m)}
              className={`home-match-chip shrink-0 ${isLive ? 'home-match-chip--live' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <time className="text-xs text-muted">
                  <MatchKickoffDisplay kickoffUtc={m.kickoff_utc} showLocalReference={false} />
                </time>
                {isLive && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-live">
                    <span className="live-dot" aria-hidden />
                    {t('common.live')}
                  </span>
                )}
              </div>

              <div className="mt-2 space-y-1">
                <TeamNameWithFlag
                  name={m.home_short?.trim() || m.home_name}
                  flagName={m.home_name}
                  countryCode={m.home_country_code}
                  compact
                  className="text-sm font-medium"
                  flagClassName="h-3.5 w-5 rounded-sm object-cover ring-1 ring-white/10"
                />
                <TeamNameWithFlag
                  name={m.away_short?.trim() || m.away_name}
                  flagName={m.away_name}
                  countryCode={m.away_country_code}
                  compact
                  className="text-sm font-medium"
                  flagClassName="h-3.5 w-5 rounded-sm object-cover ring-1 ring-white/10"
                />
              </div>

              <div className="mt-2 flex justify-end">
                {hasMatchResult(m.status) ? (
                  <MatchResultScore
                    homeScore={m.home_score}
                    awayScore={m.away_score}
                    status={m.status}
                    variant="badge"
                  />
                ) : forecast ? (
                  <MatchForecastScore score={forecast} />
                ) : (
                  <span className="text-xs text-muted">vs</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
