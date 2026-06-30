import { pctCompact } from '../../lib/format';
import { useI18n } from '../../lib/i18n/I18nContext';
import {
  KNOCKOUT_ET_DISPLAY_MIN,
  KNOCKOUT_PEN_DISPLAY_MIN,
} from '@/models/probability/knockoutForecast';

type Props = {
  extraTimeProb?: number;
  penaltyProb?: number;
  className?: string;
};

/** Knockout-only forecast chips for extra time / penalties (pre-match). */
export function MatchForecastExtras({ extraTimeProb, penaltyProb, className = '' }: Props) {
  const { t } = useI18n();
  const showEt = extraTimeProb != null && extraTimeProb >= KNOCKOUT_ET_DISPLAY_MIN;
  const showPen = penaltyProb != null && penaltyProb >= KNOCKOUT_PEN_DISPLAY_MIN;
  if (!showEt && !showPen) return null;

  return (
    <span className={`flex flex-col items-end gap-0.5 ${className}`}>
      {showEt && (
        <span
          className="whitespace-nowrap font-mono-data text-[9px] leading-none text-yellow/85"
          title={t('match.forecast.extraTimeHint')}
        >
          {t('match.forecast.extraTime').replace('{pct}', pctCompact(extraTimeProb!))}
        </span>
      )}
      {showPen && (
        <span
          className="whitespace-nowrap font-mono-data text-[9px] leading-none text-yellow/70"
          title={t('match.forecast.penaltyHint')}
        >
          {t('match.forecast.penalty').replace('{pct}', pctCompact(penaltyProb!))}
        </span>
      )}
    </span>
  );
}
