import { pct } from '../../lib/format';
import type { ScenarioItem } from '../../lib/api';
import { useI18n } from '../../lib/i18n/I18nContext';
import { scenarioTypeLabel } from '../../lib/i18n/termLabels';
import { legacyFactorLabel } from '../../lib/i18n/scenarioPredictionLabels';

export function ScenarioCard({ scenario }: { scenario: ScenarioItem }) {
  const { t, mode } = useI18n();
  const label = scenarioTypeLabel(scenario.scenarioType, mode);

  return (
    <div className="rounded-card border border-border/50 bg-panel2/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-base font-medium text-foreground">{label}</p>
        <span className="font-mono-data text-base font-semibold text-magenta">{pct(scenario.probability)}</span>
      </div>
      <p className="mt-1 text-sm text-foreground/70">
        {t('scenario.confidence')} {pct(scenario.confidence)}
      </p>
      {scenario.explanationFactors[0] && (
        <p className="mt-2 text-xs text-foreground/80">
          {legacyFactorLabel(scenario.explanationFactors[0], mode)}
        </p>
      )}
    </div>
  );
}
