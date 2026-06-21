import { SectionLabel } from './SectionLabel';
import { useI18n } from '../../lib/i18n/I18nContext';
import { normalizeScorelineKey } from '../../lib/format';
import { scorelinesForMatrixDisplay } from '../../lib/scorelineMatrix';
import { DataKindLegend, DataKindMark } from '../ui/DataKindBadge';

type Props = {
  distribution: Record<string, number>;
  highlight?: string;
  actualScore?: string;
  actualLive?: boolean;
};

export function ScorelineMatrix({ distribution, highlight, actualScore, actualLive }: Props) {
  const { t } = useI18n();
  const predictedKey = highlight ? normalizeScorelineKey(highlight) : null;
  const actualKey = actualScore ? normalizeScorelineKey(actualScore) : null;
  const keys = scorelinesForMatrixDisplay(distribution, { highlight, actualScore });
  const visibleProbs = keys.map((k) => distribution[k] ?? 0);
  const max = Math.max(...visibleProbs, 0.001);

  return (
    <div className="panel-dense overflow-x-auto">
      <SectionLabel title={t('matrix.title')} subtitle={t('matrix.subtitle')} accent="magenta" dataKind="predicted" />
      <DataKindLegend className="mb-3" />
      <div className="inline-grid min-w-max grid-cols-4 gap-1.5 sm:grid-cols-6 md:grid-cols-7">
        {keys.map((k) => {
          const p = distribution[k];
          const intensity = p / max;
          const isPredicted = predictedKey != null && k === predictedKey;
          const isActual = actualKey != null && k === actualKey;
          return (
            <div
              key={k}
              className={`relative rounded-card border px-2 py-2 text-center transition ${
                isPredicted && isActual
                  ? 'border-lime/50 bg-lime/10 shadow-glow-cyan'
                  : isPredicted
                    ? 'border-yellow/50 bg-yellow/10 shadow-glow-cyan'
                    : isActual
                      ? 'border-cyan/50 bg-cyan/10'
                      : 'border-border/40 bg-panel2/50'
              }`}
              style={{
                boxShadow:
                  isPredicted || isActual
                    ? undefined
                    : `inset 0 0 20px rgba(0,229,255,${intensity * 0.15})`,
              }}
            >
              {isActual && (
                <span
                  className={`absolute -right-1 -top-1 rounded px-1 text-[8px] font-bold uppercase ${
                    actualLive ? 'bg-live/90 text-background' : 'bg-cyan/90 text-background'
                  }`}
                >
                  {actualLive ? t('common.live') : `● ${t('dataKind.actual')}`}
                </span>
              )}
              {isPredicted && (
                <span className="absolute -right-1 -top-1 rounded bg-yellow/90 px-1 text-[8px] font-bold uppercase text-background">
                  {t('dataKind.predicted')}
                </span>
              )}
              <div
                className={`font-heading text-lg ${
                  isPredicted ? 'text-yellow' : isActual ? 'text-cyan' : 'text-foreground'
                }`}
              >
                {k}
              </div>
              <div className="font-mono-data text-[10px] text-muted">
                <DataKindMark />{(p * 100).toFixed(1)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
