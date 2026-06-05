import { pct } from '../../lib/format';
import type { ModelVsMarketData } from '../../lib/api';
import { useI18n } from '../../lib/i18n/I18nContext';

type Props = { data: ModelVsMarketData };

export function ModelVsMarketChart({ data }: Props) {
  const { t } = useI18n();

  const rows = [
    { label: t('common.home'), model: data.model.home, market: data.market.home, edge: data.edge.home },
    { label: t('common.draw'), model: data.model.draw, market: data.market.draw, edge: data.edge.draw },
    { label: t('common.away'), model: data.model.away, market: data.market.away, edge: data.edge.away },
  ];

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.label} className="space-y-1">
          <div className="flex justify-between text-xs text-muted">
            <span>{r.label}</span>
            <span className="font-mono-data">
              {t('common.model')} {pct(r.model)} · {t('common.consensus')} {pct(r.market)} · {t('common.delta')}{' '}
              {pct(r.edge)}
            </span>
          </div>
          <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-panel2">
            <div className="bg-cyan/80" style={{ width: `${r.model * 100}%` }} title={t('common.model')} />
            <div
              className="bg-yellow/60"
              style={{ width: `${r.market * 100}%` }}
              title={t('common.consensus')}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
