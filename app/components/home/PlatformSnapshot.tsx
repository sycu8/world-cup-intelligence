import type { DashboardData } from '../../lib/api';
import { useI18n } from '../../lib/i18n/I18nContext';

type Props = {
  dashboard: DashboardData | null;
  /** Fits the left column beside the featured match hero */
  compact?: boolean;
};

export function PlatformSnapshot({ dashboard, compact = false }: Props) {
  const { mode, t } = useI18n();
  const locale = mode === 'en' ? 'en' : 'vi-VN';

  if (!dashboard) return null;

  const scheduled = dashboard.statusCounts?.scheduled ?? 0;
  const live = dashboard.statusCounts?.live ?? 0;
  const done =
    (dashboard.statusCounts?.completed ?? 0) + (dashboard.statusCounts?.finished ?? 0);
  const hosts = dashboard.hostCountries?.join(mode === 'en' ? ', ' : ' · ') ?? '—';

  const stats = [
    {
      label: t('home.matches'),
      value: `${dashboard.matchCount}/${dashboard.expectedMatches ?? 104}`,
    },
    { label: t('home.groups'), value: String(dashboard.groupCount ?? 12) },
    { label: t('home.teams'), value: String(dashboard.teamsCount ?? 48) },
    { label: t('home.scheduled'), value: String(scheduled) },
    { label: t('common.liveLabel'), value: String(live) },
    { label: t('home.played'), value: String(done) },
  ];

  return (
    <section
      className={
        compact
          ? 'panel-dense flex flex-1 flex-col gap-3'
          : 'panel-dense grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto] lg:items-center'
      }
    >
      <div>
        <p className="label-tactical text-cyan">{t('home.snapshot')}</p>
        <p className="mt-1 text-sm text-muted">
          {t('home.cohosts')}
          <span className="text-foreground">{hosts}</span>
        </p>
      </div>
      <ul className={compact ? 'grid grid-cols-2 gap-2 sm:grid-cols-3' : 'flex flex-wrap gap-2'}>
        {stats.map((s) => (
          <li
            key={s.label}
            className={
              compact
                ? 'rounded-lg border border-border/60 bg-panel2/50 px-2 py-1.5 text-center'
                : 'rounded-lg border border-border/60 bg-panel2/50 px-3 py-2 text-center'
            }
          >
            <p
              className={
                compact
                  ? 'font-mono-data text-lg font-semibold text-foreground'
                  : 'font-mono-data text-xl font-semibold text-foreground'
              }
            >
              {s.value}
            </p>
            <p className="text-xs font-medium text-foreground/75 sm:text-sm">{s.label}</p>
          </li>
        ))}
      </ul>
      <p className={`text-xs text-muted-dim ${compact ? 'mt-auto' : 'sm:col-span-2'}`}>
        {dashboard.lastDataRefresh
          ? `${t('common.data')}: ${new Date(dashboard.lastDataRefresh).toLocaleString(locale)}`
          : ''}
        {dashboard.lastNewsCrawl
          ? ` · ${t('common.news')}: ${new Date(dashboard.lastNewsCrawl).toLocaleString(locale)}`
          : ''}
      </p>
    </section>
  );
}
