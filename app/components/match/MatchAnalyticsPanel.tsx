import { useEffect, useMemo, useState } from 'react';
import { api, type ProbabilityMovementPayload } from '../../lib/api';
import { useI18n } from '../../lib/i18n/I18nContext';
import { SectionLabel } from '../tactical/SectionLabel';
import { pct } from '../../lib/format';

type Props = {
  matchId: string;
  homeWin?: number;
  awayWin?: number;
};

export function MatchAnalyticsPanel({ matchId, homeWin, awayWin }: Props) {
  const { t } = useI18n();
  const [movement, setMovement] = useState<ProbabilityMovementPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .matchProbabilityMovement(matchId)
      .then((r) => setMovement(r.data))
      .catch(() => setMovement(null))
      .finally(() => setLoading(false));
  }, [matchId]);

  const analytics = useMemo(() => {
    const points = movement?.events ?? [];
    if (points.length >= 2) {
      const first = points[0];
      const last = points[points.length - 1];
      const homeDelta = last.homeWinAfter - first.homeWinBefore;
      const awayDelta = last.awayAfter - first.awayBefore;
      const momentum = Math.max(-1, Math.min(1, homeDelta - awayDelta));
      const pressure = Math.abs(homeDelta) + Math.abs(awayDelta);
      return {
        momentumIndex: momentum,
        pressureIndex: pressure,
        turningPoint: Math.abs(homeDelta) > 0.08 || Math.abs(awayDelta) > 0.08,
        lastUpdated: last.timestamp ?? null,
      };
    }
    if (homeWin != null && awayWin != null) {
      const edge = homeWin - awayWin;
      return {
        momentumIndex: Math.max(-1, Math.min(1, edge)),
        pressureIndex: Math.abs(edge) * 0.5,
        turningPoint: false,
        lastUpdated: null,
      };
    }
    return null;
  }, [movement, homeWin, awayWin]);

  return (
    <section className="panel-dense">
      <SectionLabel title={t('analytics.title')} subtitle={t('analytics.subtitle')} accent="magenta" />
      {loading ? (
        <p className="mt-3 text-sm text-muted">{t('analytics.loading')}</p>
      ) : !analytics ? (
        <p className="mt-3 text-sm text-muted">{t('analytics.unavailable')}</p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <MetricCard
            label={t('analytics.momentum')}
            value={formatIndex(analytics.momentumIndex)}
            hint={momentumHint(analytics.momentumIndex, t)}
          />
          <MetricCard
            label={t('analytics.pressure')}
            value={formatIndex(analytics.pressureIndex)}
            hint={t('analytics.pressureHint')}
          />
          <MetricCard
            label={t('analytics.turningPoint')}
            value={analytics.turningPoint ? t('analytics.turningYes') : t('analytics.turningNo')}
            hint={t('analytics.turningHint')}
          />
        </div>
      )}
      {movement?.events && movement.events.length > 1 && (
        <p className="mt-3 text-xs text-muted">
          {t('analytics.movementNote')}: {movement.events.length} {t('analytics.updates')}
          {analytics?.lastUpdated && (
            <> · {t('common.lastUpdated')}: {new Date(analytics.lastUpdated).toLocaleString('vi-VN')}</>
          )}
        </p>
      )}
      <p className="mt-2 text-[11px] text-muted">{t('analytics.estimateNote')}</p>
    </section>
  );
}

function formatIndex(n: number) {
  if (n > 0.05) return `+${pct(n)}`;
  if (n < -0.05) return pct(n);
  return pct(Math.abs(n));
}

function momentumHint(index: number, t: (k: 'analytics.momentumHome' | 'analytics.momentumAway' | 'analytics.momentumBalanced') => string) {
  if (index > 0.08) return t('analytics.momentumHome');
  if (index < -0.08) return t('analytics.momentumAway');
  return t('analytics.momentumBalanced');
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-panel2/30 p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-mono-data text-lg font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-[11px] leading-snug text-muted">{hint}</p>
    </div>
  );
}
