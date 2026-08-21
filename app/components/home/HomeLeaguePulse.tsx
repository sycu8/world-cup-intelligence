import { Link, useNavigate } from 'react-router-dom';
import type { LeagueCatalogCard } from '../../lib/api';
import { useI18n } from '../../lib/i18n/I18nContext';

type Props = {
  leagues: LeagueCatalogCard[];
};

/** Pulse of live / upcoming activity across club competitions. */
export function HomeLeaguePulse({ leagues }: Props) {
  const { t, mode } = useI18n();
  const navigate = useNavigate();
  const list = leagues ?? [];
  const active = list.filter((l) => l.liveCount > 0 || l.upcomingCount > 0);

  if (!active.length) return null;

  return (
    <section className="home-landing-section" aria-labelledby="home-pulse-title">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="home-pulse-title" className="font-heading text-2xl tracking-tight sm:text-3xl">
            {t('home.landing.pulseTitle')}
          </h2>
          <p className="mt-1 text-sm text-muted">{t('home.landing.pulseSubtitle')}</p>
        </div>
        <Link to="/leagues" className="text-sm font-medium text-cyan hover:underline">
          {t('leagues.choose')} →
        </Link>
      </div>
      <ul className="divide-y divide-border/40 border-y border-border/40">
        {active.map((league) => {
          const name = mode === 'vi' ? league.nameVi : league.name;
          return (
            <li key={league.id}>
              <Link
                to={league.href}
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
                    return;
                  }
                  event.preventDefault();
                  navigate(league.href);
                }}
                className="flex flex-wrap items-center justify-between gap-3 py-4 transition hover:bg-panel2/30"
              >
                <div className="min-w-0">
                  <p className="font-heading text-base text-foreground">{name}</p>
                  <p className="text-xs text-muted">
                    {mode === 'vi' ? league.regionLabel.vi : league.regionLabel.en} · {league.season}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-sm tabular-nums">
                  {league.liveCount > 0 ? (
                    <span className="font-semibold text-cyan">
                      {league.liveCount} {t('leagues.live')}
                    </span>
                  ) : null}
                  <span className="text-muted">
                    {league.upcomingCount} {t('leagues.upcoming')}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
