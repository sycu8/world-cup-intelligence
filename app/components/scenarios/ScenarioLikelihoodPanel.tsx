import type { ScenariosPayload } from '../../lib/api';
import { useI18n } from '../../lib/i18n/I18nContext';
import { ScenarioCard } from './ScenarioCard';

type Props = { data: ScenariosPayload | null; loading?: boolean };

export function ScenarioLikelihoodPanel({ data, loading }: Props) {
  const { t } = useI18n();

  if (loading) return <div className="panel-dense text-sm text-muted">{t('scenario.loading')}</div>;
  if (!data?.scenarios.length) {
    return <div className="panel-dense text-sm text-muted">{t('scenario.empty')}</div>;
  }

  return (
    <section className="panel-elevated space-y-4">
      <div>
        <h2 className="label-tactical text-magenta">{t('scenario.title')}</h2>
        <p className="mt-1 text-xs text-muted">{t('scenario.legacyDisclaimer')}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {data.scenarios.map((s) => (
          <ScenarioCard key={s.scenarioType} scenario={s} />
        ))}
      </div>
    </section>
  );
}
