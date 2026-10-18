import { Link } from 'react-router-dom';
import type { LeagueStandingView } from '../../lib/api';
import { useI18n } from '../../lib/i18n/I18nContext';

type Props = {
  rows: LeagueStandingView[];
  groupLabel?: string;
};

export function LeagueTable({ rows, groupLabel }: Props) {
  const { t } = useI18n();
  if (!rows.length) {
    return <p className="text-sm text-muted">{t('leagues.emptyStandings')}</p>;
  }

  return (
    <div className="overflow-x-auto">
      {groupLabel ? (
        <h3 className="mb-2 font-heading text-sm uppercase tracking-wide text-muted">{groupLabel}</h3>
      ) : null}
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-2 py-2">#</th>
            <th className="px-2 py-2">{t('standings.team')}</th>
            <th className="px-2 py-2 text-right">{t('standings.played')}</th>
            <th className="px-2 py-2 text-right">W</th>
            <th className="px-2 py-2 text-right">D</th>
            <th className="px-2 py-2 text-right">L</th>
            <th className="px-2 py-2 text-right">{t('standings.gd')}</th>
            <th className="px-2 py-2 text-right">{t('standings.pts')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.groupCode}-${row.teamId}`} className="border-t border-border/50">
              <td className="px-2 py-2 font-mono-data text-muted">{row.rank}</td>
              <td className="px-2 py-2">
                <Link to={`/teams/${row.teamId}`} className="font-medium hover:text-cyan">
                  {row.shortName || row.teamName}
                </Link>
              </td>
              <td className="px-2 py-2 text-right font-mono-data">{row.played}</td>
              <td className="px-2 py-2 text-right font-mono-data">{row.won}</td>
              <td className="px-2 py-2 text-right font-mono-data">{row.drawn}</td>
              <td className="px-2 py-2 text-right font-mono-data">{row.lost}</td>
              <td className="px-2 py-2 text-right font-mono-data">{row.gd}</td>
              <td className="px-2 py-2 text-right font-mono-data font-semibold text-cyan">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
