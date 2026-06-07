import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type GroupStandingsPayload, type ScheduleMatch } from '../../lib/api';
import { resolveMatchHref } from '../../lib/matchPaths';
import { useI18n } from '../../lib/i18n/I18nContext';
import { groupStageLabel, KNOCKOUT_STAGE_ORDER, matchStageLabel } from '../../lib/i18n/stageLabels';
import { CompactMatchProb } from './CompactMatchProb';
import { MatchTeamsWithFlags, TeamNameWithFlag } from '../team/TeamNameWithFlag';
import { MatchKickoffDisplay } from '../match/MatchKickoffDisplay';

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'] as const;

type MainTab = 'group' | 'knockout';
type KnockoutStage = (typeof KNOCKOUT_STAGE_ORDER)[number];
type MatchProbMap = Record<string, { homeWin: number; draw: number; awayWin: number }>;

function formatGd(gd: number): string {
  return gd > 0 ? `+${gd}` : String(gd);
}

function BoardTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm ${
        active
          ? 'bg-pressing/15 text-pressing ring-1 ring-pressing/30'
          : 'text-muted hover:bg-panel2/60 hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );
}

function GroupCard({
  code,
  standings,
  fixtures,
  probs,
  standingsUnavailable,
}: {
  code: string;
  standings: GroupStandingsPayload['groups'][string] | undefined;
  fixtures: ScheduleMatch[];
  probs: MatchProbMap;
  standingsUnavailable?: boolean;
}) {
  const { t } = useI18n();

  return (
    <div className="rounded-lg border border-border/50 bg-panel2/25 p-2 sm:p-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h3 className="font-heading text-sm font-semibold text-foreground sm:text-base">
          {groupStageLabel(code, t)}
        </h3>
        {standings?.complete && (
          <span className="text-[9px] font-semibold uppercase text-live">{t('standings.complete')}</span>
        )}
      </div>

      <table className="mb-2 w-full text-[10px] sm:text-[11px]">
        <thead>
          <tr className="border-b border-border/40 text-left text-muted">
            <th className="pb-0.5 pr-1 w-4">#</th>
            <th className="pb-0.5">{t('standings.team')}</th>
            <th className="pb-0.5 w-5 text-right">{t('standings.played')}</th>
            <th className="pb-0.5 w-6 text-right">{t('standings.gd')}</th>
            <th className="pb-0.5 w-5 text-right">{t('standings.pts')}</th>
          </tr>
        </thead>
        <tbody>
          {standingsUnavailable ? (
            <tr>
              <td colSpan={5} className="py-2 text-center text-muted">
                {t('standings.unavailable')}
              </td>
            </tr>
          ) : standings?.rows.length ? (
            standings.rows.map((row) => (
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
                  <TeamNameWithFlag
                    name={row.shortName ?? row.teamName}
                    flagName={row.teamName}
                    countryCode={row.countryCode}
                    compact={!row.shortName}
                    flagClassName="h-2.5 w-4 rounded-sm object-cover ring-1 ring-white/10 sm:h-3 sm:w-[1.125rem]"
                  />
                  {row.rank === 3 && (
                    <span className="ml-0.5 text-[8px] text-yellow">{t('standings.thirdBadge')}</span>
                  )}
                </td>
                <td className="py-0.5 text-right font-mono-data">{row.played}</td>
                <td className="py-0.5 text-right font-mono-data">{formatGd(row.gd)}</td>
                <td className="py-0.5 text-right font-mono-data font-semibold">{row.points}</td>
              </tr>
            ))
          ) : (
            [1, 2, 3, 4].map((rank) => (
              <tr key={rank} className="text-muted/40">
                <td className="py-0.5 font-mono-data">{rank}</td>
                <td className="py-0.5">—</td>
                <td className="py-0.5 text-right font-mono-data">0</td>
                <td className="py-0.5 text-right font-mono-data">0</td>
                <td className="py-0.5 text-right font-mono-data">0</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <ul className="space-y-0.5 border-t border-border/40 pt-1.5">
        {fixtures.map((m) => {
          const prob = probs[m.id];
          const score =
            m.status === 'completed' || m.status === 'live'
              ? `${m.home_score}-${m.away_score}`
              : null;

          return (
            <li key={m.id}>
              <Link
                to={resolveMatchHref(m)}
                className="group flex items-center gap-1.5 rounded-md px-1 py-1 text-[10px] transition hover:bg-pressing/10 sm:gap-2 sm:text-[11px]"
              >
                <time className="w-9 shrink-0 font-mono-data text-[9px] text-muted sm:w-10 sm:text-[10px]">
                  <MatchKickoffDisplay kickoffUtc={m.kickoff_utc} showDate showVnReference={false} />
                </time>
                <span className="min-w-0 flex-1 truncate leading-tight text-foreground/90">
                  <MatchTeamsWithFlags
                    homeName={m.home_name}
                    awayName={m.away_name}
                    homeShort={m.home_short}
                    awayShort={m.away_short}
                    homeCountryCode={m.home_country_code}
                    awayCountryCode={m.away_country_code}
                    separator="–"
                    flagClassName="h-2 w-3 rounded-sm object-cover ring-1 ring-white/10 sm:h-2.5 sm:w-4"
                  />
                  {score != null && (
                    <span className="ml-1 font-mono-data font-semibold text-foreground">{score}</span>
                  )}
                  {m.status === 'live' && (
                    <span className="ml-1 text-[9px] font-bold text-live">{t('common.live')}</span>
                  )}
                </span>
                <CompactMatchProb homeWin={prob?.homeWin} draw={prob?.draw} awayWin={prob?.awayWin} />
                <span className="shrink-0 text-muted opacity-0 transition group-hover:opacity-100" aria-hidden>
                  →
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function KnockoutRoundPanel({
  stage,
  matches,
  probs,
}: {
  stage: KnockoutStage;
  matches: ScheduleMatch[];
  probs: MatchProbMap;
}) {
  const { t } = useI18n();

  const roundMatches = useMemo(
    () =>
      matches
        .filter((m) => m.stage === stage)
        .sort((a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc)),
    [matches, stage],
  );

  if (roundMatches.length === 0) {
    return <p className="py-6 text-center text-sm text-muted">{t('groupBoard.knockoutEmpty')}</p>;
  }

  return (
    <ul className="divide-y divide-border/40 rounded-lg border border-border/50 bg-panel2/20">
      {roundMatches.map((m) => {
        const prob = probs[m.id];
        const score =
          m.status === 'completed' || m.status === 'live'
            ? `${m.home_score}-${m.away_score}`
            : null;

        return (
          <li key={m.id}>
            <Link
              to={resolveMatchHref(m)}
              className="group flex flex-wrap items-center gap-x-2 gap-y-1 px-2 py-2 text-xs transition hover:bg-pressing/5 sm:px-3"
            >
              <time className="w-28 shrink-0 font-mono-data text-[10px] text-muted">
                <MatchKickoffDisplay kickoffUtc={m.kickoff_utc} showDate showVnReference={false} />
              </time>
              <span className="min-w-0 flex-1 font-medium">
                <MatchTeamsWithFlags
                  homeName={m.home_name}
                  awayName={m.away_name}
                  homeShort={m.home_short}
                  awayShort={m.away_short}
                  homeCountryCode={m.home_country_code}
                  awayCountryCode={m.away_country_code}
                  separator="–"
                />
                {score != null && <span className="ml-2 font-mono-data text-foreground">{score}</span>}
              </span>
              <CompactMatchProb homeWin={prob?.homeWin} draw={prob?.draw} awayWin={prob?.awayWin} />
              <span className="text-[10px] text-cyan opacity-70 group-hover:opacity-100">
                {t('groupBoard.openAnalysis')} →
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function GroupStagePanel({
  standings,
  standingsError,
  groupFixtures,
  probs,
}: {
  standings: GroupStandingsPayload | null;
  standingsError: boolean;
  groupFixtures: Record<string, ScheduleMatch[]>;
  probs: MatchProbMap;
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs text-muted">{t('groupBoard.subtitle')}</p>
          <p className="mt-1 font-mono-data text-[10px] text-muted-dim sm:text-xs">
            {t('groupBoard.standingsHint')}
          </p>
        </div>
        <p className="font-mono-data text-[10px] text-muted sm:text-xs">{t('groupBoard.probHint')}</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {GROUPS.map((code) => (
          <GroupCard
            key={code}
            code={code}
            standings={standings?.groups[code]}
            fixtures={groupFixtures[code] ?? []}
            probs={probs}
            standingsUnavailable={standingsError}
          />
        ))}
      </div>

      {standings && standings.thirdPlaceRanking.length > 0 && (
        <div className="rounded-lg border border-border/50 bg-panel2/20 px-3 py-2">
          <h3 className="text-xs font-semibold text-pressing">{t('standings.thirdPlace')}</h3>
          <ol className="mt-1.5 grid gap-0.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {standings.thirdPlaceRanking.slice(0, 12).map((row, i) => (
              <li
                key={`${row.group}-${row.teamId}`}
                className="font-mono-data text-[10px] text-foreground/90 sm:text-[11px]"
              >
                {i + 1}.{' '}
                <TeamNameWithFlag
                  name={row.shortName ?? row.teamName}
                  flagName={row.teamName}
                  countryCode={row.countryCode}
                  flagClassName="h-2 w-3 rounded-sm object-cover ring-1 ring-white/10"
                />{' '}
                <span className="text-muted">
                  ({t('calendar.groupLabel')} {row.group} · {row.points} {t('standings.pts').toLowerCase()})
                </span>
                {i < 8 && <span className="ml-1 text-live">{t('standings.qualifiesR32')}</span>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

type Props = {
  matches: ScheduleMatch[];
};

export function GroupStageBoard({ matches }: Props) {
  const { t } = useI18n();
  const [mainTab, setMainTab] = useState<MainTab>('group');
  const [knockoutStage, setKnockoutStage] = useState<KnockoutStage>('Round of 32');
  const [standings, setStandings] = useState<GroupStandingsPayload | null>(null);
  const [standingsError, setStandingsError] = useState(false);
  const [probs, setProbs] = useState<MatchProbMap>({});
  const [groupLoading, setGroupLoading] = useState(false);
  const [knockoutLoading, setKnockoutLoading] = useState(false);

  useEffect(() => {
    if (mainTab !== 'group') return;
    let cancelled = false;
    setGroupLoading(true);

    const load = () => {
      Promise.all([api.tournamentStandings(2026), api.tournamentMatchProbabilities(2026)])
        .then(([s, p]) => {
          if (!cancelled) {
            setStandings(s.data);
            setStandingsError(false);
            setProbs(p.data);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setStandings(null);
            setStandingsError(true);
          }
        })
        .finally(() => {
          if (!cancelled) setGroupLoading(false);
        });
    };

    load();
    const timer = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [mainTab]);

  useEffect(() => {
    if (mainTab !== 'knockout') return;
    if (Object.keys(probs).length > 0) return;
    let cancelled = false;
    setKnockoutLoading(true);
    api
      .tournamentMatchProbabilities(2026)
      .then((r) => {
        if (!cancelled) setProbs(r.data);
      })
      .catch(() => {
        if (!cancelled) setProbs({});
      })
      .finally(() => {
        if (!cancelled) setKnockoutLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mainTab, probs]);

  const groupFixtures = useMemo(() => {
    const map: Record<string, ScheduleMatch[]> = {};
    for (const code of GROUPS) map[code] = [];
    for (const m of matches) {
      if (m.stage === 'Group' && m.group_code && map[m.group_code]) {
        map[m.group_code].push(m);
      }
    }
    for (const code of GROUPS) {
      map[code].sort((a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc));
    }
    return map;
  }, [matches]);

  const knockoutMatches = useMemo(
    () =>
      matches
        .filter((m) => m.stage && m.stage !== 'Group')
        .sort((a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc)),
    [matches],
  );

  const knockoutStages = useMemo(
    () => KNOCKOUT_STAGE_ORDER.filter((stage) => knockoutMatches.some((m) => m.stage === stage)),
    [knockoutMatches],
  );

  useEffect(() => {
    if (knockoutStages.length === 0) return;
    if (!knockoutStages.includes(knockoutStage)) {
      setKnockoutStage(knockoutStages[0]);
    }
  }, [knockoutStages, knockoutStage]);

  const knockoutRoundLabels = useMemo(
    () =>
      KNOCKOUT_STAGE_ORDER.map((stage) => ({
        stage,
        label: matchStageLabel(stage, t),
      })),
    [t],
  );

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-pressing">{t('groupBoard.title')}</h2>

      <nav
        className="flex flex-wrap gap-2 border-b border-border/60 pb-3"
        aria-label={t('groupBoard.title')}
      >
        <BoardTab
          active={mainTab === 'group'}
          onClick={() => setMainTab('group')}
          label={t('groupBoard.tabGroup')}
        />
        <BoardTab
          active={mainTab === 'knockout'}
          onClick={() => setMainTab('knockout')}
          label={t('groupBoard.tabKnockout')}
        />
      </nav>

      {mainTab === 'group' ? (
        groupLoading && !standings && !standingsError ? (
          <p className="text-sm text-muted">{t('groupBoard.loading')}</p>
        ) : (
          <GroupStagePanel
            standings={standings}
            standingsError={standingsError}
            groupFixtures={groupFixtures}
            probs={probs}
          />
        )
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted">{t('groupBoard.knockoutSubtitle')}</p>

          <div
            className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin"
            role="tablist"
            aria-label={t('groupBoard.tabKnockout')}
          >
            {knockoutRoundLabels.map(({ stage, label }) => {
              const count = knockoutMatches.filter((m) => m.stage === stage).length;
              if (count === 0) return null;
              return (
                <button
                  key={stage}
                  type="button"
                  role="tab"
                  aria-selected={knockoutStage === stage}
                  onClick={() => setKnockoutStage(stage)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium transition sm:text-xs ${
                    knockoutStage === stage
                      ? 'bg-cyan/15 text-cyan ring-1 ring-cyan/30'
                      : 'text-muted hover:bg-panel2/60 hover:text-foreground'
                  }`}
                >
                  {label}
                  <span className="ml-1 font-mono-data text-[10px] opacity-70">({count})</span>
                </button>
              );
            })}
          </div>

          {knockoutLoading && Object.keys(probs).length === 0 ? (
            <p className="text-sm text-muted">{t('groupBoard.loading')}</p>
          ) : (
            <KnockoutRoundPanel stage={knockoutStage} matches={knockoutMatches} probs={probs} />
          )}
        </div>
      )}
    </div>
  );
}
