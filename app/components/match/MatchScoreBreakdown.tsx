import type { MatchScoreDetail } from '../../lib/api';
import { useI18n } from '../../lib/i18n/I18nContext';
import type { LocaleKey } from '../../lib/i18n/locales';

type Props = {
  detail: MatchScoreDetail | null | undefined;
  variant?: 'inline' | 'stacked';
  compact?: boolean;
  className?: string;
};

type PeriodSegment = {
  labelKey: LocaleKey;
  score?: { home: number; away: number };
  stoppage?: number;
};

function formatPair(pair: { home: number; away: number }): string {
  return `${pair.home}–${pair.away}`;
}

function hasScore(score?: { home: number; away: number }): boolean {
  return score != null && Number.isFinite(score.home) && Number.isFinite(score.away);
}

function buildSegments(detail: MatchScoreDetail): PeriodSegment[] {
  const segments: PeriodSegment[] = [];

  if (detail.ht || detail.stoppage?.firstHalf) {
    segments.push({
      labelKey: 'match.score.half1',
      score: detail.ht,
      stoppage: detail.stoppage?.firstHalf,
    });
  }
  if (detail.secondHalf || detail.stoppage?.secondHalf) {
    segments.push({
      labelKey: 'match.score.half2',
      score: detail.secondHalf,
      stoppage: detail.stoppage?.secondHalf,
    });
  }

  const hasEtSplit =
    detail.extraTime1 ||
    detail.extraTime2 ||
    detail.stoppage?.extraTimeFirst ||
    detail.stoppage?.extraTimeSecond;

  if (hasEtSplit) {
    if (detail.extraTime1 || detail.stoppage?.extraTimeFirst) {
      segments.push({
        labelKey: 'match.score.extraTime1',
        score: detail.extraTime1,
        stoppage: detail.stoppage?.extraTimeFirst,
      });
    }
    if (detail.extraTime2 || detail.stoppage?.extraTimeSecond) {
      segments.push({
        labelKey: 'match.score.extraTime2',
        score: detail.extraTime2,
        stoppage: detail.stoppage?.extraTimeSecond,
      });
    }
  } else if (detail.extraTime) {
    segments.push({ labelKey: 'match.score.extraTime', score: detail.extraTime });
  }

  if (detail.penalties) {
    segments.push({ labelKey: 'match.score.penalties', score: detail.penalties });
  }

  return segments;
}

function formatSegment(
  segment: PeriodSegment,
  t: (key: LocaleKey) => string,
  compact: boolean,
): string | null {
  const label = t(segment.labelKey);
  const showScore = hasScore(segment.score);
  const showStoppage = segment.stoppage != null && segment.stoppage > 0;

  if (!showScore && !showStoppage) return null;

  let text = label;
  if (showScore && segment.score) {
    text += ` ${formatPair(segment.score)}`;
  }
  if (showStoppage) {
    const stop = compact
      ? `+${segment.stoppage}'`
      : `${t('match.score.stoppage')} +${segment.stoppage}'`;
    text += ` (${stop})`;
  }
  return text;
}

function renderChips(
  chips: string[],
  variant: 'inline' | 'stacked',
  className: string,
) {
  const baseClass =
    variant === 'stacked'
      ? `flex flex-wrap items-center justify-end gap-x-1.5 gap-y-0.5 font-mono-data text-[9px] leading-snug text-muted sm:text-[10px] ${className}`
      : `inline-flex max-w-full flex-wrap items-center justify-end gap-x-1.5 gap-y-0.5 font-mono-data text-[10px] leading-snug text-muted sm:text-[11px] ${className}`;

  const Tag = variant === 'stacked' ? 'div' : 'span';

  return (
    <Tag className={baseClass}>
      {chips.map((chip, i) => (
        <span key={`${i}-${chip}`} className="whitespace-nowrap">
          {i > 0 && <span className="mr-1.5 text-muted/35" aria-hidden>·</span>}
          {chip}
        </span>
      ))}
    </Tag>
  );
}

export function MatchScoreBreakdown({
  detail,
  variant = 'inline',
  compact = false,
  className = '',
}: Props) {
  const { t } = useI18n();
  if (!detail) return null;

  const chips = buildSegments(detail)
    .map((segment) => formatSegment(segment, t, compact))
    .filter((chip): chip is string => !!chip);

  if (!chips.length) return null;

  return renderChips(chips, variant, className);
}
