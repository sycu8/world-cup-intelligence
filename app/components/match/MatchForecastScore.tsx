import { DataKindBadge } from '../ui/DataKindBadge';
import { useI18n } from '../../lib/i18n/I18nContext';

type Props = {
  score: string;
  showLabel?: boolean;
  className?: string;
};

/** Predicted scoreline for fixtures not yet played — always marked as forecast. */
export function MatchForecastScore({ score, showLabel = false, className = '' }: Props) {
  const { t } = useI18n();
  const display = score.replace('-', '–');

  return (
    <span className={`inline-flex flex-col items-end gap-0.5 ${className}`}>
      <span
        className="inline-flex items-center gap-1 rounded-md border border-yellow/35 bg-yellow/10 px-1.5 py-0.5 font-mono-data text-[10px] tabular-nums leading-none text-yellow sm:text-[11px]"
        title={`${t('dataKind.predicted')}: ${display}`}
      >
        <DataKindBadge kind="predicted" compact />
        <span>{display}</span>
      </span>
      {showLabel && (
        <span className="text-[8px] font-medium uppercase tracking-wide text-yellow/80">
          {t('dataKind.predicted')}
        </span>
      )}
    </span>
  );
}
