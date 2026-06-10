import { useEffect, useState } from 'react';
import { api, type MatchStatsPayload } from '../../lib/api';
import { useI18n } from '../../lib/i18n/I18nContext';
import { SectionLabel } from '../tactical/SectionLabel';
import { pct, xg } from '../../lib/format';

type Props = {
  matchId: string;
  homeLabel: string;
  awayLabel: string;
  live?: boolean;
};

function statOrDash(value: number | null, fmt?: (v: number) => string) {
  if (value == null) return '—';
  return fmt ? fmt(value) : String(value);
}

export function MatchLiveStatsPanel({ matchId, homeLabel, awayLabel, live }: Props) {
  const { t } = useI18n();
  const [stats, setStats] = useState<MatchStatsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .matchStats(matchId)
      .then((r) => setStats(r.data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [matchId]);

  const rows: { key: string; home: string; away: string }[] = stats
    ? [
        {
          key: t('stats.possession'),
          home: statOrDash(stats.home.possession, (v) => `${Math.round(v)}%`),
          away: statOrDash(stats.away.possession, (v) => `${Math.round(v)}%`),
        },
        {
          key: t('stats.shots'),
          home: statOrDash(stats.home.shots),
          away: statOrDash(stats.away.shots),
        },
        {
          key: t('stats.shotsOnTarget'),
          home: statOrDash(stats.home.shotsOnTarget),
          away: statOrDash(stats.away.shotsOnTarget),
        },
        {
          key: t('stats.xg'),
          home: statOrDash(stats.home.xg, xg),
          away: statOrDash(stats.away.xg, xg),
        },
        {
          key: t('stats.passes'),
          home: statOrDash(stats.home.passes),
          away: statOrDash(stats.away.passes),
        },
        {
          key: t('stats.passAccuracy'),
          home: statOrDash(stats.home.passAccuracy, (v) => `${Math.round(v)}%`),
          away: statOrDash(stats.away.passAccuracy, (v) => `${Math.round(v)}%`),
        },
      ]
    : [];

  return (
    <section className="panel-dense">
      <SectionLabel
        title={t('stats.title')}
        subtitle={live ? t('stats.subtitleLive') : t('stats.subtitle')}
        accent="cyan"
      />
      {loading ? (
        <p className="mt-3 text-sm text-muted">{t('stats.loading')}</p>
      ) : !stats || stats.dataSource === 'unavailable' ? (
        <p className="mt-3 text-sm text-muted">{t('stats.unavailable')}</p>
      ) : (
        <>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[280px] text-sm">
              <thead>
                <tr className="text-muted">
                  <th className="pb-2 text-left font-medium">{homeLabel}</th>
                  <th className="pb-2 text-center font-medium" />
                  <th className="pb-2 text-right font-medium">{awayLabel}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className="border-t border-border/40">
                    <td className="py-2 font-mono-data tabular-nums">{row.home}</td>
                    <td className="px-2 py-2 text-center text-xs text-muted">{row.key}</td>
                    <td className="py-2 text-right font-mono-data tabular-nums">{row.away}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap gap-3 font-mono-data text-xs text-muted">
            <span>
              {t('stats.cards')}: 🟨 {stats.events.yellowCards} · 🟥 {stats.events.redCards}
            </span>
            <span>
              {t('stats.subs')}: {stats.events.substitutions}
            </span>
          </div>
          <p className="mt-2 text-[11px] text-muted">{t('prediction.xgNote')}</p>
          {stats.updatedAt && (
            <p className="mt-1 text-[11px] text-muted">
              {t('common.lastUpdated')}: {new Date(stats.updatedAt).toLocaleString('vi-VN')}
            </p>
          )}
        </>
      )}
    </section>
  );
}
