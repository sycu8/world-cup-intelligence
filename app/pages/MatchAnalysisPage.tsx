import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  api,
  type TeamSystemPayload,
  type ScenariosPayload,
  type MatchScenarioSet,
  type MarketSignalsPayload,
  type MatchPreviewAnalysis,
  type HistoryMatch,
  type H2HSummary,
} from '../lib/api';
import { TeamSystemPanel } from '../components/team/TeamSystemPanel';
import { ScenarioLikelihoodPanel } from '../components/scenarios/ScenarioLikelihoodPanel';
import { ScenarioPredictionPanel } from '../components/scenarios/ScenarioPredictionPanel';
import { MarketSignalPanel } from '../components/market/MarketSignalPanel';
import { MatchPreviewAnalysisPanel } from '../components/match/MatchPreviewAnalysisPanel';
import { ProbabilityStrip } from '../components/tactical/ProbabilityStrip';
import { MatchHistoryPanel } from '../components/match/MatchHistoryPanel';
import { TacticalBriefingPanel } from '../components/tactical/TacticalBriefingPanel';
import { pct } from '../lib/format';
import { formatMatchVersus, resolveTeamDisplayName } from '../lib/matchTeams';
import { pickLocalized } from '../lib/briefingText';
import { useMatchLiveData } from '../lib/useMatchLiveData';
import { useI18n } from '../lib/i18n/I18nContext';
import { resolveMatchHref } from '../lib/matchPaths';
import { useLegacyMatchRedirect } from '../lib/useLegacyMatchRedirect';
import { matchAnalysisPath } from '@/utils/matchSlug';

export function MatchAnalysisPage() {
  const { matchId } = useParams();
  const { t, mode } = useI18n();
  const { match, prob } = useMatchLiveData(matchId);
  useLegacyMatchRedirect(matchId, match?.slug, matchAnalysisPath);
  const [preview, setPreview] = useState<MatchPreviewAnalysis | null>(null);
  const [teamSystem, setTeamSystem] = useState<TeamSystemPayload | null>(null);
  const [scenarios, setScenarios] = useState<ScenariosPayload | null>(null);
  const [scenarioPredictions, setScenarioPredictions] = useState<MatchScenarioSet | null>(null);
  const [market, setMarket] = useState<MarketSignalsPayload | null>(null);
  const [teamNames, setTeamNames] = useState({ home: '', away: '' });
  const [wcHistory, setWcHistory] = useState<HistoryMatch[]>([]);
  const [wcSummary, setWcSummary] = useState<H2HSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!matchId) return;
    setLoading(true);
    Promise.all([
      api.matchPreview(matchId).then((r) => setPreview(r.data)).catch(() => setPreview(null)),
      api.matchHistory(matchId).then((r) => {
        setTeamNames({
          home: r.data.current?.home_name ?? resolveTeamDisplayName(r.data.current?.home_team_id),
          away: r.data.current?.away_name ?? resolveTeamDisplayName(r.data.current?.away_team_id),
        });
        setWcHistory(r.data.worldCupHistory ?? r.data.history);
        setWcSummary(r.data.worldCupSummary ?? r.data.summary);
      }).catch(() => {
        setTeamNames({ home: '', away: '' });
        setWcHistory([]);
        setWcSummary(null);
      }),
      api.matchTeamSystem(matchId).then((r) => setTeamSystem(r.data)).catch(() => setTeamSystem(null)),
      api.matchScenarios(matchId).then((r) => setScenarios(r.data)).catch(() => setScenarios(null)),
      api.matchScenarioPredictions(matchId).then((r) => setScenarioPredictions(r.data)).catch(() => setScenarioPredictions(null)),
      api.matchMarketSignals(matchId).then((r) => setMarket(r.data)).catch(() => setMarket(null)),
    ]).finally(() => setLoading(false));
  }, [matchId]);

  const title = useMemo(() => {
    const homeId = match?.home_team_id ?? preview?.home.teamId;
    const awayId = match?.away_team_id ?? preview?.away.teamId;
    const homeName = teamNames.home || preview?.home.teamName;
    const awayName = teamNames.away || preview?.away.teamName;
    const versus = formatMatchVersus(homeId, awayId, homeName, awayName);

    if (versus) {
      const stage = match?.stage ?? preview?.stage ?? null;
      const group = preview?.groupCode ?? null;
      if (stage === 'Group' && group) {
        return mode === 'vi' ? `Bảng ${group}: ${versus}` : `Group ${group}: ${versus}`;
      }
      if (stage) {
        return mode === 'vi' ? `${stage}: ${versus}` : `${stage}: ${versus}`;
      }
      return versus;
    }

    if (preview?.matchLabel) return pickLocalized(preview.matchLabel, mode);
    return t('matchAnalysis.title');
  }, [preview, match, teamNames, mode, t]);

  const home = teamNames.home || preview?.home.teamName || resolveTeamDisplayName(match?.home_team_id) || '';
  const away = teamNames.away || preview?.away.teamName || resolveTeamDisplayName(match?.away_team_id) || '';

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
        <Link
          to={resolveMatchHref({ id: match?.id ?? matchId!, slug: match?.slug ?? matchId })}
          className="text-sm text-muted hover:text-cyan"
        >
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
            homeLabel={home}
            awayLabel={away}
            live={match?.status === 'live'}
          />
          {scorelineLine && <p className="text-base leading-relaxed text-foreground/90">{scorelineLine}</p>}
        </section>
      )}

      <TeamSystemPanel home={teamSystem?.home ?? null} away={teamSystem?.away ?? null} loading={loading} />
      {wcSummary && (
        <MatchHistoryPanel
          homeName={home}
          awayName={away}
          history={wcHistory}
          summary={wcSummary}
        />
      )}
      <MatchPreviewAnalysisPanel preview={preview} loading={loading} />
      <ScenarioPredictionPanel
        data={scenarioPredictions}
        loading={loading}
        homeName={home}
        awayName={away}
      />
      <ScenarioLikelihoodPanel data={scenarios} loading={loading} />
      <MarketSignalPanel payload={market} loading={loading} />
      <TacticalBriefingPanel briefing={null} />
    </article>
  );
}
