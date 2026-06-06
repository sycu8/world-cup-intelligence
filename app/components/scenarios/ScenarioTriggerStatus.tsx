import type { MatchPredictionScenario } from '../../lib/api';
import { useI18n } from '../../lib/i18n/I18nContext';
import { formatScenarioMetricValue, scenarioStatusLabel } from '../../lib/i18n/scenarioPredictionLabels';

const statusClass: Record<string, string> = {
  not_triggered: 'border-border/50 text-muted',
  partially_triggered: 'border-yellow/40 text-yellow',
  triggered: 'border-green/40 text-green',
  valid: 'border-cyan/40 text-cyan',
  at_risk: 'border-yellow/40 text-yellow',
  invalidated: 'border-magenta/40 text-magenta',
};

export function ScenarioTriggerStatus({ scenario }: { scenario: MatchPredictionScenario }) {
  const { t, mode } = useI18n();

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">{t('scenario.triggers')}</p>
        <ul className="mt-2 space-y-1">
          {scenario.triggerConditions.map((trow, i) => (
            <li
              key={i}
              className={`rounded border px-2 py-1 text-xs ${statusClass[trow.status] ?? statusClass.not_triggered}`}
            >
              {trow.condition} ({String(trow.threshold)})
              {trow.currentValue !== undefined && (
                <span className="ml-1 text-muted">
                  · {formatScenarioMetricValue(trow.currentValue, mode)}
                </span>
              )}
              <span className="ml-1 opacity-80">— {scenarioStatusLabel(trow.status, mode)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">{t('scenario.invalidation')}</p>
        <ul className="mt-2 space-y-1">
          {scenario.invalidationConditions.map((trow, i) => (
            <li
              key={i}
              className={`rounded border px-2 py-1 text-xs ${statusClass[trow.status] ?? statusClass.valid}`}
            >
              {trow.condition}
              {trow.threshold !== undefined && (
                <span className="text-muted"> ({String(trow.threshold)})</span>
              )}
              <span className="ml-1 opacity-80">— {scenarioStatusLabel(trow.status, mode)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
