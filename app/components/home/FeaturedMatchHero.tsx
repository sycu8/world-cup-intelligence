import { Link } from 'react-router-dom';
import type { ScheduleMatch, ProbabilityData } from '../../lib/api';
import { resolveMatchHref } from '../../lib/matchPaths';
import { pct } from '../../lib/format';
import { ProbabilityStrip } from '../match/ProbabilityStrip';
import { Bilingual } from '../i18n/Bilingual';
import { useI18n } from '../../lib/i18n/I18nContext';
import { groupStageLabel, matchStageLabel } from '../../lib/i18n/stageLabels';
import { MatchKickoffCountdown } from './MatchKickoffCountdown';

type Props = {
  match: ScheduleMatch & { probability?: ProbabilityData | null };
};

export function FeaturedMatchHero({ match }: Props) {
  const { t } = useI18n();
  const p = match.probability;
  const stageLabel =
    match.stage === 'Group' && match.group_code
      ? groupStageLabel(match.group_code, t)
      : match.stage
        ? matchStageLabel(match.stage, t)
        : t('common.match');

  return (
    <section className="space-y-4">
      <div className="hero-glow overflow-hidden rounded-panel border border-cyan/25">
        <div className="border-b border-border/60 px-4 py-3 md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="label-tactical text-muted-dim">{stageLabel}</p>
            <MatchKickoffCountdown kickoffUtc={match.kickoff_utc} status={match.status} />
          </div>

          {p && (
            <p className="mt-2 font-mono-data text-xs text-muted">
              {t('featured.modelNow')}{' '}
              <span className="text-cyan">
                {t('common.abbrHome')} {pct(p.homeWinProb)}
              </span>{' '}
              <span className="text-muted">
                {t('common.abbrDraw')} {pct(p.drawProb)}
              </span>{' '}
              <span className="text-magenta">
                {t('common.abbrAway')} {pct(p.awayWinProb)}
              </span>
              {p.mostLikelyScore && (
                <span className="text-yellow">
                  {' '}
                  → {p.mostLikelyScore}
                </span>
              )}
            </p>
          )}

          <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 md:gap-4">
            <h2 className="font-heading text-right text-xl uppercase leading-none tracking-tight text-foreground md:text-3xl lg:text-4xl">
              {match.home_name}
            </h2>
            <div className="score-pulse rounded-card border border-cyan/30 bg-background/80 px-5 py-3 md:px-8 md:py-4">
              <p className="font-heading text-4xl tabular-nums text-foreground md:text-6xl">
                {match.home_score}
                <span className="mx-1 text-cyan/70">–</span>
                {match.away_score}
              </p>
            </div>
            <h2 className="font-heading text-left text-xl uppercase leading-none tracking-tight text-foreground md:text-3xl lg:text-4xl">
              {match.away_name}
            </h2>
          </div>
        </div>

        {p ? (
          <div className="p-4 md:p-5">
            <ProbabilityStrip
              homeWin={p.homeWinProb}
              draw={p.drawProb}
              awayWin={p.awayWinProb}
              xgHome={p.expectedHomeGoals}
              xgAway={p.expectedAwayGoals}
              confidence={p.confidence}
              homeLabel={match.home_name}
              awayLabel={match.away_name}
              live={match.status === 'live'}
            />
          </div>
        ) : (
          <p className="px-4 pb-4 text-sm text-muted md:px-6">{t('featured.probLoading')}</p>
        )}
      </div>

      <div className="flex justify-center">
        <Link
          to={resolveMatchHref(match)}
          className="rounded-full border border-cyan/40 bg-cyan/10 px-8 py-2.5 text-sm font-semibold text-cyan transition hover:bg-cyan/20"
        >
          <Bilingual k="match.fullAnalysis" as="span" /> →
        </Link>
      </div>
    </section>
  );
}
