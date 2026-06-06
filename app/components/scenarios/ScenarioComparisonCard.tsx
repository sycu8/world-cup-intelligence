import type { MatchScenarioSet } from '../../lib/api';
import { pct } from '../../lib/format';
import { useI18n } from '../../lib/i18n/I18nContext';

type Props = {
  data: MatchScenarioSet | null;
  homeName?: string;
  awayName?: string;
};

export function ScenarioComparisonCard({ data, homeName = '', awayName = '' }: Props) {
  const { t } = useI18n();
  if (!data?.comparison) return null;
  const { comparison } = data;
  const awayLabel = awayName || t('common.away');

  return (
    <div className="rounded-card border border-cyan/25 bg-cyan/5 p-4">
      <p className="label-tactical text-cyan">{t('scenario.comparisonTitle')}</p>
      <p className="mt-2 text-sm leading-relaxed text-foreground/90">{comparison.summary}</p>
      <ul className="mt-3 space-y-1 text-xs text-muted">
        {comparison.keyDifferences.slice(0, 4).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="mt-3 font-mono-data text-xs text-muted-dim">
        {t('scenario.likelihoodGap')} {pct(comparison.probabilityGap)} · {t('scenario.awayWinDelta')}{' '}
        {pct(Math.abs(comparison.awayWinDelta))}
        {awayLabel !== t('common.away') ? ` (${awayLabel})` : ''}
      </p>
    </div>
  );
}
