import { useMemo } from 'react';
import type { MatchPredictionScenario, MatchScenarioSet } from '../../lib/api';
import { pct } from '../../lib/format';
import { ScenarioProbabilityBar } from './ScenarioProbabilityBar';
import { ScenarioConfidenceInline } from './ScenarioConfidenceBadge';
import { ScenarioConditionList } from './ScenarioConditionList';
import { ScenarioTriggerStatus } from './ScenarioTriggerStatus';
import { ScenarioComparisonCard } from './ScenarioComparisonCard';
import { ScenarioRealtimeTimeline } from './ScenarioRealtimeTimeline';
import { useI18n } from '../../lib/i18n/I18nContext';
import { localizeScenarioSet } from '../../lib/i18n/scenarioPredictionLabels';

function ScenarioCard({
  scenario,
  label,
  homeName,
  awayName,
}: {
  scenario: MatchPredictionScenario;
  label: string;
  homeName: string;
  awayName: string;
}) {
  const { t } = useI18n();
  const homeLabel = homeName || t('common.home');
  const awayLabel = awayName || t('common.away');

  return (
    <article className="rounded-card border border-border/50 bg-panel2/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
          <h3 className="font-heading text-lg text-foreground">{scenario.scenarioName}</h3>
        </div>
        <ScenarioConfidenceInline scenario={scenario} />
      </div>

      <div className="mt-4 space-y-3">
        <ScenarioProbabilityBar
          label={t('scenario.likelihoodLabel')}
          value={scenario.scenarioProbability}
        />
        <p className="font-mono-data text-sm text-foreground">
          {homeLabel} {pct(scenario.homeWinProb)} · {t('common.draw')} {pct(scenario.drawProb)} ·{' '}
          {awayLabel} {pct(scenario.awayWinProb)}
        </p>
        <p className="text-sm text-muted">
          {t('scenario.mostLikelyScore')}:{' '}
          <span className="font-mono-data text-yellow">{scenario.mostLikelyScore}</span>
        </p>
      </div>

      {scenario.keyDrivers.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-foreground/85">
          {scenario.keyDrivers.slice(0, 3).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}

      <div className="mt-4 space-y-4">
        <ScenarioConditionList title={t('scenario.initialConditions')} items={scenario.initialConditions} />
        <ScenarioTriggerStatus scenario={scenario} />
      </div>
    </article>
  );
}

type Props = {
  data: MatchScenarioSet | null;
  loading?: boolean;
  homeName?: string;
  awayName?: string;
};

export function ScenarioPredictionPanel({ data, loading, homeName = '', awayName = '' }: Props) {
  const { t, mode } = useI18n();
  const localized = useMemo(
    () => (data ? localizeScenarioSet(data, mode, homeName, awayName) : null),
    [data, mode, homeName, awayName],
  );

  if (loading) return <div className="panel-dense text-sm text-muted">{t('scenario.loading')}</div>;
  if (!localized?.scenarios?.length) {
    return <div className="panel-dense text-sm text-muted">{t('scenario.empty')}</div>;
  }

  const baseline = localized.scenarios.find((s) => s.isBaseline) ?? localized.scenarios[0];
  const alternative = localized.scenarios.find((s) => s.id !== baseline.id) ?? localized.scenarios[1];

  return (
    <section className="panel-elevated space-y-5 border-magenta/20">
      <div>
        <h2 className="label-tactical text-magenta">{t('scenario.predictionTitle')}</h2>
        <p className="mt-1 text-xs text-muted">{t('scenario.predictionSubtitle')}</p>
        <ScenarioRealtimeTimeline updatedAt={localized.updatedAt} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ScenarioCard scenario={baseline} label={t('scenario.pathA')} homeName={homeName} awayName={awayName} />
        {alternative && (
          <ScenarioCard
            scenario={alternative}
            label={t('scenario.pathB')}
            homeName={homeName}
            awayName={awayName}
          />
        )}
      </div>

      <details className="md:hidden">
        <summary className="cursor-pointer text-sm text-cyan">{t('scenario.comparisonToggle')}</summary>
        <div className="mt-3">
          <ScenarioComparisonCard data={localized} homeName={homeName} awayName={awayName} />
        </div>
      </details>
      <div className="hidden md:block">
        <ScenarioComparisonCard data={localized} homeName={homeName} awayName={awayName} />
      </div>
    </section>
  );
}
