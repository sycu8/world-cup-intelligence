import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, type MatchLineupsPayload } from '../lib/api';
import { useI18n } from '../lib/i18n/I18nContext';
import { formatMatchVersus } from '../lib/matchTeams';
import { lineupSourceBadgeClass } from '../lib/lineupSourceLabel';
import { resolveMatchHref } from '../lib/matchPaths';
import { useLegacyMatchRedirect } from '../lib/useLegacyMatchRedirect';
import { lineupPagePath } from '@/utils/matchSlug';

function LineupSide({
  side,
  label,
}: {
  side: MatchLineupsPayload['home'];
  label: string;
}) {
  const { t } = useI18n();
  const hasLineup = side.hasAccurateLineup ?? side.source === 'official';

  return (
    <div className="rounded-card border border-border/50 bg-panel2/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
        {hasLineup && (
          <span
            className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${lineupSourceBadgeClass('official')}`}
          >
            {t('match.lineupOfficial')}
          </span>
        )}
      </div>
      <p className="mt-2 font-heading text-xl text-foreground">
        {side.teamName}
        {hasLineup && side.formation && (
          <span className="font-mono-data text-sm text-cyan"> {side.formation}</span>
        )}
      </p>
      {hasLineup ? (
        <ol className="mt-3 space-y-1 font-mono-data text-sm text-foreground/90">
          {side.players.map((p, i) => (
            <li key={`${p}-${i}`}>
              <span className="text-muted-dim">{String(i + 1).padStart(2, '0')}.</span> {p}
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-muted">{t('match.lineupPending')}</p>
      )}
    </div>
  );
}

export function LineupPage() {
  const { matchId } = useParams();
  const { t } = useI18n();
  const [data, setData] = useState<MatchLineupsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!matchId) return;
    setLoading(true);
    setError(false);
    api
      .matchLineups(matchId)
      .then((r) => setData(r.data))
      .catch(() => {
        setData(null);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [matchId]);

  useLegacyMatchRedirect(matchId, data?.slug, lineupPagePath);

  const versusLabel =
    data &&
    formatMatchVersus(data.home.teamId, data.away.teamId, data.home.teamName, data.away.teamName);

  return (
    <div className="panel space-y-4">
      <div>
        <h1 className="text-xl font-bold">{t('lineups.title')}</h1>
        <p className="font-mono-data text-xs text-muted">
          {versusLabel || (loading ? t('lineups.loading') : matchId)}
        </p>
      </div>

      {loading && <p className="text-sm text-muted">{t('lineups.loading')}</p>}
      {error && <p className="text-sm text-magenta">API error</p>}

      {data && (
        <div className="grid gap-4 md:grid-cols-2">
          <LineupSide side={data.home} label={t('common.home')} />
          <LineupSide side={data.away} label={t('common.away')} />
        </div>
      )}

      {(matchId || data) && (
        <Link
          to={resolveMatchHref({ id: data?.matchId ?? matchId!, slug: data?.slug ?? matchId })}
          className="inline-block text-pressing"
        >
          {t('lineups.back')}
        </Link>
      )}
    </div>
  );
}
