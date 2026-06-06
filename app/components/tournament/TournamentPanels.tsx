import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type GroupStandingsPayload } from '../../lib/api';
import { resolveMatchHref } from '../../lib/matchPaths';
import { useI18n } from '../../lib/i18n/I18nContext';
import { formatLocalizedVersus, matchStageLabel } from '../../lib/i18n/stageLabels';

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'] as const;

function formatGd(gd: number): string {
  return gd > 0 ? `+${gd}` : String(gd);
}

export function GroupStandingsGrid() {
  const { t, mode } = useI18n();
  const [data, setData] = useState<GroupStandingsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      api
        .tournamentStandings(2026)
        .then((r) => {
          if (!cancelled) setData(r.data);
        })
        .catch(() => {
          if (!cancelled) setData(null);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    load();
    const timer = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (loading && !data) {
    return <p className="text-sm text-muted">{t('standings.loading')}</p>;
  }
  if (!data) {
    return <p className="text-sm text-muted">{t('standings.unavailable')}</p>;
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-pressing">
          {t('standings.title')}
        </h2>
        <p className="mt-1 text-xs text-muted">{t('standings.subtitle')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {GROUPS.map((code) => {
          const group = data.groups[code];
          if (!group) return null;
          return (
            <div
              key={code}
              className="rounded-card border border-border/60 bg-panel2/40 p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="font-heading text-lg text-foreground">
                  {t('calendar.groupLabel')} {code}
                </span>
                {group.complete && (
                  <span className="text-[10px] font-semibold uppercase text-live">
                    {t('standings.complete')}
                  </span>
                )}
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted">
                    <th className="pb-1">#</th>
                    <th className="pb-1">{t('standings.team')}</th>
                    <th className="pb-1 text-right">{t('standings.played')}</th>
                    <th className="pb-1 text-right">{t('standings.gd')}</th>
                    <th className="pb-1 text-right">{t('standings.pts')}</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-2 text-muted">
                        {t('standings.noResults')}
                      </td>
                    </tr>
                  ) : (
                    group.rows.map((row) => (
                      <tr
                        key={row.teamId}
                        className={
                          row.rank <= 2
                            ? 'text-foreground'
                            : row.rank === 3
                              ? 'text-muted'
                              : 'text-muted/70'
                        }
                      >
                        <td className="py-0.5 font-mono-data">{row.rank}</td>
                        <td className="py-0.5 pr-1 leading-tight">
                          {row.shortName ?? row.teamName}
                          {row.rank === 3 && (
                            <span className="ml-1 text-[9px] text-yellow">
                              {t('standings.thirdBadge')}
                            </span>
                          )}
                        </td>
                        <td className="py-0.5 text-right font-mono-data">{row.played}</td>
                        <td className="py-0.5 text-right font-mono-data">{formatGd(row.gd)}</td>
                        <td className="py-0.5 text-right font-mono-data font-semibold">
                          {row.points}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>

      {data.thirdPlaceRanking.length > 0 && (
        <div className="panel space-y-2">
          <h3 className="text-sm font-semibold text-pressing">{t('standings.thirdPlace')}</h3>
          <ol className="grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
            {data.thirdPlaceRanking.slice(0, 12).map((row, i) => (
              <li key={`${row.group}-${row.teamId}`} className="font-mono-data text-xs text-foreground/90">
                {i + 1}. {row.shortName ?? row.teamName}{' '}
                <span className="text-muted">
                  {t('standings.thirdRowDetail')
                    .replace('{group}', `${t('calendar.groupLabel')} ${row.group}`)
                    .replace('{pts}', String(row.points))
                    .replace('{gd}', formatGd(row.gd))}
                </span>
                {i < 8 && <span className="ml-1 text-live">{t('standings.qualifiesR32')}</span>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

export function BracketPanel() {
  const { t, mode } = useI18n();
  const [rounds, setRounds] = useState<Awaited<ReturnType<typeof api.tournamentBracket>>['data']['rounds']>(
    [],
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      api
        .tournamentBracket(2026)
        .then((r) => {
          if (!cancelled) setRounds(r.data.rounds);
        })
        .catch(() => {
          if (!cancelled) setRounds([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    load();
    const timer = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (loading && rounds.length === 0) {
    return <p className="text-sm text-muted">{t('bracket.loading')}</p>;
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-pressing">
          {t('bracket.title')}
        </h2>
        <p className="mt-1 text-xs text-muted">{t('bracket.subtitle')}</p>
      </div>

      {rounds.length === 0 ? (
        <p className="text-sm text-muted">{t('bracket.empty')}</p>
      ) : (
        rounds.map((round) => (
          <div key={round.stage} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan">
              {matchStageLabel(round.stage, t)}
            </h3>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {round.matches.map((m) => (
                <li key={m.id}>
                  <Link
                    to={resolveMatchHref({ id: m.id, slug: m.slug })}
                    className="block rounded-xl border border-border/60 bg-panel2/40 px-3 py-2 text-sm transition hover:border-pressing/50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">
                        {formatLocalizedVersus(m.homeName, m.awayName, mode)}
                      </span>
                      {m.status === 'live' && (
                        <span className="shrink-0 text-[10px] font-bold text-live">
                          {t('common.live')}
                        </span>
                      )}
                      {m.status === 'completed' && (
                        <span className="shrink-0 font-mono-data text-xs text-foreground">
                          {m.homeScore}–{m.awayScore}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[10px] text-muted">
                      {new Date(m.kickoffUtc).toLocaleDateString(mode === 'en' ? 'en' : 'vi-VN', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
