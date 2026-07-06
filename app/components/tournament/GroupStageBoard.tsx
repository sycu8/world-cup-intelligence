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
import { MatchScoreBreakdown } from '../match/MatchScoreBreakdown';
import { MatchForecastScore } from '../match/MatchForecastScore';
import { MatchForecastExtras } from '../match/MatchForecastExtras';
import { ChampionOddsPanel } from '../home/ChampionOddsPanel';
import type { ChampionOddsPayload } from '../../lib/api';

export type BoardMatchProbability = {
  homeWin: number;
  draw: number;
  awayWin: number;
  mostLikelyScore?: string;
  extraTimeProb?: number;
  penaltyProb?: number;
};

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'] as const;
const STANDINGS_REFRESH_MS = 30_000;

type MainTab = 'group' | 'knockout';

function formatGd(gd: number): string {
  return gd > 0 ? `+${gd}` : String(gd);
}

function BoardLegend() {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-border/40 bg-panel2/20 px-3 py-2 text-xs text-muted">
      <span className="font-semibold text-foreground/90">{t('groupBoard.legendTitle')}:</span>
      <span className="inline-flex items-center gap-1">
        <span className="qualify-badge qualify-badge--direct">Q</span>
        {t('groupBoard.legendQualified')}
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="qualify-badge qualify-badge--third">3</span>
        {t('groupBoard.legendThird')}
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="rounded border border-yellow/35 bg-yellow/10 px-1 font-mono-data text-yellow">2–1</span>
        {t('groupBoard.legendForecast')}
      </span>
    </div>
  );
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
      className={`rounded-xl px-3 py-2 text-xs font-semibold transition sm:text-sm ${
        active
          ? 'bg-cyan/15 text-cyan ring-1 ring-cyan/30'
          : 'text-muted hover:bg-panel2/60 hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );
}

function BoardMatchRow({
  match,
  prob,
  showDate = false,
}: {
  match: ScheduleMatch;
  prob?: BoardMatchProbability;
  showDate?: boolean;
}) {
  const { t } = useI18n();
  const isFinal = match.status === 'completed' || match.status === 'finished';
  const showScore = hasMatchResult(match.status);
  const showBreakdown = isFinal && !!match.scoreDetail;
  const showForecast = match.status === 'scheduled' && !!prob?.mostLikelyScore;

  return (
    <Link
      to={resolveMatchHref(match)}
      className={`group grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-1.5 rounded-md px-2 py-1.5 transition hover:bg-pressing/10 sm:gap-2 ${
        showBreakdown ? 'gap-y-0.5 pb-1.5' : 'items-center'
      }`}
    >
      <time className="col-start-1 row-start-1 shrink-0 whitespace-nowrap font-mono-data text-[10px] leading-none text-muted">
        <MatchKickoffDisplay
          kickoffUtc={match.kickoff_utc}
          showDate={showDate}
          inlineDate={showDate}
          showLocalReference={false}
        />
      </time>

      <span className="col-start-2 row-start-1 min-w-0 truncate text-[10px] font-medium leading-tight text-foreground/90 sm:text-[11px]">
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

      <span className="col-start-3 row-start-1 flex shrink-0 flex-col items-end justify-center gap-0.5 self-center">
        {showScore ? (
          <MatchResultScore
            homeScore={match.home_score}
            awayScore={match.away_score}
            status={match.status}
            variant={isFinal ? 'badge' : 'compact'}
          />
        ) : showForecast ? (
          <>
            <MatchForecastScore score={prob!.mostLikelyScore!} />
            <MatchForecastExtras
              extraTimeProb={prob?.extraTimeProb}
              penaltyProb={prob?.penaltyProb}
            />
          </>
        ) : (
          <span className="font-mono-data text-[10px] text-muted/35">–</span>
        )}
        {match.status === 'live' && (
          <span className="text-[9px] font-bold uppercase leading-none text-live">{t('common.live')}</span>
        )}
      </span>

      {showBreakdown && (
        <div className="col-start-2 col-end-4 row-start-2 min-w-0">
          <MatchScoreBreakdown
            detail={match.scoreDetail}
            variant="stacked"
            compact
            className="w-full"
          />
        </div>
      )}
    </Link>
  );
}

function KnockoutBoardMatchRow({
  match,
  prob,
  showDate = false,
}: {
  match: ScheduleMatch;
  prob?: BoardMatchProbability;
  showDate?: boolean;
}) {
  const { t } = useI18n();
  const isFinal = match.status === 'completed' || match.status === 'finished';
  const showScore = hasMatchResult(match.status);
  const showBreakdown = isFinal && !!match.scoreDetail;
  const showForecast = match.status === 'scheduled' && !!prob?.mostLikelyScore;
  const flagClassName = 'h-3.5 w-5 shrink-0 rounded-sm object-cover ring-1 ring-white/10 sm:h-4 sm:w-6';

  const scoreCell = showScore ? (
    <MatchResultScore
      homeScore={match.home_score}
      awayScore={match.away_score}
      status={match.status}
      variant={isFinal ? 'badge' : 'compact'}
    />
  ) : showForecast ? (
    <div className="flex flex-col items-center gap-0.5">
      <MatchForecastScore score={prob!.mostLikelyScore!} />
      <MatchForecastExtras
        extraTimeProb={prob?.extraTimeProb}
        penaltyProb={prob?.penaltyProb}
      />
    </div>
  ) : (
    <span className="font-mono-data text-xs text-muted/40">vs</span>
  );

  return (
    <Link
      to={resolveMatchHref(match)}
      className="surface-interactive group block rounded-lg border border-border/50 bg-panel2/25 px-3 py-2.5 sm:px-4"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <time className="font-mono-data text-[10px] leading-none text-muted sm:text-[11px]">
          <MatchKickoffDisplay
            kickoffUtc={match.kickoff_utc}
            showDate={showDate}
            inlineDate={showDate}
            showLocalReference={false}
          />
        </time>
        {match.status === 'live' && (
          <span className="text-[9px] font-bold uppercase leading-none text-live">{t('common.live')}</span>
        )}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1 sm:gap-x-3">
        <div className="flex min-w-0 justify-end">
          <TeamNameWithFlag
            name={match.home_short?.trim() || match.home_name}
            flagName={match.home_name}
            countryCode={match.home_country_code}
            compact
            flagClassName={flagClassName}
            className="max-w-full justify-end truncate text-right text-[11px] font-medium sm:text-xs"
          />
        </div>

        <div className="flex shrink-0 flex-col items-center justify-center px-0.5">{scoreCell}</div>

        <div className="flex min-w-0 justify-start">
          <TeamNameWithFlag
            name={match.away_short?.trim() || match.away_name}
            flagName={match.away_name}
            countryCode={match.away_country_code}
            compact
            flagClassName={flagClassName}
            className="max-w-full truncate text-[11px] font-medium sm:text-xs"
          />
        </div>
      </div>

      {showBreakdown && (
        <div className="mt-2 border-t border-border/40 pt-1.5">
          <MatchScoreBreakdown
            detail={match.scoreDetail}
            variant="stacked"
            compact
            className="justify-center"
          />
        </div>
      )}
    </Link>
  );
}

function GroupCard({
  code,
  standings,
  fixtures,
  standingsUnavailable,
  probs,
}: {
  code: string;
  standings: GroupStandingsPayload['groups'][string] | undefined;
  fixtures: ScheduleMatch[];
  standingsUnavailable?: boolean;
  probs: Record<string, BoardMatchProbability>;
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
                  {row.rank <= 2 && (
                    <span className="qualify-badge qualify-badge--direct">Q</span>
                  )}
                  {row.rank === 3 && (
                    <span className="qualify-badge qualify-badge--third">3</span>
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
            <BoardMatchRow match={m} prob={probs[m.id]} showDate />
          </li>
        ))}
      </ul>
    </div>
  );
}

function KnockoutRoundPanel({
  stage,
  matches,
  probs,
  limit,
}: {
  stage: KnockoutStage;
  matches: ScheduleMatch[];
  probs: Record<string, BoardMatchProbability>;
  limit?: number;
}) {
  const { t } = useI18n();

  const roundMatches = useMemo(
    () =>
      matches
        .filter((m) => m.stage === stage)
        .sort((a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc)),
    [matches, stage],
  );

  const visible = limit ? roundMatches.slice(0, limit) : roundMatches;
  const hiddenCount = limit ? Math.max(0, roundMatches.length - limit) : 0;

  if (roundMatches.length === 0) {
    return <p className="py-6 text-center text-sm text-muted">{t('groupBoard.knockoutEmpty')}</p>;
  }

  return (
    <>
      <ul className="grid gap-2 sm:grid-cols-2">
        {visible.map((m) => (
          <li key={m.id}>
            <KnockoutBoardMatchRow match={m} prob={probs[m.id]} showDate />
          </li>
        ))}
      </ul>
      {hiddenCount > 0 && (
        <p className="mt-3 text-center">
          <Link to="/matches?tab=standings" className="text-sm font-medium text-cyan hover:underline">
            +{hiddenCount} {t('groupBoard.tabKnockout').toLowerCase()} →
          </Link>
        </p>
      )}
    </>
  );
}

function GroupStagePanel({
  standings,
  standingsError,
  groupFixtures,
  probs,
  championOdds,
  championOddsLoading,
  mode = 'full',
  selectedGroup,
  onSelectGroup,
}: {
  standings: GroupStandingsPayload | null;
  standingsError: boolean;
  groupFixtures: Record<string, ScheduleMatch[]>;
  probs: Record<string, BoardMatchProbability>;
  championOdds?: ChampionOddsPayload | null;
  championOddsLoading?: boolean;
  mode?: 'full' | 'home';
  selectedGroup?: string;
  onSelectGroup?: (code: string) => void;
}) {
  const { t } = useI18n();
  const isHome = mode === 'home';
  const groupsToShow = isHome && selectedGroup ? [selectedGroup] : [...GROUPS];

  return (
    <div className="space-y-4">
      {!isHome && <BoardLegend />}
      {isHome && onSelectGroup && (
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin" role="tablist">
          {GROUPS.map((code) => (
            <button
              key={code}
              type="button"
              role="tab"
              aria-selected={selectedGroup === code}
              onClick={() => onSelectGroup(code)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                selectedGroup === code
                  ? 'bg-cyan/15 text-cyan ring-1 ring-cyan/30'
                  : 'text-muted hover:bg-panel2/50 hover:text-foreground'
              }`}
            >
              {code}
            </button>
          ))}
        </div>
      )}
      {!isHome && (
        <div className="min-w-0">
          <p className="font-mono-data text-xs text-muted-dim sm:text-sm">
            {t('groupBoard.standingsHint')}
          </p>
        </div>
      )}

      <div
        className={
          isHome ? 'max-w-xl' : 'grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
        }
      >
        {groupsToShow.map((code) => (
          <GroupCard
            key={code}
            code={code}
            standings={standings?.groups[code]}
            fixtures={isHome ? (groupFixtures[code] ?? []).slice(0, 3) : groupFixtures[code] ?? []}
            standingsUnavailable={standingsError}
            probs={probs}
          />
        ))}
      </div>

      {!isHome && standings && standings.thirdPlaceRanking.length > 0 && (
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

      {(championOdds || championOddsLoading) && !isHome && (
        <ChampionOddsPanel odds={championOdds ?? null} loading={championOddsLoading} layout="compact" />
      )}
    </div>
  );
}

type Props = {
  matches: ScheduleMatch[];
  initialStandings?: GroupStandingsPayload | null;
  initialProbs?: Record<string, BoardMatchProbability>;
  championOdds?: ChampionOddsPayload | null;
  championOddsLoading?: boolean;
  mode?: 'full' | 'home';
};

export function GroupStageBoard({
  matches,
  initialStandings = null,
  initialProbs = {},
  championOdds = null,
  championOddsLoading = false,
  mode = 'full',
}: Props) {
  const { t } = useI18n();
  const isHome = mode === 'home';
  const hasInitialBoard = !!initialStandings;
  const [mainTab, setMainTab] = useState<MainTab>('group');
  const [knockoutStage, setKnockoutStage] = useState<KnockoutStage>('Round of 32');
  const [knockoutStagePinned, setKnockoutStagePinned] = useState(false);
  const [standings, setStandings] = useState<GroupStandingsPayload | null>(initialStandings);
  const [standingsError, setStandingsError] = useState(false);
  const [groupLoading, setGroupLoading] = useState(!hasInitialBoard);
  const [probs, setProbs] = useState<Record<string, BoardMatchProbability>>(initialProbs);
  const [selectedGroup, setSelectedGroup] = useState<string>('A');
  const prevAllGroupsComplete = useRef(false);

  useEffect(() => {
    if (Object.keys(initialProbs).length > 0) {
      setProbs(initialProbs);
    }
  }, [initialProbs]);

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

  useEffect(() => {
    let cancelled = false;

    const loadProbs = () => {
      api
        .tournamentMatchProbabilities(2026)
        .then((res) => {
          if (!cancelled) setProbs(res.data);
        })
        .catch(() => undefined);
    };

    loadProbs();
    const timer = setInterval(loadProbs, STANDINGS_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

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
      {!isHome && (
        <div>
          <h2 className="section-title">{t('groupBoard.title')}</h2>
          <p className="section-subtitle">{t('groupBoard.subtitle')}</p>
        </div>
      )}

      <nav
        className="flex flex-wrap gap-2 rounded-xl border border-border/40 bg-panel2/20 p-1.5"
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
            championOdds={championOdds}
            championOddsLoading={championOddsLoading}
            mode={mode}
            selectedGroup={selectedGroup}
            onSelectGroup={isHome ? setSelectedGroup : undefined}
          />
        )
      ) : (
        <div className="space-y-3">
          {!isHome && <p className="text-xs text-muted">{t('groupBoard.knockoutSubtitle')}</p>}
          {!allGroupsComplete && !isHome && (
            <p className="rounded-lg border border-border/50 bg-panel2/20 px-3 py-2 text-xs text-muted">
              {t('groupBoard.knockoutLocked')}
            </p>
          )}

          <div className={isHome ? 'space-y-3' : 'grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] xl:items-start'}>
            <div className="space-y-3">
              <div
                className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-thin"
                role="tablist"
                aria-label={t('groupBoard.tabKnockout')}
              >
                {knockoutRoundLabels.map(({ stage, label }) => {
                  const progress = knockoutRoundProgress(knockoutMatches, stage);
                  if (progress.total === 0) return null;
                  const isActive = activeKnockoutStage === stage;
                  const isSelected = knockoutStage === stage;
                  const pctDone =
                    progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
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
                      className={`mobile-touch-target shrink-0 rounded-xl px-3.5 py-2 text-xs font-medium transition sm:text-sm ${
                        isSelected
                          ? 'bg-cyan/15 text-cyan ring-1 ring-cyan/30'
                          : isActive
                            ? 'bg-live/10 text-live ring-1 ring-live/25'
                            : 'text-muted hover:bg-panel2/60 hover:text-foreground'
                      }`}
                    >
                      {isHome ? (
                        <>
                          {label}
                          <span className="ml-1 font-mono-data opacity-70">
                            {progress.done}/{progress.total}
                          </span>
                        </>
                      ) : (
                        <span className="flex flex-col items-start gap-1">
                          <span>
                            {label}
                            <span className="ml-1 font-mono-data text-[10px] opacity-70">
                              {progress.done}/{progress.total}
                              {progress.live > 0 ? ` · ${progress.live} ${t('common.live')}` : ''}
                            </span>
                          </span>
                          <span className="h-1 w-full min-w-[4rem] overflow-hidden rounded-full bg-background2/80">
                            <span
                              className="progress-bar-fill block h-full rounded-full bg-current opacity-60"
                              style={{ width: `${pctDone}%` }}
                            />
                          </span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <KnockoutRoundPanel
                stage={knockoutStage}
                matches={knockoutMatches}
                probs={probs}
                limit={isHome ? 4 : undefined}
              />
            </div>

            {!isHome && (championOdds || championOddsLoading) && (
              <div className="xl:sticky xl:top-[4.5rem]">
                <ChampionOddsPanel
                  odds={championOdds ?? null}
                  loading={championOddsLoading}
                  layout="compact"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {isHome && (
        <p className="text-center">
          <Link to="/matches?tab=standings" className="btn-ghost">
            {t('home.viewFullBoard')}
          </Link>
        </p>
      )}
    </div>
  );
}
