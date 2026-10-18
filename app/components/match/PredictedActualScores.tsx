import { formatScoreline, normalizeScorelineKey } from '../../lib/format';
import { useI18n } from '../../lib/i18n/I18nContext';
import { DataKindBadge, DataKindMark } from '../ui/DataKindBadge';

type Props = {
  predicted?: string | null;
  homeScore?: number;
  awayScore?: number;
  status?: string;
  layout?: 'stacked' | 'inline';
  size?: 'sm' | 'lg';
};

export function PredictedActualScores({
  predicted,
  homeScore,
  awayScore,
  status,
  layout = 'stacked',
  size = 'lg',
}: Props) {
  const { t } = useI18n();
  const isFinal = status === 'completed' || status === 'finished';
  const isLive = status === 'live';
  const hasActual =
    (isLive || isFinal) && homeScore != null && awayScore != null;
  const actual = hasActual ? formatScoreline(homeScore!, awayScore!) : null;
  const predictedKey = predicted ? normalizeScorelineKey(predicted) : null;
  const matched = isFinal && actual != null && predictedKey != null && actual === predictedKey;
  const showPredicted = !!predicted && !isFinal && !isLive;

  const scoreClass =
    size === 'lg' ? 'font-display text-2xl tabular-nums' : 'font-mono-data text-xs tabular-nums';

  if (layout === 'inline') {
    if (isFinal && actual) {
      return (
        <span className="inline-flex flex-wrap items-center gap-1.5 font-mono-data text-xs">
          <span className="font-semibold text-foreground" title={t('prediction.actualScore')}>
            <DataKindMark kind="actual" />
            {actual}
          </span>
          {matched && (
            <span className="rounded border border-lime/40 bg-lime/10 px-1 py-0.5 text-[10px] text-lime">
              {t('prediction.scoreMatch')}
            </span>
          )}
        </span>
      );
    }

    return (
      <span className="inline-flex flex-wrap items-center gap-1.5 font-mono-data text-xs">
        {showPredicted && (
          <span className="text-yellow" title={t('prediction.predictedScore')}>
            <DataKindMark />
            {predicted}
          </span>
        )}
        {actual && (
          <>
            {showPredicted && <span className="text-muted/60">→</span>}
            <span
              className={`font-semibold ${isLive ? 'text-live' : 'text-foreground'}`}
              title={t('prediction.actualScore')}
            >
              <DataKindMark kind="actual" />
              {actual}
              {isLive && <span className="ml-1 text-[10px] uppercase text-live">LIVE</span>}
            </span>
          </>
        )}
      </span>
    );
  }

  if (isFinal && actual) {
    return (
      <div>
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <DataKindBadge kind="actual" compact />
          {t('prediction.actualScore')}
        </p>
        <p className={`mt-1 text-foreground ${scoreClass}`}>
          <DataKindMark kind="actual" />
          {actual}
        </p>
        {matched && (
          <p className="mt-1 text-[11px] text-lime">{t('prediction.scoreMatch')}</p>
        )}
        {!matched && predicted && (
          <p className="mt-1 text-[11px] text-muted">
            {t('prediction.scoreDiff')} ({predicted})
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={hasActual ? 'grid grid-cols-2 gap-2' : ''}>
      {showPredicted && (
        <div>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <DataKindBadge kind="predicted" compact />
            {t('prediction.predictedScore')}
          </p>
          <p className={`mt-1 text-yellow ${scoreClass}`}>
            <DataKindMark />
            {predicted}
          </p>
        </div>
      )}
      {actual && (
        <div>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <DataKindBadge kind="actual" compact />
            {isLive ? t('prediction.liveScore') : t('prediction.actualScore')}
          </p>
          <p className={`mt-1 ${scoreClass} ${isLive ? 'text-live' : 'text-foreground'}`}>
            <DataKindMark kind="actual" />
            {actual}
          </p>
        </div>
      )}
    </div>
  );
}
