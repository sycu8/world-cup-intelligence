import type { MatchPredictionScenario } from '../../lib/api';
import { pct } from '../../lib/format';
import { useI18n } from '../../lib/i18n/I18nContext';
import { formatScenarioMetricValue } from '../../lib/i18n/scenarioPredictionLabels';

export function ScenarioConditionList({
  title,
  items,
}: {
  title: string;
  items: MatchPredictionScenario['initialConditions'];
}) {
  const { mode } = useI18n();

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</p>
      <ul className="mt-2 space-y-1 text-sm text-foreground/90">
        {items.map((c, i) => (
          <li key={i} className="rounded border border-border/40 bg-background/30 px-2 py-1">
            {c.condition}:{' '}
            <span className="font-mono-data text-cyan">{formatScenarioMetricValue(c.value, mode)}</span>
            {typeof c.confidence === 'number' && (
              <span className="ml-2 text-xs text-muted">({pct(c.confidence)})</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
