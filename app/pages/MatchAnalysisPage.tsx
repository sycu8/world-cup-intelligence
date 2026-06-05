import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  api,
  type MatchSummary,
  type ProbabilityData,
  type TeamSystemPayload,
  type ScenariosPayload,
  type MarketSignalsPayload,
  type MatchPreviewAnalysis,
} from '../lib/api';
import { TeamSystemPanel } from '../components/team/TeamSystemPanel';
import { ScenarioLikelihoodPanel } from '../components/scenarios/ScenarioLikelihoodPanel';
import { MarketSignalPanel } from '../components/market/MarketSignalPanel';
import { MatchPreviewAnalysisPanel } from '../components/match/MatchPreviewAnalysisPanel';
import { ProbabilityStrip } from '../components/tactical/ProbabilityStrip';
import { TacticalBriefingPanel } from '../components/tactical/TacticalBriefingPanel';
import { pct } from '../lib/format';
import { formatMatchVersus } from '../lib/matchTeams';
import { pickLocalized } from '../lib/briefingText';
import { useI18n } from '../lib/i18n/I18nContext';

export function MatchAnalysisPage() {
  const { matchId } = useParams();
  const { t, mode } = useI18n();
  const [match, setMatch] = useState<MatchSummary | null>(null);
  const [prob, setProb] = useState<ProbabilityData | null>(null);
  const [preview, setPreview] = useState<MatchPreviewAnalysis | null>(null);
  const [teamSystem, setTeamSystem] = useState<TeamSystemPayload | null>(null);
  const [scenarios, setScenarios] = useState<ScenariosPayload | null>(null);
  const [market, setMarket] = useState<MarketSignalsPayload | null>(null);
  const [teamNames, setTeamNames] = useState({ home: '', away: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!matchId) return;
    setLoading(true);
    Promise.all([
      api.match(matchId).then((r) => setMatch(r.data)),
      api.matchProbability(matchId).then((r) => setProb(r.data)).catch(() => setProb(null)),
      api.matchPreview(matchId).then((r) => setPreview(r.data)).catch(() => setPreview(null)),
      api.matchHistory(matchId).then((r) => {
        setTeamNames({
          home: r.data.current?.home_name ?? '',
          away: r.data.current?.away_name ?? '',
        });
      }).catch(() => setTeamNames({ home: '', away: '' })),
      api.matchTeamSystem(matchId).then((r) => setTeamSystem(r.data)).catch(() => setTeamSystem(null)),
      api.matchScenarios(matchId).then((r) => setScenarios(r.data)).catch(() => setScenarios(null)),
      api.matchMarketSignals(matchId).then((r) => setMarket(r.data)).catch(() => setMarket(null)),
    ]).finally(() => setLoading(false));
  }, [matchId]);

  const title = useMemo(() => {
    if (preview) return pickLocalized(preview.matchLabel, mode);
    if (match) {
      return formatMatchVersus(
        match.home_team_id,
        match.away_team_id,
        teamNames.home,
        teamNames.away,
      );
    }
    return t('matchAnalysis.title');
  }, [preview, match, teamNames, mode, t]);

  if (!match && !loading) {
    return (
      <div className="panel text-center text-muted">
        {t('matchAnalysis.notFound')}{' '}
        <Link to="/" className="text-cyan hover:underline">
          {t('matchAnalysis.notFoundBack')}
        </Link>
      </div>
    );
  }

  const scorelineLine =
    prob &&
    t('matchAnalysis.scoreline')
      .replace('{score}', prob.mostLikelyScore ?? '—')
      .replace('{h}', t('common.abbrHome'))
      .replace('{hp}', pct(prob.homeWinProb))
      .replace('{d}', t('common.abbrDraw'))
      .replace('{dp}', pct(prob.drawProb))
      .replace('{a}', t('common.abbrAway'))
      .replace('{ap}', pct(prob.awayWinProb));

  const kickoffLabel =
    match?.kickoff_utc &&
    new Date(match.kickoff_utc).toLocaleString(mode === 'en' ? 'en' : 'vi-VN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <article className="mx-auto max-w-[860px] space-y-8 pb-12">
      <header className="space-y-3">
        <Link to={`/matches/${matchId}`} className="text-sm text-muted hover:text-cyan">
          ← {t('matchAnalysis.back')}
        </Link>
        <div className="space-y-2">
          <h1 className="font-heading text-3xl leading-tight tracking-tight text-foreground md:text-4xl">
            {loading && !preview && !teamNames.home ? t('matchAnalysis.title') : title}
          </h1>
          {kickoffLabel && <p className="text-sm text-muted">{kickoffLabel}</p>}
          <p className="text-base leading-relaxed text-muted">{t('matchAnalysis.articleSubtitle')}</p>
        </div>
      </header>

      {prob && (
        <section className="space-y-2">
          <h2 className="label-tactical text-cyan">{t('matchAnalysis.modelProb')}</h2>
          <ProbabilityStrip
            homeWin={prob.homeWinProb}
            draw={prob.drawProb}
            awayWin={prob.awayWinProb}
            xgHome={prob.expectedHomeGoals}
            xgAway={prob.expectedAwayGoals}
            confidence={prob.confidence}
          />
          {scorelineLine && <p className="text-base leading-relaxed text-foreground/90">{scorelineLine}</p>}
        </section>
      )}

      <TeamSystemPanel home={teamSystem?.home ?? null} away={teamSystem?.away ?? null} loading={loading} />
      <MatchPreviewAnalysisPanel preview={preview} loading={loading} />
      <ScenarioLikelihoodPanel data={scenarios} loading={loading} />
      <MarketSignalPanel payload={market} loading={loading} />
      <TacticalBriefingPanel briefing={null} />
    </article>
  );
}
