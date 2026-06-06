import { Bilingual } from '../i18n/Bilingual';
import { useI18n } from '../../lib/i18n/I18nContext';
import { matchStageLabel } from '../../lib/i18n/stageLabels';
import { pct } from '../../lib/format';

type Props = {
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  status: string;
  stage?: string;
  venue?: string;
  homeWin?: number;
  draw?: number;
  awayWin?: number;
  mostLikelyScore?: string;
};

function statusKey(status: string): 'common.live' | 'match.scheduled' | 'common.ft' | null {
  if (status === 'live') return 'common.live';
  if (status === 'scheduled') return 'match.scheduled';
  if (status === 'completed') return 'common.ft';
  return null;
}

export function MatchHeader({
  home,
  away,
  homeScore,
  awayScore,
  status,
  stage,
  venue,
  homeWin,
  draw,
  awayWin,
  mostLikelyScore,
}: Props) {
  const { t } = useI18n();
  const statusText = statusKey(status) ? t(statusKey(status)!) : status.toUpperCase();
  const isLive = status === 'live';

  return (
    <header className="hero-glow panel border-cyan/20">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2 md:pb-3">
        <p className="label-tactical text-muted">
          {stage ? matchStageLabel(stage, t) : t('matchHeader.matchLabel')}
        </p>
        <span
          className={`font-display text-sm tracking-widest ${
            isLive ? 'text-live animate-pulse' : 'text-muted'
          }`}
        >
          {statusText}
        </span>
      </div>

      {homeWin != null && (
        <div className="mt-2 flex flex-wrap items-center gap-3 border-b border-border/40 pb-2 md:mt-3 md:gap-4 md:pb-3">
          <div className="font-mono-data text-xs text-muted">
            {t('featured.modelNow')}
          </div>
          <div className="flex flex-wrap gap-4 font-mono-data text-sm">
            <span className="text-cyan">
              {t('common.abbrHome')} <span className="text-foreground">{pct(homeWin)}</span>
            </span>
            <span className="text-muted">
              {t('common.abbrDraw')} <span className="text-foreground">{pct(draw ?? 0)}</span>
            </span>
            <span className="text-magenta">
              {t('common.abbrAway')} <span className="text-foreground">{pct(awayWin ?? 0)}</span>
            </span>
          </div>
          {mostLikelyScore && (
            <span className="font-mono-data text-xs text-yellow">
              → {mostLikelyScore}
            </span>
          )}
        </div>
      )}

      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 md:mt-4 md:gap-6">
        <h1 className="font-display text-right text-base leading-tight tracking-wide text-foreground sm:text-xl md:text-4xl lg:text-5xl">
          {home}
        </h1>
        <div className="score-pulse rounded-lg border border-cyan/30 bg-background/80 px-3 py-2 md:rounded-xl md:px-8 md:py-4">
          <p className="font-display text-2xl tabular-nums text-foreground sm:text-3xl md:text-6xl lg:text-7xl">
            {homeScore}
            <span className="mx-0.5 text-cyan/60 md:mx-1">–</span>
            {awayScore}
          </p>
        </div>
        <h1 className="font-display text-left text-base leading-tight tracking-wide text-foreground sm:text-xl md:text-4xl lg:text-5xl">
          {away}
        </h1>
      </div>

      {venue && (
        <p className="mt-2 text-center font-mono-data text-[11px] text-muted">{venue}</p>
      )}
    </header>
  );
}
