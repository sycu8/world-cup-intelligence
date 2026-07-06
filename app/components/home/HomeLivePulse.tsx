import { Link } from 'react-router-dom';
import type { DashboardData } from '../../lib/api';
import { useI18n } from '../../lib/i18n/I18nContext';

type Props = {
  dashboard: DashboardData | null;
};

export function HomeLivePulse({ dashboard }: Props) {
  const { t } = useI18n();

  const expected = dashboard?.expectedMatches ?? 104;
  const done =
    (dashboard?.statusCounts?.completed ?? 0) + (dashboard?.statusCounts?.finished ?? 0);
  const live = dashboard?.statusCounts?.live ?? 0;
  const progressPct = expected > 0 ? Math.min(100, Math.round((done / expected) * 100)) : 0;

  return (
    <section className="home-pulse" aria-label={t('wc.title')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-xl" aria-hidden>
            🏆
          </span>
          <div>
            <p className="font-heading text-base font-bold text-foreground sm:text-lg">{t('wc.title')}</p>
            <p className="text-sm text-muted">
              {t('wc.progress').replace('{done}', String(done)).replace('{total}', String(expected))}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {live > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-live/15 px-3 py-1 text-sm font-semibold text-live">
              <span className="live-dot" aria-hidden />
              {t('wc.liveNow').replace('{n}', String(live))}
            </span>
          )}
          <Link to="/matches" className="btn-ghost text-sm">
            {t('home.exploreSchedule')}
          </Link>
          <Link to="/matches?tab=standings" className="btn-ghost text-sm">
            {t('home.exploreStandings')}
          </Link>
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-background2/80">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan/70 to-defending/80 transition-all duration-500"
          style={{ width: `${Math.max(progressPct, done > 0 ? 3 : 0)}%` }}
        />
      </div>
    </section>
  );
}
