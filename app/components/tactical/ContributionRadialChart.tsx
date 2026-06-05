import { SectionLabel } from './SectionLabel';
import { useI18n } from '../../lib/i18n/I18nContext';
import type { LocaleKey } from '../../lib/i18n/locales';

type Segment = {
  labelKey?: LocaleKey;
  label?: string;
  value: number;
  color: string;
};

type Props = {
  segments: Segment[];
  title?: string;
};

export function ContributionRadialChart({ segments, title }: Props) {
  const { t } = useI18n();
  const chartTitle = title ?? t('contribution.title');
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let offset = 0;
  const r = 42;
  const cx = 50;
  const cy = 50;

  const arcs = segments.map((seg) => {
    const label = seg.labelKey ? t(seg.labelKey) : (seg.label ?? '');
    const frac = seg.value / total;
    const start = offset * 360;
    offset += frac;
    const end = offset * 360;
    const large = end - start > 180 ? 1 : 0;
    const sRad = ((start - 90) * Math.PI) / 180;
    const eRad = ((end - 90) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(sRad);
    const y1 = cy + r * Math.sin(sRad);
    const x2 = cx + r * Math.cos(eRad);
    const y2 = cy + r * Math.sin(eRad);
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    return { ...seg, label, d, pct: frac };
  });

  return (
    <div className="panel-dense">
      <SectionLabel title={chartTitle} subtitle={t('contribution.subtitle')} accent="purple" />
      <div className="grid items-center gap-6 sm:grid-cols-2 sm:gap-8">
        <div className="flex justify-center py-1">
          <svg viewBox="0 0 100 100" className="h-40 w-40 max-w-full" aria-hidden>
            {arcs.map((a) => (
              <path
                key={a.label}
                d={a.d}
                fill={a.color}
                opacity={0.88}
                stroke="#04060a"
                strokeWidth="0.5"
              />
            ))}
            <circle cx={cx} cy={cy} r={22} fill="#0c1119" stroke="#1e2a3a" strokeWidth="0.5" />
            <text
              x={cx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#8b9cb3"
              fontSize="5.5"
              fontWeight="600"
            >
              {t('contribution.mixCenter')}
            </text>
          </svg>
        </div>

        <ul className="flex flex-col justify-center gap-0 divide-y divide-border/40">
          {arcs.map((a) => (
            <li
              key={a.label}
              className="grid min-h-[2.25rem] grid-cols-[0.625rem_minmax(0,1fr)_2.75rem] items-center gap-x-3 py-2 first:pt-0 last:pb-0"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ background: a.color }}
                aria-hidden
              />
              <span className="truncate text-sm leading-none text-muted">{a.label}</span>
              <span className="text-right font-mono-data text-sm tabular-nums text-foreground">
                {(a.pct * 100).toFixed(0)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
