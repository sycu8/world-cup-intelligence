import { Link } from 'react-router-dom';
import type { PredictionAccuracyReport, UpcomingProbabilityVerification } from '../../lib/api';
import { pct } from '../../lib/format';
import { resolveMatchHref } from '../../lib/matchPaths';
import { useI18n } from '../../lib/i18n/I18nContext';
import { Bilingual } from '../i18n/Bilingual';

type Props = {
  accuracy: PredictionAccuracyReport | null;
  upcoming: UpcomingProbabilityVerification | null;
  loading?: boolean;
};

function outcomeLabel(
  outcome: 'home' | 'draw' | 'away',
  homeName: string,
  awayName: string,
  t: ReturnType<typeof useI18n>['t'],
) {
  if (outcome === 'home') return homeName;
  if (outcome === 'away') return awayName;
  return t('common.draws');
}

export function PredictionAccuracyPanel({ accuracy, upcoming, loading = false }: Props) {
  const { t } = useI18n();

  if (loading && !accuracy) {
    return (
      <section className="panel-dense animate-pulse space-y-3" aria-hidden>
        <div className="h-4 w-48 rounded bg-panel2/60" />
        <div className="h-16 rounded-lg bg-panel2/30" />
      </section>
    );
  }

  if (!accuracy || accuracy.completedWithSnapshot === 0) return null;

  const hitRate = accuracy.favoriteHitRate != null ? pct(accuracy.favoriteHitRate) : '—';
  const scoreRate = accuracy.scorelineHitRate != null ? pct(accuracy.scorelineHitRate) : '—';
  const top3Rate = accuracy.scorelineTop3HitRate != null ? pct(accuracy.scorelineTop3HitRate) : '—';
  const brier = accuracy.avgBrier != null ? accuracy.avgBrier.toFixed(3) : '—';

  return (
    <section className="panel-dense space-y-4">
      <div>
        <p className="label-tactical text-cyan">
          <Bilingual k="home.predictionAccuracy.title" />
        </p>
        <p className="mt-1 text-sm text-muted">
          <Bilingual k="home.predictionAccuracy.subtitle" />
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-lg border border-border/50 bg-panel2/30 px-3 py-2 text-center">
          <p className="font-heading text-xl text-foreground">{hitRate}</p>
          <p className="mt-1 text-[11px] text-muted">
            {t('home.predictionAccuracy.favoriteHit').replace(
              '{n}',
              String(accuracy.favoriteHits),
            ).replace('{total}', String(accuracy.completedWithSnapshot))}
          </p>
        </div>
        <div className="rounded-lg border border-border/50 bg-panel2/30 px-3 py-2 text-center">
          <p className="font-heading text-xl text-foreground">{scoreRate}</p>
          <p className="mt-1 text-[11px] text-muted">{t('home.predictionAccuracy.scorelineHit')}</p>
        </div>
        <div className="rounded-lg border border-border/50 bg-panel2/30 px-3 py-2 text-center">
          <p className="font-heading text-xl text-foreground">{top3Rate}</p>
          <p className="mt-1 text-[11px] text-muted">{t('home.predictionAccuracy.scorelineTop3Hit')}</p>
        </div>
        <div className="rounded-lg border border-border/50 bg-panel2/30 px-3 py-2 text-center">
          <p className="font-heading text-xl text-foreground">{brier}</p>
          <p className="mt-1 text-[11px] text-muted">{t('home.predictionAccuracy.avgBrier')}</p>
        </div>
        <div className="col-span-2 rounded-lg border border-border/50 bg-panel2/30 px-3 py-2 text-center sm:col-span-1">
          <p className="font-heading text-xl text-foreground">{accuracy.completedWithSnapshot}</p>
          <p className="mt-1 text-[11px] text-muted">{t('home.predictionAccuracy.evaluated')}</p>
        </div>
      </div>

      {accuracy.recent.length > 0 && (
        <ul className="space-y-1.5">
          {accuracy.recent.slice(0, 5).map((row) => (
            <li key={row.matchId}>
              <Link
                to={resolveMatchHref({ id: row.matchId, slug: row.matchId })}
                className="flex items-center justify-between gap-2 rounded-md border border-border/40 bg-panel2/20 px-2 py-1.5 text-xs hover:border-cyan/30"
              >
                <span className="min-w-0 truncate text-foreground/90">
                  {row.homeName} {row.actualScore} {row.awayName}
                </span>
                <span
                  className={`shrink-0 font-mono-data text-[10px] ${
                    row.favoriteHit ? 'text-defending' : 'text-muted'
                  }`}
                >
                  {row.favoriteHit ? '✓' : '✗'}{' '}
                  {outcomeLabel(row.predictedOutcome, row.homeName, row.awayName, t)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {upcoming && upcoming.upcomingTotal > 0 && (
        <div className="border-t border-border/40 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-pressing">
            {t('home.predictionAccuracy.upcomingTitle')}
          </p>
          <p className="mt-1 text-sm text-muted">
            {t('home.predictionAccuracy.upcomingCoverage')
              .replace('{with}', String(upcoming.withProbability))
              .replace('{total}', String(upcoming.upcomingTotal))}
          </p>
          <ul className="mt-2 space-y-1">
            {upcoming.matches.slice(0, 4).map((m) => (
              <li key={m.matchId} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="min-w-0 truncate text-muted">
                  {m.homeName} – {m.awayName}
                </span>
                {m.hasProbability ? (
                  <span className="shrink-0 font-mono-data tabular-nums text-foreground/80">
                    {pct(m.homeWin!)} · {pct(m.draw!)} · {pct(m.awayWin!)}
                  </span>
                ) : (
                  <span className="shrink-0 italic text-muted-dim">{t('compactProb.noAnalysis')}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[11px] text-muted-dim">
        {t('home.predictionAccuracy.disclaimer')}
      </p>
    </section>
  );
}
