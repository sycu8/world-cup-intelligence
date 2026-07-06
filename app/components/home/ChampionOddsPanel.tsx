import type { ChampionOddsPayload } from '../../lib/api';
import { TeamNameWithFlag } from '../team/TeamNameWithFlag';
import { Bilingual } from '../i18n/Bilingual';
import { useI18n } from '../../lib/i18n/I18nContext';

type Props = {
  odds: ChampionOddsPayload | null;
  loading?: boolean;
};

function formatPct(probability: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(probability);
}

export function ChampionOddsPanel({ odds, loading = false }: Props) {
  const { mode } = useI18n();
  const locale = mode === 'en' ? 'en-US' : 'vi-VN';

  if (loading && !odds) {
    return (
      <section className="panel-dense animate-pulse space-y-3" aria-hidden>
        <div className="h-4 w-40 rounded bg-panel2/60" />
        <div className="h-3 w-full max-w-md rounded bg-panel2/40" />
        <div className="space-y-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-10 rounded-lg bg-panel2/30" />
          ))}
        </div>
      </section>
    );
  }

  if (!odds?.top.length) return null;

  const maxProb = odds.top[0]?.probability ?? 1;

  return (
    <section className="panel-dense flex flex-col gap-3">
      <div>
        <p className="label-tactical text-cyan">
          <Bilingual k="home.championOdds.title" />
        </p>
        <p className="mt-1 text-sm text-muted">
          <Bilingual k="home.championOdds.subtitle" />
        </p>
      </div>

      <ol className="space-y-2.5">
        {odds.top.map((entry) => (
          <li
            key={entry.teamId}
            className="rounded-lg border border-border/60 bg-panel2/40 px-3 py-2.5"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-cyan/15 font-heading text-sm text-cyan">
                  {entry.rank}
                </span>
                <TeamNameWithFlag
                  name={entry.teamName}
                  countryCode={entry.countryCode}
                  compact
                  className="truncate text-sm font-medium sm:text-base"
                />
              </div>
              <span className="shrink-0 font-heading text-xl tabular-nums text-foreground sm:text-2xl">
                {formatPct(entry.probability, locale)}
              </span>
            </div>
            <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-background2 ring-1 ring-border/50 sm:h-3">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan/90 to-cyan shadow-[0_0_12px_rgba(0,229,255,0.35)]"
                style={{ width: `${Math.max(10, (entry.probability / maxProb) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ol>

      <p className="text-xs text-muted-dim">
        <Bilingual k="home.championOdds.disclaimer" />
      </p>
    </section>
  );
}
