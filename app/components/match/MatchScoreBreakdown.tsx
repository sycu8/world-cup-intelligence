import type { MatchScoreDetail } from '../../lib/api';
import { useI18n } from '../../lib/i18n/I18nContext';

type Props = {
  detail: MatchScoreDetail | null | undefined;
  variant?: 'inline' | 'stacked';
  compact?: boolean;
  className?: string;
};

function formatPair(pair: { home: number; away: number }): string {
  return `${pair.home}–${pair.away}`;
}

export function MatchScoreBreakdown({
  detail,
  variant = 'inline',
  compact = false,
  className = '',
}: Props) {
  const { t } = useI18n();
  if (!detail) return null;

  const chips: string[] = [];

  if (detail.ht) {
    chips.push(`${t('match.score.half1')} ${formatPair(detail.ht)}`);
  }
  if (detail.secondHalf) {
    chips.push(`${t('match.score.half2')} ${formatPair(detail.secondHalf)}`);
  }
  if (detail.stoppage?.firstHalf) {
    chips.push(
      compact
        ? `+${detail.stoppage.firstHalf}'`
        : `${t('match.score.stoppage')} +${detail.stoppage.firstHalf}'`,
    );
  }
  if (detail.stoppage?.secondHalf) {
    chips.push(
      compact
        ? `+${detail.stoppage.secondHalf}'`
        : `${t('match.score.stoppage')} +${detail.stoppage.secondHalf}'`,
    );
  }
  if (detail.extraTime) {
    chips.push(`${t('match.score.extraTime')} ${formatPair(detail.extraTime)}`);
  }
  if (detail.stoppage?.extraTimeFirst) {
    chips.push(
      compact
        ? `+${detail.stoppage.extraTimeFirst}'`
        : `${t('match.score.stoppage')} +${detail.stoppage.extraTimeFirst}'`,
    );
  }
  if (detail.stoppage?.extraTimeSecond) {
    chips.push(
      compact
        ? `+${detail.stoppage.extraTimeSecond}'`
        : `${t('match.score.stoppage')} +${detail.stoppage.extraTimeSecond}'`,
    );
  }
  if (detail.penalties) {
    chips.push(`${t('match.score.penalties')} ${formatPair(detail.penalties)}`);
  }

  if (!chips.length) return null;

  if (variant === 'stacked') {
    return (
      <div
        className={`flex flex-wrap items-center justify-end gap-x-1.5 gap-y-0.5 font-mono-data text-[9px] leading-snug text-muted sm:text-[10px] ${className}`}
      >
        {chips.map((chip, i) => (
          <span key={`${i}-${chip}`} className="whitespace-nowrap">
            {i > 0 && <span className="mr-1.5 text-muted/35" aria-hidden>·</span>}
            {chip}
          </span>
        ))}
      </div>
    );
  }

  return (
    <span
      className={`inline-flex max-w-full flex-wrap items-center justify-end gap-x-1.5 gap-y-0.5 font-mono-data text-[10px] leading-snug text-muted sm:text-[11px] ${className}`}
    >
      {chips.map((chip, i) => (
        <span key={`${i}-${chip}`} className="whitespace-nowrap">
          {i > 0 && <span className="mr-1.5 text-muted/35" aria-hidden>·</span>}
          {chip}
        </span>
      ))}
    </span>
  );
}
