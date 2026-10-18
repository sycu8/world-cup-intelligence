import type { TacticalBriefing } from '../../lib/api';
import { SourceConfidencePanel } from '../intelligence/SourceConfidencePanel';
import { SectionLabel } from './SectionLabel';
import { useI18n } from '../../lib/i18n/I18nContext';
import { Bilingual } from '../i18n/Bilingual';
import {
  isStatisticalDraftSummary,
  pickLocalized,
  visibleBriefingLines,
} from '../../lib/briefingText';

type Props = {
  briefing: TacticalBriefing | null;
  loading?: boolean;
  generating?: boolean;
  timedOut?: boolean;
};

function mapCitation(
  c: TacticalBriefing['citations'][number] & { reliabilityScore?: number; sourceUrl?: string; sourceDocumentId?: string },
  t: (key: 'source.platformBriefing') => string,
) {
  const isPlatformSource =
    c.sourceName === 'Platform' ||
    c.sourceName === 'PitchIntel' ||
    c.sourceDocumentId === 'doc-1' ||
    c.sourceDocumentId === 'platform-model';

  return {
    name: isPlatformSource
      ? t('source.platformBriefing')
      : c.title
        ? `${c.sourceName} — ${c.title}`
        : c.sourceName,
    score: c.reliabilityScore ?? 0.75,
    url: c.sourceUrl,
  };
}

export function TacticalBriefingPanel({ briefing, loading, generating, timedOut }: Props) {
  const { mode, t } = useI18n();

  if (loading) {
    return (
      <div className="panel-dense text-sm text-muted">
        <Bilingual k="match.briefingLoading" />
      </div>
    );
  }
  if (!briefing) return null;

  const citations = briefing.citations.map((c) => mapCitation(c, t));
  const summaryText = pickLocalized(briefing.summary, mode).trim();
  const takeaways = visibleBriefingLines(briefing.probabilityExplanation, mode);
  const notes = visibleBriefingLines(briefing.uncertaintyNotes, mode);
  const subtitle = timedOut
    ? t('match.briefingTryAgain')
    : generating
      ? t('match.briefingGenerating')
      : isStatisticalDraftSummary(briefing.summary)
        ? t('match.briefingDraftSubtitle')
        : t('match.briefingAiSubtitle');

  return (
    <div className="panel-dense space-y-4 border-magenta/15">
      <SectionLabel
        title={t('match.briefingTitle')}
        subtitle={subtitle}
        accent="magenta"
      />

      {summaryText && (
        <p className="text-sm leading-relaxed text-foreground/90">{summaryText}</p>
      )}

      {takeaways.length > 0 && (
        <div className="takeaway-card">
          <Bilingual k="match.briefingTakeaways" as="p" className="label-tactical mb-2 text-cyan" />
          <ul className="list-disc space-y-2 pl-5 text-sm text-foreground/85">
            {takeaways.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {notes.length > 0 && (
        <div
          className="rounded-xl border border-yellow/25 bg-yellow/5 px-4 py-3 text-sm leading-relaxed text-yellow/95"
          role="note"
        >
          {notes.map((note, i) => (
            <p key={i} className={i > 0 ? 'mt-2' : undefined}>
              {note}
            </p>
          ))}
        </div>
      )}

      {citations.length > 0 && (
        <div className="space-y-2 border-t border-border/40 pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            {t('source.title')}
          </p>
          <SourceConfidencePanel sources={citations} compact />
        </div>
      )}
    </div>
  );
}
