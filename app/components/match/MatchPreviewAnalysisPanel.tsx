import type { MatchPreviewAnalysis } from '../../lib/api';
import { SectionLabel } from '../tactical/SectionLabel';
import { useI18n } from '../../lib/i18n/I18nContext';
import { pickLocalized, type LocalizedString } from '../../lib/briefingText';
import { formatKickoffDateTime, getViewerLocale } from '../../lib/matchKickoffDisplay';
import { formatMatchVersus } from '../../lib/matchTeams';
import { matchVersusSeparator } from '../../lib/i18n/stageLabels';
import { LineupColumn } from './LineupColumn';

type Props = {
  preview: MatchPreviewAnalysis | null;
  loading?: boolean;
  variant?: 'default' | 'editorial';
};

function Block({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-card border border-border/50 bg-panel2/40 px-3 py-3">
      <p className="label-tactical mb-1.5 text-cyan/90">{title}</p>
      <p className="text-sm leading-relaxed text-foreground/90">{text}</p>
    </div>
  );
}

export function MatchPreviewAnalysisPanel({ preview, loading, variant = 'default' }: Props) {
  const { mode, t } = useI18n();
  const editorial = variant === 'editorial';

  if (loading) {
    return (
      <div className="panel-dense text-sm text-muted">
        {t('match.previewLoading')}
      </div>
    );
  }

  if (!preview) return null;

  const pick = (line: LocalizedString) => pickLocalized(line, mode);
  const locale = getViewerLocale(mode === 'en' ? 'en' : 'vi-VN');
  const versusLabel = formatMatchVersus(
    preview.home.teamId,
    preview.away.teamId,
    preview.home.teamName,
    preview.away.teamName,
    matchVersusSeparator(mode),
  );

  return (
    <section
      className={
        editorial
          ? 'space-y-5 border-t border-border/40 pt-6'
          : 'panel-elevated space-y-5 border-cyan/20'
      }
    >
      <div
        className={`flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between ${
          editorial ? 'border-b border-border/40 pb-5' : 'gap-3 border-b border-border/50 pb-4'
        }`}
      >
        <div className="min-w-0">
          {!editorial && (
            <SectionLabel
              title={t('match.previewTitle')}
              subtitle={t('match.previewSubtitle')}
              accent="cyan"
            />
          )}
          {editorial && (
            <p className="label-tactical text-cyan">{t('match.previewTitle')}</p>
          )}
          <p className={`font-heading text-foreground ${editorial ? 'mt-2 text-lg sm:text-xl' : 'mt-2 text-xl'}`}>
            {pick(preview.matchLabel)}
          </p>
          <p className="mt-1 break-words font-mono-data text-[11px] text-muted-dim sm:text-xs">
            {versusLabel} ·{' '}
            {formatKickoffDateTime(preview.kickoffUtc, locale, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </p>
        </div>
        {preview.scorelineTop3.length > 0 && (
          <div
            className={`shrink-0 rounded-card border border-yellow/25 bg-yellow/5 px-3 py-2 ${
              editorial ? 'w-full sm:w-auto' : ''
            }`}
          >
            <p className="label-tactical text-yellow">{t('match.topScores')}</p>
            <ul className="mt-1 font-mono-data text-sm">
              {preview.scorelineTop3.map((s) => (
                <li key={s.score}>
                  {s.score} <span className="text-muted">({pct(s.prob)})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <p className={`leading-relaxed text-foreground ${editorial ? 'text-base sm:text-lg' : 'text-base'}`}>
        {pick(preview.summary)}
      </p>

      {preview.insights.length > 0 && (
        <ul className="space-y-2">
          {preview.insights.map((ins, i) => (
            <li
              key={i}
              className="rounded-card border border-magenta/20 bg-magenta/5 px-3 py-2 text-sm text-foreground/90"
            >
              {pick(ins)}
            </li>
          ))}
        </ul>
      )}

      <div className={`grid gap-3 ${editorial ? 'sm:grid-cols-2' : 'lg:grid-cols-2'}`}>
        <Block title={t('match.previewContext')} text={pick(preview.sections.context)} />
        <Block title={t('match.previewTactical')} text={pick(preview.sections.tactical)} />
        <Block title={t('match.previewStrength')} text={pick(preview.sections.strength)} />
        <Block title={t('match.previewForm')} text={pick(preview.sections.form)} />
      </div>

      <div>
        <p className="label-tactical mb-3 text-magenta">{t('match.previewLineup')}</p>
        <div className="grid gap-3 md:grid-cols-2">
          <LineupColumn side={preview.home} label={t('common.home')} matchRef={preview.matchId} />
          <LineupColumn side={preview.away} label={t('common.away')} matchRef={preview.matchId} />
        </div>
      </div>

      {preview.probabilityNote && (
        <p className="font-mono-data text-xs text-cyan/90">{pick(preview.probabilityNote)}</p>
      )}
    </section>
  );
}
