import { useEffect, useMemo, useState } from 'react';
import { api, type ProbabilityMovementPayload } from '../../lib/api';
import { ProbabilityMovementTimeline } from '../tactical/ProbabilityMovementTimeline';
import type { ProbabilityData } from '../../lib/api';
import { useI18n } from '../../lib/i18n/I18nContext';
import { pct } from '../../lib/format';
import { DataKindBadge, DataKindMark, DataKindLegend } from '../ui/DataKindBadge';

type Props = {
  matchId: string;
  prob: ProbabilityData | null;
  currentMinute?: number;
  /** When provided, skips duplicate API fetch (shared from match page). */
  movement?: ProbabilityMovementPayload | null;
};

function eventTitle(label: string, t: ReturnType<typeof useI18n>['t']) {
  if (label === 'baseline') return t('probMovement.baseline');
  const n = label.replace('update-', '');
  return t('probMovement.update').replace('{n}', n);
}

function eventReason(code: 'baseline' | 'live' | 'recalc', t: ReturnType<typeof useI18n>['t']) {
  if (code === 'baseline') return t('probMovement.reasonBaseline');
  if (code === 'live') return t('probMovement.reasonLive');
  return t('probMovement.reasonRecalc');
}

function probChanged(before: number, after: number) {
  return Math.abs(before - after) >= 0.005;
}

export function ProbabilityMovementPanel({
  matchId,
  prob,
  currentMinute = 0,
  movement: movementProp,
}: Props) {
  const { t } = useI18n();
  const [movementLocal, setMovementLocal] = useState<ProbabilityMovementPayload | null>(null);
  const sharedMovement = movementProp !== undefined;
  const movement = sharedMovement ? movementProp : movementLocal;

  useEffect(() => {
    if (sharedMovement || !matchId) return;
    const load = () => {
      api
        .matchProbabilityMovement(matchId)
        .then((r) => setMovementLocal(r.data))
        .catch(() => setMovementLocal(null));
    };
    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [matchId, prob?.homeWinProb, prob?.drawProb, prob?.awayWinProb, sharedMovement]);

  const meaningfulEvents = useMemo(() => {
    if (!movement?.events.length) return [];
    return movement.events.filter(
      (e, i) =>
        i === 0 ||
        probChanged(e.homeWinBefore, e.homeWinAfter) ||
        probChanged(e.drawBefore, e.drawAfter) ||
        probChanged(e.awayBefore, e.awayAfter),
    );
  }, [movement]);

  const hasIntervals =
    prob?.intervalDistribution && Object.keys(prob.intervalDistribution).length > 0;

  return (
    <section className="panel space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="label-tactical text-cyan">{t('probMovement.title')}</h2>
          <DataKindBadge kind="predicted" compact />
        </div>
        <p className="mt-2 text-sm leading-relaxed text-foreground/80">{t('probMovement.explain')}</p>
        <DataKindLegend className="mt-2" />
      </div>

      {meaningfulEvents.length > 1 ? (
        <ul className="space-y-2 text-sm">
          {meaningfulEvents.map((e, i) => (
            <li
              key={`${e.timestamp}-${i}`}
              className="rounded-lg border border-border/40 px-3 py-3 text-foreground/90"
            >
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-semibold text-cyan">{eventTitle(e.label, t)}</span>
                <span className="text-foreground/60">·</span>
                <span className="text-foreground/75">{eventReason(e.reasonCode, t)}</span>
              </div>
              <p className="mt-2 font-mono-data text-sm leading-relaxed">
                {t('common.abbrHome')} {pct(e.homeWinBefore)} → {pct(e.homeWinAfter)}
                {' · '}
                {t('common.abbrDraw')} {pct(e.drawBefore)} → {pct(e.drawAfter)}
                {' · '}
                {t('common.abbrAway')} {pct(e.awayBefore)} → {pct(e.awayAfter)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-border/40 bg-panel2/40 px-3 py-3 text-sm text-foreground/75">
          {t('probMovement.stable')}
          {meaningfulEvents.length === 1 && prob && (
            <span className="mt-2 block font-mono-data text-foreground">
              {t('common.abbrHome')} {pct(prob.homeWinProb)} · {t('common.abbrDraw')}{' '}
              {pct(prob.drawProb)} · {t('common.abbrAway')} {pct(prob.awayWinProb)}
            </span>
          )}
        </p>
      )}

      {hasIntervals && prob?.intervalDistribution ? (
        <ProbabilityMovementTimeline
          intervals={prob.intervalDistribution as Record<
            string,
            { homeWinProb: number; drawProb: number; awayWinProb: number }
          >}
          currentMinute={currentMinute}
        />
      ) : (
        <p className="text-sm text-foreground/70">{t('probMovement.intervalEmpty')}</p>
      )}
    </section>
  );
}
