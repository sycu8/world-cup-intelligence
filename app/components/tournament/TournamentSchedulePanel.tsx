import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ScheduleMatch } from '../../lib/api';
import { resolveMatchHref } from '../../lib/matchPaths';
import { downloadMatchIcs, downloadScheduleIcs, googleCalendarUrl } from '../../lib/calendarExport';
import { useFavorites } from '../../lib/useFavorites';
import { useI18n } from '../../lib/i18n/I18nContext';
import { matchStageLabel } from '../../lib/i18n/stageLabels';
import { FavoriteButton } from '../favorites/FavoriteButton';
import { MatchTeamsWithFlags } from '../team/TeamNameWithFlag';
import { CompactMatchProb } from './CompactMatchProb';
import { MatchKickoffDisplay, ScheduleTimezoneBanner } from '../match/MatchKickoffDisplay';
import { MatchResultScore, hasMatchResult } from '../match/MatchResultScore';
import { formatKickoffDateLong, getViewerLocale, localDateKey, SCHEDULE_TZ } from '../../lib/matchKickoffDisplay';

type Props = {
  byDate: Record<string, ScheduleMatch[]>;
  matches: ScheduleMatch[];
  totalExpected?: number;
  probs?: Record<string, { homeWin: number; draw: number; awayWin: number }>;
};

type StageFilter = 'all' | 'Group' | 'knockout';
type StatusFilter = 'all' | 'live' | 'scheduled' | 'completed';
type ViewMode = 'grid' | 'list';

export function TournamentSchedulePanel({
  byDate: _byDate,
  matches,
  totalExpected = 104,
  probs = {},
}: Props) {
  const { mode, t } = useI18n();
  const { toggleMatch, isMatchFavorite } = useFavorites();
  const appLocale = mode === 'en' ? 'en' : 'vi-VN';
  const locale = useMemo(() => getViewerLocale(appLocale), [appLocale]);
  const scheduleTz = SCHEDULE_TZ;

  const [stageFilter, setStageFilter] = useState<StageFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dayFilter, setDayFilter] = useState<string>('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [query, setQuery] = useState('');

  const allDates = useMemo(() => {
    const set = new Set<string>();
    for (const m of matches) {
      if (m.kickoff_utc) set.add(localDateKey(m.kickoff_utc, scheduleTz));
    }
    return [...set].sort();
  }, [matches, scheduleTz]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return matches.filter((m) => {
      if (stageFilter === 'Group' && m.stage !== 'Group') return false;
      if (stageFilter === 'knockout' && (m.stage === 'Group' || !m.stage)) return false;
      if (statusFilter === 'live' && m.status !== 'live') return false;
      if (statusFilter === 'scheduled' && m.status !== 'scheduled') return false;
      if (statusFilter === 'completed' && m.status !== 'completed' && m.status !== 'finished') {
        return false;
      }
      if (dayFilter !== 'all') {
        if (!m.kickoff_utc || localDateKey(m.kickoff_utc, scheduleTz) !== dayFilter) return false;
      }
      if (favoritesOnly && !isMatchFavorite(m.id)) return false;
      if (!q) return true;
      const blob =
        `${m.home_name} ${m.away_name} ${m.home_short ?? ''} ${m.away_short ?? ''} ${m.group_code ?? ''} ${m.stage ?? ''}`.toLowerCase();
      return blob.includes(q);
    });
  }, [matches, stageFilter, statusFilter, dayFilter, favoritesOnly, query, isMatchFavorite]);

  const filteredByDate = useMemo(() => {
    const out: Record<string, ScheduleMatch[]> = {};
    for (const m of filtered) {
      const d = m.kickoff_utc ? localDateKey(m.kickoff_utc, scheduleTz) : 'unknown';
      if (!out[d]) out[d] = [];
      out[d].push(m);
    }
    for (const d of Object.keys(out)) {
      out[d].sort((a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc));
    }
    return out;
  }, [filtered, scheduleTz]);

  const dates = Object.keys(filteredByDate).sort();
  const countLabel = t('calendar.countLabel')
    .replace('{n}', String(filtered.length))
    .replace('{total}', String(matches.length));

  const stageFilters: { id: StageFilter; key: 'calendar.filterAll' | 'calendar.filterGroup' | 'calendar.filterKnockout' }[] =
    [
      { id: 'all', key: 'calendar.filterAll' },
      { id: 'Group', key: 'calendar.filterGroup' },
      { id: 'knockout', key: 'calendar.filterKnockout' },
    ];

  const statusFilters: { id: StatusFilter; key: 'calendar.filterLive' | 'calendar.filterScheduled' | 'calendar.filterCompleted' }[] =
    [
      { id: 'live', key: 'calendar.filterLive' },
      { id: 'scheduled', key: 'calendar.filterScheduled' },
      { id: 'completed', key: 'calendar.filterCompleted' },
    ];

  function formatDayChip(date: string): string {
    const sample = filteredByDate[date]?.[0] ?? matches.find((m) => m.kickoff_utc && localDateKey(m.kickoff_utc, scheduleTz) === date);
    if (sample?.kickoff_utc) {
      return formatKickoffDateLong(sample.kickoff_utc, scheduleTz, locale);
    }
    return date;
  }

  function renderMatchActions(m: ScheduleMatch) {
    return (
      <div className="flex shrink-0 items-center gap-1">
        <FavoriteButton
          active={isMatchFavorite(m.id)}
          onToggle={() => toggleMatch(m.id)}
          label={`${m.home_name} vs ${m.away_name}`}
        />
        <a
          href={googleCalendarUrl(m)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/60 text-xs text-muted transition hover:border-cyan/40 hover:text-cyan"
          title={t('calendar.addGoogle')}
          aria-label={t('calendar.addGoogle')}
        >
          📅
        </a>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            downloadMatchIcs(m);
          }}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/60 text-xs text-muted transition hover:border-cyan/40 hover:text-cyan"
          title={t('calendar.downloadOne')}
          aria-label={t('calendar.downloadOne')}
        >
          ↓
        </button>
      </div>
    );
  }

  function renderMatchMeta(m: ScheduleMatch) {
    return (
      <p className="mt-1 flex flex-wrap items-center gap-x-1 text-xs text-muted">
        <MatchKickoffDisplay kickoffUtc={m.kickoff_utc} showLocalReference />
        {m.stage === 'Group' && m.group_code ? ` · ${t('calendar.groupLabel')} ${m.group_code}` : ''}
        {m.stage && m.stage !== 'Group' ? ` · ${matchStageLabel(m.stage, t)}` : ''}
        {hasMatchResult(m.status) && (
          <>
            <span aria-hidden> · </span>
            <MatchResultScore
              homeScore={m.home_score}
              awayScore={m.away_score}
              status={m.status}
              variant={m.status === 'completed' || m.status === 'finished' ? 'badge' : 'compact'}
            />
          </>
        )}
      </p>
    );
  }

  return (
    <section className="panel space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-pressing">{t('schedule.hubTitle')}</h2>
          <p className="mt-1 text-xs text-muted">{countLabel}</p>
          {matches.length < totalExpected && (
            <p className="mt-0.5 text-xs text-live">
              {t('calendar.seedLabel')
                .replace('{n}', String(matches.length))
                .replace('{total}', String(totalExpected))}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => downloadScheduleIcs(matches)}
            className="rounded-full border border-cyan/40 bg-cyan/10 px-3 py-1.5 text-xs font-semibold text-cyan transition hover:bg-cyan/20"
          >
            {t('calendar.downloadAll')}
          </button>
          <a
            href={matches[0] ? googleCalendarUrl(matches[0]) : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted transition hover:border-cyan/40 hover:text-cyan"
          >
            {t('calendar.addGoogle')}
          </a>
        </div>
      </div>

      <p className="text-xs text-muted-dim">{t('calendar.syncHint')}</p>
      <ScheduleTimezoneBanner />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('common.searchPlaceholder')}
          className="w-full flex-1 rounded-lg border border-border bg-panel2/80 px-3 py-2 text-sm outline-none focus:border-pressing"
        />
        <div className="flex gap-1 rounded-lg border border-border/60 p-0.5">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              viewMode === 'grid' ? 'bg-pressing/15 text-pressing' : 'text-muted'
            }`}
          >
            {t('schedule.viewGrid')}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              viewMode === 'list' ? 'bg-pressing/15 text-pressing' : 'text-muted'
            }`}
          >
            {t('schedule.viewList')}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {stageFilters.map((s) => (
          <FilterChip
            key={s.id}
            active={stageFilter === s.id}
            onClick={() => setStageFilter(s.id)}
            label={t(s.key)}
          />
        ))}
        <span className="mx-1 hidden h-5 w-px bg-border/60 sm:inline" aria-hidden />
        {statusFilters.map((s) => (
          <FilterChip
            key={s.id}
            active={statusFilter === s.id}
            onClick={() => setStatusFilter(statusFilter === s.id ? 'all' : s.id)}
            label={t(s.key)}
          />
        ))}
        <FilterChip
          active={favoritesOnly}
          onClick={() => setFavoritesOnly((v) => !v)}
          label={t('favorites.matchesTab')}
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        <FilterChip active={dayFilter === 'all'} onClick={() => setDayFilter('all')} label={t('calendar.filterAll')} />
        {allDates.map((date) => (
          <FilterChip
            key={date}
            active={dayFilter === date}
            onClick={() => setDayFilter(dayFilter === date ? 'all' : date)}
            label={formatDayChip(date)}
          />
        ))}
      </div>

      {dates.length === 0 ? (
        <p className="text-sm text-muted">{t('common.noFilterMatch')}</p>
      ) : (
        <div className="max-h-[70vh] space-y-6 overflow-y-auto pr-1 scrollbar-thin">
          {dates.map((date) => (
            <div key={date}>
              <p className="sticky top-0 z-10 mb-2 border-b border-border/60 bg-panel py-1 text-xs font-semibold uppercase tracking-wider text-pressing">
                {formatDayChip(date)}
                <span className="ml-2 font-normal text-muted">({filteredByDate[date].length})</span>
              </p>

              {viewMode === 'grid' ? (
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredByDate[date].map((m) => {
                    const prob = probs[m.id];
                    return (
                      <li key={m.id}>
                        <Link
                          to={resolveMatchHref(m)}
                          className="flex h-full flex-col rounded-xl border border-border/60 bg-panel2/40 text-sm transition hover:border-pressing/50 hover:bg-pressing/5"
                        >
                          <div className="flex items-start justify-between gap-2 px-3 pt-3">
                            <span className="font-medium leading-snug">
                              <MatchTeamsWithFlags
                                homeName={m.home_name}
                                awayName={m.away_name}
                                homeShort={m.home_short}
                                awayShort={m.away_short}
                                homeCountryCode={m.home_country_code}
                                awayCountryCode={m.away_country_code}
                                separator={mode === 'en' ? ' vs ' : ' – '}
                              />
                            </span>
                            <div className="flex items-center gap-1">
                              {m.status === 'live' && (
                                <span className="text-xs font-semibold text-live">{t('common.live')}</span>
                              )}
                              {renderMatchActions(m)}
                            </div>
                          </div>
                          <div className="px-3">{renderMatchMeta(m)}</div>
                          {prob && (
                            <div className="mt-2 px-3 pb-2.5">
                              <CompactMatchProb
                                homeWin={prob.homeWin}
                                draw={prob.draw}
                                awayWin={prob.awayWin}
                              />
                            </div>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <ul className="divide-y divide-border/40 rounded-lg border border-border/50 bg-panel2/20">
                  {filteredByDate[date].map((m) => {
                    const prob = probs[m.id];
                    return (
                      <li key={m.id}>
                        <Link
                          to={resolveMatchHref(m)}
                          className="flex flex-wrap items-center gap-2 px-2 py-2 text-sm transition hover:bg-pressing/5 sm:px-3"
                        >
                          <time className="w-14 shrink-0 font-mono-data text-[10px] text-muted sm:w-16">
                            <MatchKickoffDisplay kickoffUtc={m.kickoff_utc} showLocalReference={false} showGmt7Label />
                          </time>
                          <span className="min-w-0 flex-1 font-medium">
                            <MatchTeamsWithFlags
                              homeName={m.home_name}
                              awayName={m.away_name}
                              homeShort={m.home_short}
                              awayShort={m.away_short}
                              homeCountryCode={m.home_country_code}
                              awayCountryCode={m.away_country_code}
                              separator={mode === 'en' ? ' vs ' : ' – '}
                            />
                            {hasMatchResult(m.status) && (
                              <MatchResultScore
                                homeScore={m.home_score}
                                awayScore={m.away_score}
                                status={m.status}
                                variant={
                                  m.status === 'completed' || m.status === 'finished'
                                    ? 'badge'
                                    : 'inline'
                                }
                                className="ml-2"
                              />
                            )}
                          </span>
                          {m.stage === 'Group' && m.group_code && (
                            <span className="text-[10px] text-muted">
                              {t('calendar.groupLabel')} {m.group_code}
                            </span>
                          )}
                          <CompactMatchProb
                            homeWin={prob?.homeWin}
                            draw={prob?.draw}
                            awayWin={prob?.awayWin}
                          />
                          {renderMatchActions(m)}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function FilterChip({
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
      className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition ${
        active
          ? 'border-pressing bg-pressing/15 text-pressing'
          : 'border-border text-muted hover:border-pressing/40'
      }`}
    >
      {label}
    </button>
  );
}
