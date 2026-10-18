import type { TacticalBriefing } from '../../lib/api';
import { SourceConfidencePanel } from '../intelligence/SourceConfidencePanel';
import { SectionLabel } from './SectionLabel';
import { useI18n } from '../../lib/i18n/I18nContext';
import { Bilingual } from '../i18n/Bilingual';
import { pickLocalized, type LocalizedString } from '../../lib/briefingText';

type Props = {
  briefing: TacticalBriefing | null;
  loading?: boolean;
  generating?: boolean;
  timedOut?: boolean;
};

function LocalizedBlock({
  value,
  as = 'p',
  className = '',
}: {
  value: LocalizedString;
  as?: 'p' | 'li';
  className?: string;
}) {
  const { mode } = useI18n();
  const Tag = as;
  return <Tag className={className}>{pickLocalized(value, mode)}</Tag>;
}

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

  return (
    <div className="panel-dense space-y-4 border-magenta/15">
      <SectionLabel
        title={t('match.briefingTitle')}
        subtitle={
          generating
            ? t(timedOut ? 'match.briefingTryAgain' : 'match.briefingGenerating')
            : t('match.briefingAiSubtitle')
        }
        accent="magenta"
      />

      <LocalizedBlock value={briefing.summary} className="text-sm leading-relaxed text-foreground/90" />

      {briefing.probabilityExplanation.length > 0 && (
        <div className="takeaway-card">
          <Bilingual k="match.briefingTakeaways" as="p" className="label-tactical mb-2 text-cyan" />
          <ul className="list-disc space-y-2 pl-5 text-sm text-foreground/85">
            {briefing.probabilityExplanation.map((line, i) => (
              <LocalizedBlock key={i} value={line} as="li" />
            ))}
          </ul>
        </div>
      )}

      {briefing.uncertaintyNotes.length > 0 && (
        <div
          className="rounded-xl border border-yellow/25 bg-yellow/5 px-4 py-3 text-sm leading-relaxed text-yellow/95"
          role="note"
        >
          {briefing.uncertaintyNotes.map((note, i) => (
            <p key={i} className={i > 0 ? 'mt-2' : undefined}>
              {pickLocalized(note, mode)}
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
