import { Link, useNavigate } from 'react-router-dom';
import type { LeagueCatalogCard } from '../../lib/api';
import { useI18n } from '../../lib/i18n/I18nContext';

const ACCENT: Record<LeagueCatalogCard['accent'], string> = {
  cyan: 'border-cyan/40 hover:border-cyan',
  magenta: 'border-magenta/40 hover:border-magenta',
  green: 'border-green/40 hover:border-green',
  yellow: 'border-yellow/40 hover:border-yellow',
  danger: 'border-danger/40 hover:border-danger',
};

const ACCENT_TEXT: Record<LeagueCatalogCard['accent'], string> = {
  cyan: 'text-cyan',
  magenta: 'text-magenta',
  green: 'text-green',
  yellow: 'text-yellow',
  danger: 'text-danger',
};

type Props = {
  league: LeagueCatalogCard;
  featured?: boolean;
};

export function LeagueCard({ league, featured = false }: Props) {
  const { t, mode } = useI18n();
  const navigate = useNavigate();
  const name = mode === 'vi' ? league.nameVi : league.name;
  const region = mode === 'vi' ? league.regionLabel.vi : league.regionLabel.en;

  return (
    <Link
      to={league.href}
      onClick={(event) => {
        // Force client navigation even if edge scripts intercept the default <a> behavior.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
          return;
        }
        event.preventDefault();
        navigate(league.href);
      }}
      className={`panel block h-full transition ${ACCENT[league.accent]} ${featured ? 'p-5 sm:p-6' : ''}`}
    >
      <p className={`text-xs font-semibold uppercase tracking-wide ${ACCENT_TEXT[league.accent]}`}>
        {region} · {t('leagues.season')} {league.season}
      </p>
      <h2 className={`mt-1 font-heading tracking-tight ${featured ? 'text-2xl sm:text-3xl' : 'text-xl'}`}>
        {name}
      </h2>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
        <span>
          <span className="text-cyan">{league.liveCount}</span> {t('leagues.live')}
        </span>
        <span>
          {league.upcomingCount} {t('leagues.upcoming')}
        </span>
        <span>
          {league.completedCount} {t('leagues.results')}
        </span>
      </p>
      <p className={`mt-4 text-sm font-medium ${ACCENT_TEXT[league.accent]}`}>
        {league.format === 'world_cup' ? t('leagues.viewWc') : t('leagues.openHub')}
      </p>
    </Link>
  );
}
