import type { MatchPredictionScenario } from '../../lib/api';
import { pct } from '../../lib/format';
import { useI18n } from '../../lib/i18n/I18nContext';

export function ScenarioConfidenceBadge({ value }: { value: number }) {
  const { t } = useI18n();
  const tone =
    value >= 0.75
      ? 'border-green/40 bg-green/10 text-green'
      : value >= 0.55
        ? 'border-cyan/40 bg-cyan/10 text-cyan'
        : 'border-yellow/40 bg-yellow/10 text-yellow';
  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone}`}>
      {t('scenario.modelConfidence')} {pct(value)}
    </span>
  );
}

export function ScenarioConfidenceInline({ scenario }: { scenario: MatchPredictionScenario }) {
  return <ScenarioConfidenceBadge value={scenario.scenarioConfidence} />;
}
