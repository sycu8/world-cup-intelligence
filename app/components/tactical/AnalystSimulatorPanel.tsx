import { useMemo, useState } from 'react';
import { adjustProbabilities, type SimulatorScenario } from '../../lib/simulator';
import { SectionLabel } from './SectionLabel';
import { useI18n } from '../../lib/i18n/I18nContext';
import { DataKindLegend } from '../ui/DataKindBadge';

type Props = {
  base: {
    homeWin: number;
    draw: number;
    awayWin: number;
    xgHome: number;
    xgAway: number;
  };
  onChange?: (adjusted: ReturnType<typeof adjustProbabilities> | null) => void;
};

export function AnalystSimulatorPanel({ base, onChange }: Props) {
  const { t } = useI18n();
  const [scenario, setScenario] = useState<SimulatorScenario>({
    homeBoost: 0,
    awayBoost: 0,
    tempo: 0,
  });

  const adjusted = useMemo(() => adjustProbabilities(base, scenario), [base, scenario]);

  const apply = (next: SimulatorScenario) => {
    setScenario(next);
    const active = next.homeBoost !== 0 || next.awayBoost !== 0 || next.tempo !== 0;
    onChange?.(active ? adjustProbabilities(base, next) : null);
  };

  const sliders: { key: keyof SimulatorScenario; labelKey: 'simulator.homeEdge' | 'simulator.awayEdge' | 'simulator.tempo'; min: number; max: number }[] = [
    { key: 'homeBoost', labelKey: 'simulator.homeEdge', min: -1, max: 1 },
    { key: 'awayBoost', labelKey: 'simulator.awayEdge', min: -1, max: 1 },
    { key: 'tempo', labelKey: 'simulator.tempo', min: -0.5, max: 0.5 },
  ];

  return (
    <div className="panel-dense border-lime/20">
      <SectionLabel title={t('simulator.title')} subtitle={t('simulator.subtitleDetail')} accent="lime" dataKind="simulated" />
      <DataKindLegend className="mb-3" />
      <div className="space-y-4">
        {sliders.map((s) => (
          <label key={s.key} className="block text-xs">
            <span className="flex justify-between text-muted">
              <span>{t(s.labelKey)}</span>
              <span className="font-mono-data text-lime">{scenario[s.key].toFixed(2)}</span>
            </span>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={0.05}
              value={scenario[s.key]}
              onChange={(e) =>
                apply({ ...scenario, [s.key]: Number(e.target.value) })
              }
              className="mt-1 w-full accent-lime"
            />
          </label>
        ))}
        <button
          type="button"
          className="w-full rounded-lg border border-border py-2 text-xs text-muted transition hover:border-cyan/40 hover:text-cyan"
          onClick={() => apply({ homeBoost: 0, awayBoost: 0, tempo: 0 })}
        >
          {t('simulator.reset')}
        </button>
      </div>
      <p className="mt-3 break-words font-mono-data text-[10px] leading-relaxed text-muted sm:text-[11px]">
        {t('simulator.preview')} {t('common.abbrHome')} {(adjusted.homeWin * 100).toFixed(1)}% ·{' '}
        {t('common.abbrDraw')} {(adjusted.draw * 100).toFixed(1)}% · {t('common.abbrAway')}{' '}
        {(adjusted.awayWin * 100).toFixed(1)}%
      </p>
    </div>
  );
}
