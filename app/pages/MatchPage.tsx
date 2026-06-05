import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  api,
  type MatchSummary,
  type ProbabilityData,
  type TacticalBriefing,
  type MultiVariableAnalysis,
  type HistoryMatch,
  type H2HSummary,
  type ProbabilityHint,
  type MatchPreviewAnalysis,
  type TeamSystemPayload,
  type ScenariosPayload,
  type MarketSignalsPayload,
} from '../lib/api';
import { TeamSystemPanel } from '../components/team/TeamSystemPanel';
import { ScenarioLikelihoodPanel } from '../components/scenarios/ScenarioLikelihoodPanel';
import { MarketSignalPanel } from '../components/market/MarketSignalPanel';
import { MatchPreviewAnalysisPanel } from '../components/match/MatchPreviewAnalysisPanel';
import { MatchPageGuideStrip } from '../components/match/MatchPageGuideStrip';
import { MatchHeader } from '../components/tactical/MatchHeader';
import { ProbabilityStrip } from '../components/tactical/ProbabilityStrip';
import { ScorelineMatrix } from '../components/tactical/ScorelineMatrix';
import { ProbabilityMovementPanel } from '../components/probability/ProbabilityMovementPanel';
import { PitchMap } from '../components/tactical/PitchMap';
import { TacticalBriefingPanel } from '../components/tactical/TacticalBriefingPanel';
import { MultiVariablePanel } from '../components/match/MultiVariablePanel';
import { MatchHistoryPanel } from '../components/match/MatchHistoryPanel';
import { ProbabilityHintsPanel } from '../components/match/ProbabilityHintsPanel';
import { PlayerImpactCard } from '../components/tactical/PlayerImpactCard';
import { ContributionRadialChart } from '../components/tactical/ContributionRadialChart';
import { AnalystSimulatorPanel } from '../components/tactical/AnalystSimulatorPanel';
import { ViewModeToggle, type ViewMode } from '../components/tactical/ViewModeToggle';
import { EditorialArticleLayout } from '../components/editorial/EditorialArticleLayout';
import { Bilingual } from '../components/i18n/Bilingual';
import { derivePlayerImpact, defaultContributionSegments } from '../lib/derivePlayerImpact';
import { TEAM_DISPLAY_NAMES, resolveTeamDisplayName } from '../lib/matchTeams';
import { adjustProbabilities } from '../lib/simulator';
import { pct } from '../lib/format';
import { pickLocalized } from '../lib/briefingText';
import { useI18n } from '../lib/i18n/I18nContext';

const TEAM_NAMES = TEAM_DISPLAY_NAMES;

export function MatchPage() {
  const { matchId } = useParams();
  const { t, mode } = useI18n();
  const [viewMode, setViewMode] = useState<ViewMode>('tactical');
  const [match, setMatch] = useState<MatchSummary | null>(null);
  const [prob, setProb] = useState<ProbabilityData | null>(null);
  const [briefing, setBriefing] = useState<TacticalBriefing | null>(null);
  const [events, setEvents] = useState<{ x?: number; y?: number; event_type?: string; xg?: number }[]>([]);
  const [analysis, setAnalysis] = useState<MultiVariableAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [history, setHistory] = useState<HistoryMatch[]>([]);
  const [h2hSummary, setH2hSummary] = useState<H2HSummary | null>(null);
  const [hints, setHints] = useState<ProbabilityHint[]>([]);
  const [preview, setPreview] = useState<MatchPreviewAnalysis | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [teamNames, setTeamNames] = useState({ home: '', away: '' });
  const [notFound, setNotFound] = useState(false);
  const [simProb, setSimProb] = useState<ReturnType<typeof adjustProbabilities> | null>(null);
  const [teamSystem, setTeamSystem] = useState<TeamSystemPayload | null>(null);
  const [scenarios, setScenarios] = useState<ScenariosPayload | null>(null);
  const [marketSignals, setMarketSignals] = useState<MarketSignalsPayload | null>(null);
  const [intelLoading, setIntelLoading] = useState(true);

  useEffect(() => {
    if (!matchId) return;
    setNotFound(false);
    setMatch(null);
    api.match(matchId).then((r) => setMatch(r.data)).catch(() => setNotFound(true));
    api.matchProbability(matchId).then((r) => setProb(r.data)).catch(() => setProb(null));
    api.matchBriefing(matchId).then((r) => setBriefing(r.data)).catch(() => setBriefing(null));
    api.matchEvents(matchId).then((r) => setEvents(r.data as typeof events));
    api.matchHistory(matchId).then((r) => {
      setHistory(r.data.history);
      setH2hSummary(r.data.summary);
      setTeamNames({
        home: r.data.current?.home_name ?? resolveTeamDisplayName(r.data.current?.home_team_id),
        away: r.data.current?.away_name ?? resolveTeamDisplayName(r.data.current?.away_team_id),
      });
    });
    api.matchHints(matchId).then((r) => setHints(r.data.hints)).catch(() => setHints([]));
    setPreview(null);
    setPreviewLoading(true);
    api
      .matchPreview(matchId)
      .then((r) => setPreview(r.data))
      .catch(() => setPreview(null))
      .finally(() => setPreviewLoading(false));
    setAnalysisLoading(true);
    api
      .matchAnalysis(matchId)
      .then((r) => setAnalysis(r.data))
      .catch(() => setAnalysis(null))
      .finally(() => setAnalysisLoading(false));
    setIntelLoading(true);
    Promise.all([
      api.matchTeamSystem(matchId).then((r) => setTeamSystem(r.data)).catch(() => setTeamSystem(null)),
      api.matchScenarios(matchId).then((r) => setScenarios(r.data)).catch(() => setScenarios(null)),
      api.matchMarketSignals(matchId).then((r) => setMarketSignals(r.data)).catch(() => setMarketSignals(null)),
    ]).finally(() => setIntelLoading(false));
  }, [matchId]);

  const home = teamNames.home || resolveTeamDisplayName(match?.home_team_id) || '';
  const away = teamNames.away || resolveTeamDisplayName(match?.away_team_id) || '';

  const displayProb = useMemo(() => {
    if (!prob) return null;
    const s = simProb;
    if (s) {
      return {
        homeWin: s.homeWin,
        draw: s.draw,
        awayWin: s.awayWin,
        xgHome: s.xgHome,
        xgAway: s.xgAway,
        confidence: prob.confidence,
        simulated: true,
      };
    }
    return {
      homeWin: prob.homeWinProb,
      draw: prob.drawProb,
      awayWin: prob.awayWinProb,
      xgHome: prob.expectedHomeGoals,
      xgAway: prob.expectedAwayGoals,
      confidence: prob.confidence,
      simulated: false,
    };
  }, [prob, simProb]);

  const players = useMemo(() => derivePlayerImpact(events), [events]);

  if (notFound) {
    return (
      <div className="panel space-y-3 text-center">
        <Bilingual k="match.notFound" as="p" className="text-muted" />
        <Link to="/" className="inline-block text-sm font-medium text-cyan hover:underline">
          ← <Bilingual k="match.backSchedule" as="span" />
        </Link>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="text-muted">
        <Bilingual k="match.loading" />
      </div>
    );
  }

  const probLine =
    displayProb &&
    `H ${pct(displayProb.homeWin)} · D ${pct(displayProb.draw)} · A ${pct(displayProb.awayWin)}`;

  if (viewMode === 'editorial') {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/" className="text-sm text-muted hover:text-cyan">
            ← <Bilingual k="match.backSchedule" as="span" />
          </Link>
          <ViewModeToggle mode={viewMode} onChange={setViewMode} />
        </div>
        <EditorialArticleLayout
          title={`${home} vs ${away}`}
          subtitle={
            preview
              ? pickLocalized(preview.summary, mode)
              : briefing
                ? pickLocalized(briefing.summary, mode)
                : undefined
          }
          takeaways={
            briefing?.probabilityExplanation.map((line) => pickLocalized(line, mode)) ??
            hints.map((h) => h.vi).slice(0, 4)
          }
          stickyContext={{
            home,
            away,
            score: `${match.home_score} – ${match.away_score}`,
            status: match.status,
            probLine: probLine ?? undefined,
          }}
          sidebar={
            <>
              {displayProb && (
                <ProbabilityStrip
                  homeWin={displayProb.homeWin}
                  draw={displayProb.draw}
                  awayWin={displayProb.awayWin}
                  xgHome={displayProb.xgHome}
                  xgAway={displayProb.xgAway}
                  confidence={displayProb.confidence}
                />
              )}
              <TacticalBriefingPanel briefing={briefing} />
              {(analysisLoading || analysis) && (
                <MultiVariablePanel analysis={analysis} loading={analysisLoading} />
              )}
            </>
          }
        >
          {(preview || briefing) && (
            <MatchPreviewAnalysisPanel
              key={matchId}
              preview={preview}
              loading={previewLoading}
            />
          )}
          {briefing?.summary && !preview && <p>{pickLocalized(briefing.summary, mode)}</p>}
          {briefing?.probabilityExplanation.map((line, i) => (
            <p key={i}>{pickLocalized(line, mode)}</p>
          ))}
          {analysis?.executiveSummary && (
            <>
              <h2>{t('multiVar.analysisHeading')}</h2>
              <p>{analysis.executiveSummary}</p>
            </>
          )}
        </EditorialArticleLayout>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/" className="text-sm text-muted hover:text-cyan">
          ← <Bilingual k="match.backSchedule" as="span" />
        </Link>
        <ViewModeToggle mode={viewMode} onChange={setViewMode} />
      </div>

      <MatchPageGuideStrip />

      <MatchHeader
        home={home}
        away={away}
        homeScore={match.home_score}
        awayScore={match.away_score}
        status={match.status}
        stage={match.stage}
        homeWin={displayProb?.homeWin}
        draw={displayProb?.draw}
        awayWin={displayProb?.awayWin}
        mostLikelyScore={prob?.mostLikelyScore}
      />

      {displayProb && (
        <ProbabilityStrip
          homeWin={displayProb.homeWin}
          draw={displayProb.draw}
          awayWin={displayProb.awayWin}
          xgHome={displayProb.xgHome}
          xgAway={displayProb.xgAway}
          confidence={displayProb.confidence}
          simulated={displayProb.simulated}
        />
      )}

      <div className="space-y-2">
        <Link
          to={`/matches/${matchId}/analysis`}
          className="inline-block text-sm font-medium text-cyan hover:underline"
        >
          {t('match.fullArticle')}
        </Link>
        <MatchPreviewAnalysisPanel
          key={matchId}
          preview={preview}
          loading={previewLoading}
        />
      </div>

      <TeamSystemPanel
        home={teamSystem?.home ?? null}
        away={teamSystem?.away ?? null}
        loading={intelLoading}
      />
      <ScenarioLikelihoodPanel data={scenarios} loading={intelLoading} />
      <MarketSignalPanel payload={marketSignals} loading={intelLoading} />

      {matchId && (
        <ProbabilityMovementPanel
          matchId={matchId}
          prob={prob}
          currentMinute={match.minute ?? 0}
        />
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <PitchMap events={events} homeLabel={home.slice(0, 3).toUpperCase()} awayLabel={away.slice(0, 3).toUpperCase()} />
          {prob?.scorelineDistribution && Object.keys(prob.scorelineDistribution).length > 0 && (
            <ScorelineMatrix distribution={prob.scorelineDistribution} highlight={prob.mostLikelyScore} />
          )}
          {h2hSummary && (
            <MatchHistoryPanel homeName={home} awayName={away} history={history} summary={h2hSummary} />
          )}
        </div>

        <aside className="space-y-4">
          {hints.length > 0 && <ProbabilityHintsPanel hints={hints} />}
          {prob && (
            <AnalystSimulatorPanel
              base={{
                homeWin: prob.homeWinProb,
                draw: prob.drawProb,
                awayWin: prob.awayWinProb,
                xgHome: prob.expectedHomeGoals,
                xgAway: prob.expectedAwayGoals,
              }}
              onChange={setSimProb}
            />
          )}
          <PlayerImpactCard players={players} />
          <ContributionRadialChart segments={defaultContributionSegments()} />
          {(analysisLoading || analysis) && (
            <MultiVariablePanel analysis={analysis} loading={analysisLoading} />
          )}
          <TacticalBriefingPanel briefing={briefing} />
        </aside>
      </div>
    </div>
  );
}
