import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type GroupStandingsPayload, type ScheduleMatch } from '../../lib/api';
import {
  areAllGroupsComplete,
  inferActiveKnockoutStage,
  isKnockoutRoundComplete,
  knockoutRoundProgress,
  type KnockoutStage,
} from '../../lib/knockoutRound';
import { resolveMatchHref } from '../../lib/matchPaths';
import { useI18n } from '../../lib/i18n/I18nContext';
import { groupStageLabel, KNOCKOUT_STAGE_ORDER, matchStageLabel } from '../../lib/i18n/stageLabels';
import { MatchTeamsWithFlags, TeamNameWithFlag } from '../team/TeamNameWithFlag';
import { MatchKickoffDisplay } from '../match/MatchKickoffDisplay';
import { MatchResultScore, hasMatchResult } from '../match/MatchResultScore';

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'] as const;
const STANDINGS_REFRESH_MS = 30_000;

type MainTab = 'group' | 'knockout';

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

function BoardMatchRow({
  match,
  showDate = false,
  dense = false,
}: {
  match: ScheduleMatch;
  showDate?: boolean;
  dense?: boolean;
}) {
  const { t } = useI18n();
  const showScore = hasMatchResult(match.status);

  return (
    <Link
      to={resolveMatchHref(match)}
      className={`group flex min-h-[2.75rem] items-center gap-1.5 rounded-md transition hover:bg-pressing/10 sm:gap-2 ${
        dense ? 'px-2 py-2 sm:px-3' : 'px-2 py-1.5'
      }`}
    >
      <time className="shrink-0 whitespace-nowrap font-mono-data text-[10px] leading-none text-muted">
        <MatchKickoffDisplay
          kickoffUtc={match.kickoff_utc}
          showDate={showDate}
          inlineDate={showDate}
          showLocalReference={false}
        />
      </time>

      <span className="min-w-0 flex-1 truncate text-[10px] font-medium leading-tight text-foreground/90 sm:text-[11px]">
        <MatchTeamsWithFlags
          homeName={match.home_name}
          awayName={match.away_name}
          homeShort={match.home_short}
          awayShort={match.away_short}
          homeCountryCode={match.home_country_code}
          awayCountryCode={match.away_country_code}
          separator="–"
          nowrap
          compact
          flagClassName="h-2 w-3 shrink-0 rounded-sm object-cover ring-1 ring-white/10"
        />
      </span>

      <span className="flex shrink-0 items-center justify-end gap-1">
        {showScore ? (
          <MatchResultScore
            homeScore={match.home_score}
            awayScore={match.away_score}
            status={match.status}
            variant={match.status === 'completed' || match.status === 'finished' ? 'badge' : 'compact'}
          />
        ) : (
          <span className="font-mono-data text-[10px] text-muted/35">–</span>
        )}
        {match.status === 'live' && (
          <span className="text-[9px] font-bold uppercase leading-none text-live">{t('common.live')}</span>
        )}
      </span>
    </Link>
  );
}

function GroupCard({
  code,
  standings,
  fixtures,
  standingsUnavailable,
}: {
  code: string;
  standings: GroupStandingsPayload['groups'][string] | undefined;
  fixtures: ScheduleMatch[];
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

      <ul className="space-y-0 border-t border-border/40 pt-1">
        {fixtures.map((m) => (
          <li key={m.id}>
            <BoardMatchRow match={m} showDate />
          </li>
        ))}
      </ul>
    </div>
  );
}

function KnockoutRoundPanel({
  stage,
  matches,
}: {
  stage: KnockoutStage;
  matches: ScheduleMatch[];
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
      {roundMatches.map((m) => (
        <li key={m.id}>
          <BoardMatchRow match={m} showDate dense />
        </li>
      ))}
    </ul>
  );
}

function GroupStagePanel({
  standings,
  standingsError,
  groupFixtures,
}: {
  standings: GroupStandingsPayload | null;
  standingsError: boolean;
  groupFixtures: Record<string, ScheduleMatch[]>;
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <div className="min-w-0">
        <p className="text-xs text-muted">{t('groupBoard.subtitle')}</p>
        <p className="mt-1 font-mono-data text-[10px] text-muted-dim sm:text-xs">
          {t('groupBoard.standingsHint')}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {GROUPS.map((code) => (
          <GroupCard
            key={code}
            code={code}
            standings={standings?.groups[code]}
            fixtures={groupFixtures[code] ?? []}
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
                className="break-words font-mono-data text-[10px] text-foreground/90 sm:text-[11px]"
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
  initialStandings?: GroupStandingsPayload | null;
};

export function GroupStageBoard({
  matches,
  initialStandings = null,
}: Props) {
  const { t } = useI18n();
  const hasInitialBoard = !!initialStandings;
  const [mainTab, setMainTab] = useState<MainTab>('group');
  const [knockoutStage, setKnockoutStage] = useState<KnockoutStage>('Round of 32');
  const [knockoutStagePinned, setKnockoutStagePinned] = useState(false);
  const [standings, setStandings] = useState<GroupStandingsPayload | null>(initialStandings);
  const [standingsError, setStandingsError] = useState(false);
  const [groupLoading, setGroupLoading] = useState(!hasInitialBoard);
  const prevAllGroupsComplete = useRef(false);

  useEffect(() => {
    if (initialStandings) {
      setStandings(initialStandings);
      setStandingsError(false);
      setGroupLoading(false);
    }
  }, [initialStandings]);

  useEffect(() => {
    let cancelled = false;

    const load = (showLoading: boolean) => {
      if (showLoading && mainTab === 'group') setGroupLoading(true);

      api
        .tournamentStandings(2026)
        .then((s) => {
          if (!cancelled) {
            setStandings(s.data);
            setStandingsError(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setStandings((current) => {
              if (!current) setStandingsError(true);
              return current;
            });
          }
        })
        .finally(() => {
          if (!cancelled && mainTab === 'group') setGroupLoading(false);
        });
    };

    load(mainTab === 'group' && !standings && !standingsError);
    const timer = setInterval(() => load(false), STANDINGS_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- poll on tab change only; standings updated in-place
  }, [mainTab]);

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

  const allGroupsComplete = useMemo(
    () => areAllGroupsComplete(standings?.groups, GROUPS),
    [standings?.groups],
  );

  const activeKnockoutStage = useMemo(
    () => inferActiveKnockoutStage(knockoutMatches),
    [knockoutMatches],
  );

  useEffect(() => {
    if (!allGroupsComplete || prevAllGroupsComplete.current) return;
    prevAllGroupsComplete.current = true;
    setMainTab('knockout');
    setKnockoutStagePinned(false);
  }, [allGroupsComplete]);

  useEffect(() => {
    if (knockoutStages.length === 0 || !activeKnockoutStage) return;

    if (!knockoutStages.includes(knockoutStage)) {
      setKnockoutStage(activeKnockoutStage);
      setKnockoutStagePinned(false);
      return;
    }

    if (!knockoutStagePinned) {
      setKnockoutStage(activeKnockoutStage);
      return;
    }

    if (
      isKnockoutRoundComplete(knockoutMatches, knockoutStage) &&
      activeKnockoutStage !== knockoutStage
    ) {
      setKnockoutStage(activeKnockoutStage);
      setKnockoutStagePinned(false);
    }
  }, [knockoutStages, knockoutStage, knockoutStagePinned, activeKnockoutStage, knockoutMatches]);

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
          />
        )
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted">{t('groupBoard.knockoutSubtitle')}</p>
          {!allGroupsComplete && (
            <p className="rounded-lg border border-border/50 bg-panel2/20 px-3 py-2 text-xs text-muted">
              {t('groupBoard.knockoutLocked')}
            </p>
          )}

          <div
            className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin"
            role="tablist"
            aria-label={t('groupBoard.tabKnockout')}
          >
            {knockoutRoundLabels.map(({ stage, label }) => {
              const progress = knockoutRoundProgress(knockoutMatches, stage);
              if (progress.total === 0) return null;
              const isActive = activeKnockoutStage === stage;
              const isSelected = knockoutStage === stage;
              return (
                <button
                  key={stage}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => {
                    setKnockoutStage(stage);
                    setKnockoutStagePinned(true);
                  }}
                  className={`mobile-touch-target shrink-0 rounded-full px-3.5 py-2 text-xs font-medium transition sm:text-sm ${
                    isSelected
                      ? 'bg-cyan/15 text-cyan ring-1 ring-cyan/30'
                      : isActive
                        ? 'bg-live/10 text-live ring-1 ring-live/25'
                        : 'text-muted hover:bg-panel2/60 hover:text-foreground'
                  }`}
                >
                  {label}
                  <span className="ml-1 font-mono-data text-[10px] opacity-70">
                    ({progress.done}/{progress.total}
                    {progress.live > 0 ? ` · ${progress.live} ${t('common.live')}` : ''})
                  </span>
                </button>
              );
            })}
          </div>

          <KnockoutRoundPanel stage={knockoutStage} matches={knockoutMatches} />
        </div>
      )}
    </div>
  );
}
