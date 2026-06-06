import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ScheduleMatch } from '../../lib/api';
import { resolveMatchHref } from '../../lib/matchPaths';
import { Bilingual } from '../i18n/Bilingual';
import { useI18n } from '../../lib/i18n/I18nContext';

type Props = {
  byDate: Record<string, ScheduleMatch[]>;
  matches: ScheduleMatch[];
  totalExpected?: number;
};

type StageFilter = 'all' | 'Group' | 'knockout';

export function MatchScheduleCalendar({ byDate, matches, totalExpected = 104 }: Props) {
  const { mode, t } = useI18n();
  const [stageFilter, setStageFilter] = useState<StageFilter>('all');
  const [query, setQuery] = useState('');
  const locale = mode === 'en' ? 'en' : 'vi-VN';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return matches.filter((m) => {
      if (stageFilter === 'Group' && m.stage !== 'Group') return false;
      if (stageFilter === 'knockout' && (m.stage === 'Group' || !m.stage)) return false;
      if (!q) return true;
      const blob = `${m.home_name} ${m.away_name} ${m.home_short} ${m.away_short} ${m.group_code ?? ''} ${m.stage ?? ''}`.toLowerCase();
      return blob.includes(q);
    });
  }, [matches, stageFilter, query]);

  const filteredByDate = useMemo(() => {
    const out: Record<string, ScheduleMatch[]> = {};
    for (const m of filtered) {
      const d = m.kickoff_utc?.slice(0, 10) ?? 'unknown';
      if (!out[d]) out[d] = [];
      out[d].push(m);
    }
    for (const d of Object.keys(out)) {
      out[d].sort((a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc));
    }
    return out;
  }, [filtered]);

  const dates = Object.keys(filteredByDate).sort();
  const countLabel = t('calendar.countLabel')
    .replace('{n}', String(filtered.length))
    .replace('{total}', String(matches.length));

  const stages: { id: StageFilter; key: 'calendar.filterAll' | 'calendar.filterGroup' | 'calendar.filterKnockout' }[] = [
    { id: 'all', key: 'calendar.filterAll' },
    { id: 'Group', key: 'calendar.filterGroup' },
    { id: 'knockout', key: 'calendar.filterKnockout' },
  ];

  return (
    <section className="panel space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Bilingual
            k="home.calendar"
            as="h2"
            className="text-sm font-semibold uppercase tracking-wider text-pressing"
          />
          <p className="mt-1 text-xs text-muted">{countLabel}</p>
          {matches.length < totalExpected && (
            <p className="mt-0.5 text-xs text-live">
              {t('calendar.seedLabel')
                .replace('{n}', String(matches.length))
                .replace('{total}', String(totalExpected))}
            </p>
          )}
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('common.searchPlaceholder')}
          className="w-full max-w-xs rounded-lg border border-border bg-panel2/80 px-3 py-2 text-sm outline-none focus:border-pressing"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {stages.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStageFilter(s.id)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              stageFilter === s.id
                ? 'border-pressing bg-pressing/15 text-pressing'
                : 'border-border text-muted hover:border-pressing/40'
            }`}
          >
            {t(s.key)}
          </button>
        ))}
      </div>

      {dates.length === 0 ? (
        <p className="text-sm text-muted">
          {t('common.noFilterMatch')}
        </p>
      ) : (
        <div className="max-h-[70vh] space-y-6 overflow-y-auto pr-1 scrollbar-thin">
          {dates.map((date) => (
            <div key={date}>
              <p className="sticky top-0 z-10 mb-2 border-b border-border/60 bg-panel py-1 text-xs font-semibold uppercase tracking-wider text-pressing">
                {new Date(date + 'T12:00:00').toLocaleDateString(locale, {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
                <span className="ml-2 font-normal text-muted">({filteredByDate[date].length})</span>
              </p>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {filteredByDate[date].map((m) => (
                  <li key={m.id}>
                    <Link
                      to={resolveMatchHref(m)}
                      className="flex h-full flex-col rounded-xl border border-border/60 bg-panel2/40 px-3 py-2.5 text-sm transition hover:border-pressing/50 hover:bg-pressing/5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium leading-snug">
                          {m.home_short ?? m.home_name}
                          <span className="text-muted"> vs </span>
                          {m.away_short ?? m.away_name}
                        </span>
                        {m.status === 'live' && (
                          <span className="shrink-0 text-xs font-semibold text-live">LIVE</span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {new Date(m.kickoff_utc).toLocaleTimeString(locale, {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {m.stage === 'Group' && m.group_code ? ` · ${t('calendar.groupLabel')} ${m.group_code}` : ''}
                        {m.stage && m.stage !== 'Group' ? ` · ${m.stage}` : ''}
                        {m.status === 'live' && ` · ${m.home_score}-${m.away_score}`}
                        {m.status === 'completed' && ` · ${m.home_score}-${m.away_score}`}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
