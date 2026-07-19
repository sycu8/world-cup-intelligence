import type { ChampionOddsPayload, DashboardData, TopScorersPayload } from '../../lib/api';
import { TeamNameWithFlag } from '../team/TeamNameWithFlag';
import { Bilingual } from '../i18n/Bilingual';
import { useI18n } from '../../lib/i18n/I18nContext';

type Props = {
  dashboard: DashboardData | null;
  championOdds: ChampionOddsPayload | null;
  topScorers: TopScorersPayload | null;
  loading?: boolean;
};

function formatPct(probability: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(probability);
}

export function HomeSidebarInsights({
  dashboard,
  championOdds,
  topScorers,
  loading = false,
}: Props) {
  const { mode, t } = useI18n();
  const locale = mode === 'en' ? 'en-US' : 'vi-VN';

  const hosts = dashboard?.hostCountries?.join(mode === 'en' ? ', ' : ' · ') ?? '';
  const decided = championOdds?.phase === 'decided';
  const champions = championOdds
    ? decided
      ? championOdds.top.slice(0, 1)
      : (championOdds.all.length ? championOdds.all : championOdds.top).slice(0, 5)
    : [];
  const maxProb = champions[0]?.probability ?? 1;
  const scorers = topScorers?.scorers.slice(0, 3) ?? [];

  if (loading && !championOdds && !topScorers) {
    return <div className="home-sidebar animate-pulse rounded-card bg-panel2/30 min-h-[16rem]" aria-hidden />;
  }

  return (
    <aside className="home-sidebar flex flex-col gap-4">
      {hosts && (
        <p className="text-sm text-muted">
          {t('home.cohosts')}
          <span className="text-foreground">{hosts}</span>
        </p>
      )}

      {champions.length > 0 && (
        <div>
          <p className="label-tactical text-cyan">
            <Bilingual k={decided ? 'home.championOdds.titleDecided' : 'home.championOdds.title'} />
          </p>
          <ol className="mt-2 space-y-2">
            {champions.map((entry) => (
              <li key={entry.teamId} className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-center font-heading text-sm text-cyan">{entry.rank}</span>
                <TeamNameWithFlag
                  name={entry.teamName}
                  countryCode={entry.countryCode}
                  compact
                  className="min-w-0 flex-1 truncate text-sm"
                />
                <span className="shrink-0 font-heading text-sm tabular-nums">
                  {decided ? <Bilingual k="home.championOdds.championBadge" /> : formatPct(entry.probability, locale)}
                </span>
                {!decided && (
                <div className="hidden w-16 overflow-hidden rounded-full bg-background2 sm:block">
                  <div
                    className="h-1.5 rounded-full bg-cyan/80"
                    style={{ width: `${Math.max(12, (entry.probability / maxProb) * 100)}%` }}
                  />
                </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {scorers.length > 0 && (
        <div className="border-t border-border/40 pt-3">
          <p className="label-tactical text-yellow">
            <Bilingual k="home.topScorers.title" />
          </p>
          <ol className="mt-2 space-y-1.5">
            {scorers.map((s) => (
              <li key={s.playerId} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">
                  <span className="font-heading text-cyan">{s.rank}.</span> {s.playerName}
                </span>
                <span className="shrink-0 font-heading tabular-nums">{s.goals}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </aside>
  );
}
