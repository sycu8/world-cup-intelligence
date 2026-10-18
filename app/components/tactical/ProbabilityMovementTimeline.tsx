import { pct } from '../../lib/format';
import { SectionLabel } from './SectionLabel';
import { useI18n } from '../../lib/i18n/I18nContext';

type Interval = { homeWinProb: number; drawProb: number; awayWinProb: number };
type Props = {
  intervals: Record<string, Interval>;
  currentMinute?: number;
};

const KEYS = ['15', '30', '45', '60', '75', '90'];

export function ProbabilityMovementTimeline({ intervals, currentMinute = 0 }: Props) {
  const { t } = useI18n();
  const rows = KEYS.map((k) => ({ minute: Number(k), ...intervals[k] })).filter((r) => r.homeWinProb != null);

  if (rows.length === 0) return null;

  const first = rows[0];
  const last = rows[rows.length - 1];
  const homeShift = last.homeWinProb - first.homeWinProb;
  const trend =
    homeShift > 0.03
      ? t('probMovement.trendRising')
      : homeShift < -0.03
        ? t('probMovement.trendAway')
        : t('probMovement.trendBalanced');

  return (
    <div className="panel-dense">
      <SectionLabel title={t('probMovement.title')} subtitle={trend} accent="magenta" />
      <div className="space-y-2.5">
        {rows.map((row) => {
          const active = currentMinute >= row.minute;
          return (
            <div
              key={row.minute}
              className={`rounded-lg border px-2 py-1.5 transition ${
                active ? 'border-magenta/30 bg-magenta/5' : 'border-transparent'
              }`}
            >
              <div className="mb-1 flex items-center justify-between text-[10px]">
                <span className="font-mono-data text-cyan">{row.minute}&apos;</span>
                <span className="font-mono-data text-muted">
                  {t('common.abbrHome')} {pct(row.homeWinProb)} · {t('common.abbrDraw')}{' '}
                  {pct(row.drawProb)} · {t('common.abbrAway')} {pct(row.awayWinProb)}
                </span>
              </div>
              <div className="flex h-2 overflow-hidden rounded-sm bg-background2">
                <div className="bg-defending" style={{ width: `${row.homeWinProb * 100}%` }} />
                <div className="bg-muted/70" style={{ width: `${row.drawProb * 100}%` }} />
                <div className="bg-purple" style={{ width: `${row.awayWinProb * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted">{t('probMovement.footerNote')}</p>
    </div>
  );
}
