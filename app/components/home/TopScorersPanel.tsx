import type { TopScorersPayload } from '../../lib/api';
import { TeamNameWithFlag } from '../team/TeamNameWithFlag';
import { Bilingual } from '../i18n/Bilingual';
import { useI18n } from '../../lib/i18n/I18nContext';

type Props = {
  data: TopScorersPayload | null;
  loading?: boolean;
};

export function TopScorersPanel({ data, loading = false }: Props) {
  const { mode } = useI18n();
  const goalsLabel = mode === 'en' ? 'goals' : 'bàn';

  if (loading && !data) {
    return (
      <section className="panel-dense animate-pulse space-y-3" aria-hidden>
        <div className="h-4 w-44 rounded bg-panel2/60" />
        <div className="h-3 w-full max-w-md rounded bg-panel2/40" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="h-10 rounded-lg bg-panel2/30" />
          ))}
        </div>
      </section>
    );
  }

  if (!data?.scorers.length) {
    return (
      <section className="panel-dense">
        <p className="label-tactical text-cyan">
          <Bilingual k="home.topScorers.title" />
        </p>
        <p className="mt-2 text-sm text-muted">
          <Bilingual k="home.topScorers.empty" />
        </p>
      </section>
    );
  }

  const maxGoals = data.scorers[0]?.goals ?? 1;

  return (
    <section className="panel-dense space-y-3">
      <div>
        <p className="label-tactical text-cyan">
          <Bilingual k="home.topScorers.title" />
        </p>
        <p className="mt-1 text-sm text-muted">
          <Bilingual k="home.topScorers.subtitle" />
        </p>
      </div>

      <ol className="space-y-2">
        {data.scorers.map((entry) => (
          <li
            key={entry.playerId}
            className="rounded-lg border border-border/60 bg-panel2/40 px-3 py-2"
          >
            <div className="flex items-center justify-between gap-2 sm:gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="shrink-0 font-heading text-lg text-cyan">{entry.rank}</span>
                <p className="min-w-0 shrink truncate text-sm font-medium text-foreground">
                  {entry.playerName}
                </p>
                <TeamNameWithFlag
                  name={entry.teamName}
                  countryCode={entry.countryCode}
                  compact
                  className="shrink-0 text-xs text-muted"
                  flagClassName="h-3 w-[1.125rem] rounded-sm object-cover ring-1 ring-white/10"
                />
              </div>
              <div className="shrink-0 text-right">
                <span className="font-heading text-xl tabular-nums text-foreground">{entry.goals}</span>
                <span className="ml-1 text-xs text-muted">{goalsLabel}</span>
              </div>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel/80">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500/80 to-amber-400"
                style={{ width: `${Math.max(8, (entry.goals / maxGoals) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
