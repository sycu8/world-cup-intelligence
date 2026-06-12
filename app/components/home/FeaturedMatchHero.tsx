import { Link } from 'react-router-dom';
import type { ScheduleMatch, ProbabilityData } from '../../lib/api';
import { resolveMatchHref } from '../../lib/matchPaths';
import { pct } from '../../lib/format';
import { ProbabilityStrip } from '../match/ProbabilityStrip';
import { Bilingual } from '../i18n/Bilingual';
import { useI18n } from '../../lib/i18n/I18nContext';
import { groupStageLabel, matchStageLabel } from '../../lib/i18n/stageLabels';
import { MatchKickoffCountdown } from './MatchKickoffCountdown';
import { TeamNameWithFlag } from '../team/TeamNameWithFlag';
import { PredictedActualScores } from '../match/PredictedActualScores';
import { DataKindBadge, DataKindMark } from '../ui/DataKindBadge';
import { MatchVersusThumbnail } from '../match/MatchVersusThumbnail';

type Props = {
  match: ScheduleMatch & { probability?: ProbabilityData | null };
};

export function FeaturedMatchHero({ match }: Props) {
  const { t } = useI18n();
  const p = match.probability;
  const isLive = match.status === 'live';
  const sectionLabel = isLive ? t('featured.sectionLive') : t('featured.sectionUpcoming');
  const stageLabel =
    match.stage === 'Group' && match.group_code
      ? groupStageLabel(match.group_code, t)
      : match.stage
        ? matchStageLabel(match.stage, t)
        : t('common.match');

  return (
    <section className="space-y-3">
      <p
        className={
          isLive
            ? 'label-tactical text-live animate-pulse'
            : 'label-tactical text-cyan'
        }
      >
        {sectionLabel}
      </p>
      <div className="hero-glow overflow-hidden rounded-panel border border-cyan/25">
        <MatchVersusThumbnail
          matchRef={match.slug ?? match.id}
          homeName={match.home_name}
          awayName={match.away_name}
          homeCountryCode={match.home_country_code}
          awayCountryCode={match.away_country_code}
          variant="card"
          className="rounded-none border-0"
        />
        <div className="border-b border-border/60 px-4 py-3 md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="label-tactical text-muted-dim">{stageLabel}</p>
            <MatchKickoffCountdown kickoffUtc={match.kickoff_utc} status={match.status} />
          </div>

          {p && (
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono-data text-xs text-muted">
              <span className="inline-flex items-center gap-1">
                {t('featured.modelNow')}
                <DataKindBadge kind="predicted" compact />
              </span>
              <span className="text-cyan">
                {t('common.abbrHome')} <DataKindMark />
                {pct(p.homeWinProb)}
              </span>
              <span className="text-muted">
                {t('common.abbrDraw')} <DataKindMark />
                {pct(p.drawProb)}
              </span>
              <span className="text-magenta">
                {t('common.abbrAway')} <DataKindMark />
                {pct(p.awayWinProb)}
              </span>
              {p.mostLikelyScore && (
                <span className="ml-1">
                  <PredictedActualScores
                    predicted={p.mostLikelyScore}
                    homeScore={match.home_score}
                    awayScore={match.away_score}
                    status={match.status}
                    layout="inline"
                    size="sm"
                  />
                </span>
              )}
            </p>
          )}

          <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 md:gap-4">
            <h2 className="font-heading text-right text-xl uppercase leading-none tracking-tight text-foreground md:text-3xl lg:text-4xl">
              <TeamNameWithFlag
                name={match.home_short?.trim() || match.home_name}
                flagName={match.home_name}
                countryCode={match.home_country_code}
                className="justify-end font-heading uppercase"
                flagClassName="h-6 w-9 rounded-sm object-cover ring-1 ring-white/10 md:h-8 md:w-12 lg:h-10 lg:w-[3.75rem]"
              />
            </h2>
            <div className="score-pulse rounded-card border border-cyan/30 bg-background/80 px-5 py-3 md:px-8 md:py-4">
              {(isLive || match.status === 'completed') && (
                <p className="mb-1 flex justify-center">
                  <DataKindBadge kind="actual" compact />
                </p>
              )}
              <p className="font-heading text-4xl tabular-nums text-foreground md:text-6xl">
                {(isLive || match.status === 'completed') && <DataKindMark kind="actual" />}
                {match.home_score}
                <span className="mx-1 text-cyan/70">–</span>
                {match.away_score}
              </p>
            </div>
            <h2 className="font-heading text-left text-xl uppercase leading-none tracking-tight text-foreground md:text-3xl lg:text-4xl">
              <TeamNameWithFlag
                name={match.away_short?.trim() || match.away_name}
                flagName={match.away_name}
                countryCode={match.away_country_code}
                className="font-heading uppercase"
                flagClassName="h-6 w-9 rounded-sm object-cover ring-1 ring-white/10 md:h-8 md:w-12 lg:h-10 lg:w-[3.75rem]"
              />
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
