import { useEffect, useState } from 'react';
import { api, type MatchRecapPayload } from '../../lib/api';
import { useI18n } from '../../lib/i18n/I18nContext';
import { SectionLabel } from '../tactical/SectionLabel';
import { xg } from '../../lib/format';

type Props = {
  matchId: string;
  homeTeamId?: string;
  homeLabel: string;
  awayLabel: string;
};

export function MatchRecapPanel({ matchId, homeTeamId, homeLabel, awayLabel }: Props) {
  const { t, mode } = useI18n();
  const [recap, setRecap] = useState<MatchRecapPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const load = () => {
      setLoading(true);
      api
        .matchRecap(matchId)
        .then((r) => {
          if (cancelled) return;
          setRecap(r.data);
          const missingSummary = !r.data?.summaryVi?.trim() && !r.data?.summaryEn?.trim();
          if (missingSummary && attempts < 4) {
            attempts += 1;
            retryTimer = setTimeout(load, 4000);
          }
        })
        .catch(() => {
          if (!cancelled) setRecap(null);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };

    load();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [matchId]);

  if (loading) {
    return <p className="text-sm text-muted">{t('recap.loading')}</p>;
  }
  if (!recap) return null;

  const summary = mode === 'en' ? recap.summaryEn : recap.summaryVi;
  const homeStats = recap.playerStats.filter((p) => p.teamId === homeTeamId);
  const awayStats = recap.playerStats.filter((p) => p.teamId !== homeTeamId);

  return (
    <section className="panel-elevated space-y-5 border-cyan/15">
      <SectionLabel title={t('recap.title')} subtitle={t('recap.subtitle')} accent="cyan" />
      <p className="text-sm leading-relaxed text-foreground/90">{summary}</p>
      {recap.sourceId && (
        <p className="font-mono-data text-[10px] text-muted">{t('recap.sourceFifa')}</p>
      )}

      {recap.commentary.length > 0 && (
        <div>
          <p className="label-tactical mb-2 text-magenta">{t('recap.commentary')}</p>
          <ol className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {recap.commentary.map((line) => (
              <li
                key={line.id}
                className="rounded-card border border-border/40 bg-panel2/30 px-3 py-2 text-sm leading-relaxed"
              >
                {line.minute != null && (
                  <span className="mr-2 font-mono-data text-xs text-cyan">{line.minute}&apos;</span>
                )}
                {mode === 'en' ? line.textEn : line.textVi}
              </li>
            ))}
          </ol>
        </div>
      )}

      {recap.playerStats.length > 0 && (
        <div>
          <p className="label-tactical mb-2 text-yellow">{t('recap.playerStats')}</p>
          <div className="grid gap-3 md:grid-cols-2">
            {[homeLabel, awayLabel].map((label, idx) => {
              const rows = idx === 0 ? homeStats : awayStats;
              if (rows.length === 0) return null;
              return (
                <div key={label} className="rounded-card border border-border/40 bg-background/30 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
                  <ul className="space-y-1.5">
                    {rows.map((p) => (
                      <li
                        key={p.playerId}
                        className="flex flex-wrap items-baseline justify-between gap-x-2 font-mono-data text-[11px]"
                      >
                        <span className="text-foreground/90">
                          {p.shirtNumber != null && (
                            <span className="mr-1 text-muted">{p.shirtNumber}</span>
                          )}
                          {p.playerName}
                        </span>
                        <span className="text-muted">
                          {p.goals > 0 && `⚽${p.goals} `}
                          {p.assists > 0 && `🅰${p.assists} `}
                          {p.xg > 0 && `xG ${xg(p.xg)}`}
                          {p.redCards > 0 && ' 🟥'}
                          {p.yellowCards > 0 && ' 🟨'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
