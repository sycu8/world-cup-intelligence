import { pctCompact } from '../../lib/format';
import { useI18n } from '../../lib/i18n/I18nContext';

type Props = {
  homeWin?: number;
  draw?: number;
  awayWin?: number;
};

/** Compact C·H·K percentages for schedule rows — tap match row for full analysis. */
export function CompactMatchProb({ homeWin, draw, awayWin }: Props) {
  const { t } = useI18n();

  if (homeWin == null || draw == null || awayWin == null) {
    return (
      <span
        className="shrink-0 font-mono-data text-[9px] italic text-muted-dim sm:text-[10px]"
        title={t('compactProb.noAnalysisTitle')}
      >
        {t('compactProb.noAnalysis')}
      </span>
    );
  }

  return (
    <span
      className="inline-flex shrink-0 items-center gap-0.5 font-mono-data text-[10px] tabular-nums leading-none sm:text-[11px]"
      title={`${t('common.abbrHome')} ${pctCompact(homeWin)} · ${t('common.abbrDraw')} ${pctCompact(draw)} · ${t('common.abbrAway')} ${pctCompact(awayWin)}`}
    >
      <span className="text-cyan">{pctCompact(homeWin)}</span>
      <span className="text-muted/60">·</span>
      <span className="text-foreground/75">{pctCompact(draw)}</span>
      <span className="text-muted/60">·</span>
      <span className="text-magenta">{pctCompact(awayWin)}</span>
    </span>
  );
}
