import { useI18n } from '../../lib/i18n/I18nContext';
import { lineupSourceBadgeClass, lineupSourceLocaleKey } from '../../lib/lineupSourceLabel';
import type { MatchPreviewAnalysis } from '../../lib/api';

export function LineupColumn({
  side,
  label,
}: {
  side: MatchPreviewAnalysis['home'];
  label: string;
}) {
  const { t } = useI18n();
  const hasLineup = side.hasAccurateLineup ?? side.lineupSource === 'official';

  return (
    <div className="rounded-card border border-border/50 bg-background/40 p-3">
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
      <p className="mt-1 font-heading text-lg text-foreground">
        {side.teamName}
        {hasLineup && side.formation && (
          <span className="font-mono-data text-sm text-cyan"> {side.formation}</span>
        )}
      </p>
      {hasLineup ? (
        <ul className="mt-2 space-y-0.5 font-mono-data text-[11px] text-foreground/90">
          {side.fullLineup.map((p, i) => (
            <li key={`${p}-${i}`}>{p}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-muted">{t('match.lineupPending')}</p>
      )}
    </div>
  );
}
