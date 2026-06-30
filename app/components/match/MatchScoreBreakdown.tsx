import type { MatchScoreDetail } from '../../lib/api';
import { useI18n } from '../../lib/i18n/I18nContext';

type Props = {
  detail: MatchScoreDetail | null | undefined;
  variant?: 'inline' | 'stacked';
  className?: string;
};

function formatPair(pair: { home: number; away: number }): string {
  return `${pair.home}–${pair.away}`;
}

export function MatchScoreBreakdown({ detail, variant = 'inline', className = '' }: Props) {
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
    chips.push(`${t('match.score.stoppage')} +${detail.stoppage.firstHalf}'`);
  }
  if (detail.stoppage?.secondHalf) {
    chips.push(`${t('match.score.stoppage')} +${detail.stoppage.secondHalf}'`);
  }
  if (detail.extraTime) {
    chips.push(`${t('match.score.extraTime')} ${formatPair(detail.extraTime)}`);
  }
  if (detail.stoppage?.extraTimeFirst) {
    chips.push(`${t('match.score.stoppage')} +${detail.stoppage.extraTimeFirst}'`);
  }
  if (detail.stoppage?.extraTimeSecond) {
    chips.push(`${t('match.score.stoppage')} +${detail.stoppage.extraTimeSecond}'`);
  }
  if (detail.penalties) {
    chips.push(`${t('match.score.penalties')} ${formatPair(detail.penalties)}`);
  }

  if (!chips.length) return null;

  return (
    <span className={`font-mono-data text-[10px] text-muted sm:text-[11px] ${className}`}>
      {chips.join(' · ')}
    </span>
  );
}
