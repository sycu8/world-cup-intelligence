import type { DashboardData } from '../../lib/api';
import { useI18n } from '../../lib/i18n/I18nContext';

type Props = {
  title?: string;
  dashboard?: DashboardData | null;
};

export function WorldCupCountdown({ title, dashboard }: Props) {
  const { t } = useI18n();
  const heading = title ?? t('wc.title');

  const expected = dashboard?.expectedMatches ?? 104;
  const done =
    (dashboard?.statusCounts?.completed ?? 0) + (dashboard?.statusCounts?.finished ?? 0);
  const live = dashboard?.statusCounts?.live ?? 0;
  const scheduled = dashboard?.statusCounts?.scheduled ?? 0;
  const progressPct = expected > 0 ? Math.min(100, Math.round((done / expected) * 100)) : 0;
  const hosts = dashboard?.hostCountries?.join(' · ') ?? '';

  return (
    <section className="panel-dense flex h-full flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan/20 to-magenta/10 ring-1 ring-cyan/25">
          <span className="text-2xl leading-none" aria-hidden>
            🏆
          </span>
        </div>
        <div className="min-w-0">
          <p className="font-heading text-lg font-bold tracking-tight text-foreground md:text-xl">
            {heading}
          </p>
          {hosts && <p className="mt-0.5 text-sm text-muted">{hosts}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="inline-flex items-center gap-2 font-medium text-cyan">
            <span className="live-dot" aria-hidden />
            {t('wc.underway')}
          </span>
          <span className="font-mono-data tabular-nums text-muted">
            {t('wc.progress').replace('{done}', String(done)).replace('{total}', String(expected))}
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-background2 ring-1 ring-border/50">
          <div
            className="progress-bar-fill h-full rounded-full bg-gradient-to-r from-cyan/80 via-cyan to-defending/80"
            style={{ width: `${Math.max(progressPct, done > 0 ? 4 : 0)}%` }}
          />
        </div>
      </div>

      <div className="mt-auto grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border/50 bg-panel2/35 px-3 py-2 text-center">
          <p className="font-heading text-2xl tabular-nums text-live">{live}</p>
          <p className="text-xs font-medium text-muted">
            {t('wc.liveNow').replace('{n}', String(live))}
          </p>
        </div>
        <div className="rounded-lg border border-border/50 bg-panel2/35 px-3 py-2 text-center">
          <p className="font-heading text-2xl tabular-nums text-foreground">{scheduled}</p>
          <p className="text-xs font-medium text-muted">{t('home.scheduled')}</p>
        </div>
      </div>
    </section>
  );
}
