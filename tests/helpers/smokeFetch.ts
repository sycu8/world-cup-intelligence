import { vi } from 'vitest';
import {
  buildScheduleByDate,
  sampleBracket,
  sampleHistoryMatch,
  sampleH2HSummary,
  sampleMatchProbs,
  sampleMatchStats,
  samplePitchMap,
  sampleProbability,
  sampleRecentWc,
  sampleScenarioSet,
  sampleLiveMatch,
  sampleCompletedMatch,
  sampleScheduleMatch,
  sampleScheduleMatches,
  sampleStandings,
  SMOKE_MATCH_ID,
} from './smokeFixtures';

const sampleTeam = {
  id: 't-usa',
  name: 'USA',
  short_name: 'USA',
  country_code: 'US',
  fifa_ranking: 12,
  elo_rating: 1850,
  coach: { id: 'c1', name: 'Coach A', nationality: 'US', wcAppearances: 2, tenureYears: 4 },
};

const samplePlayer = {
  id: 'p-test',
  name: 'Test Player',
  position: 'FW',
  club: 'Test FC',
};

const sampleArticle = {
  id: 'n-test',
  title: 'Test article',
  titleVi: 'Bài test',
  source_url: 'https://example.com',
  summary: 'Summary',
  summaryVi: 'Tóm tắt',
  published_at: '2026-01-01T00:00:00Z',
  reliability_score: 0.8,
  source_name: 'Test Source',
  hot_score: 0.9,
  thumbnail_url: '/thumb.jpg',
};

const sampleChampionOdds = {
  generatedAt: '2026-06-01T00:00:00Z',
  simulations: 10000,
  top: [
    { teamId: 't-bra', teamName: 'Brazil', countryCode: 'BR', probability: 0.18, rank: 1 },
    { teamId: 't-fra', teamName: 'France', countryCode: 'FR', probability: 0.14, rank: 2 },
    { teamId: 't-eng', teamName: 'England', countryCode: 'GB', probability: 0.11, rank: 3 },
  ],
  all: [
    { teamId: 't-bra', teamName: 'Brazil', countryCode: 'BR', probability: 0.18, rank: 1 },
    { teamId: 't-fra', teamName: 'France', countryCode: 'FR', probability: 0.14, rank: 2 },
  ],
};

const sampleBriefing = {
  summary: { vi: 'Tóm tắt chiến thuật', en: 'Tactical summary' },
  probabilityExplanation: [{ vi: 'Giải thích xác suất', en: 'Probability explanation' }],
  uncertaintyNotes: [{ vi: 'Ghi chú không chắc chắn', en: 'Uncertainty note' }],
  citations: [{ sourceName: 'FIFA', title: 'Match preview' }],
  tacticalThemes: [
    { title: { vi: 'Chủ đề', en: 'Theme' }, detail: { vi: 'Chi tiết', en: 'Detail' }, confidence: 0.8 },
  ],
};

const samplePreview = {
  matchId: SMOKE_MATCH_ID,
  generatedAt: '2026-06-01T00:00:00Z',
  matchLabel: { vi: 'USA vs Mexico', en: 'USA vs Mexico' },
  stage: 'Group',
  groupCode: 'A',
  kickoffUtc: sampleScheduleMatch.kickoff_utc,
  home: {
    teamId: 't-usa',
    teamName: 'USA',
    shortName: 'USA',
    elo: 1850,
    fifaRanking: 12,
    collectiveStrength: 0.82,
    formation: '4-3-3',
    lineupSource: 'projected',
    hasAccurateLineup: false,
    keyPlayers: ['Player One'],
    fullLineup: ['Player One', 'Player Two'],
    recentForm: 'WWD',
    formMatches: 5,
  },
  away: {
    teamId: 't-mex',
    teamName: 'Mexico',
    shortName: 'MEX',
    elo: 1800,
    fifaRanking: 15,
    collectiveStrength: 0.78,
    formation: '4-4-2',
    lineupSource: 'official',
    hasAccurateLineup: true,
    keyPlayers: ['Player Three'],
    fullLineup: ['Player Three'],
    recentForm: 'DLW',
    formMatches: 5,
  },
  summary: { vi: 'Trận đấu cân bằng', en: 'Balanced match' },
  sections: {
    context: { vi: 'Bối cảnh', en: 'Context' },
    strength: { vi: 'Sức mạnh', en: 'Strength' },
    lineup: { vi: 'Đội hình', en: 'Lineup' },
    form: { vi: 'Phong độ', en: 'Form' },
    tactical: { vi: 'Chiến thuật', en: 'Tactical' },
  },
  insights: [{ vi: 'Nhận định 1', en: 'Insight 1' }],
  probabilityNote: { vi: 'Ghi chú xác suất', en: 'Probability note' },
  scorelineTop3: [
    { score: '2-1', prob: 0.14 },
    { score: '1-1', prob: 0.12 },
  ],
  dataSources: ['FIFA', 'Model'],
};

const sampleLineups = {
  matchId: SMOKE_MATCH_ID,
  slug: 'usa-vs-mexico',
  home: {
    teamId: 't-usa',
    teamName: 'USA',
    formation: '4-3-3',
    players: ['Player One'],
    lineupPlayers: [{ shirtNumber: 10, name: 'Player One', position: 'AM' }],
    starters: [{ shirtNumber: 10, name: 'Player One', position: 'AM' }],
    substitutes: [{ shirtNumber: 12, name: 'Sub One', position: 'FW' }],
    grouped: {
      GK: [{ shirtNumber: 1, name: 'Keeper', position: 'GK' }],
      DEF: [{ shirtNumber: 4, name: 'Defender', position: 'CB' }],
      MID: [{ shirtNumber: 10, name: 'Player One', position: 'AM' }],
      FWD: [{ shirtNumber: 9, name: 'Striker', position: 'ST' }],
    },
    hasAccurateLineup: true,
    hasLineup: true,
    source: 'official',
  },
  away: {
    teamId: 't-mex',
    teamName: 'Mexico',
    formation: '4-4-2',
    players: ['Player Three'],
    lineupPlayers: [{ shirtNumber: 9, name: 'Player Three', position: 'ST' }],
    starters: [{ shirtNumber: 9, name: 'Player Three', position: 'ST' }],
    substitutes: [],
    grouped: { GK: [], DEF: [], MID: [], FWD: [] },
    hasAccurateLineup: false,
    hasLineup: true,
    source: 'projected',
  },
};

const sampleTeamSystem = {
  matchId: SMOKE_MATCH_ID,
  home: {
    teamId: 't-usa',
    tacticalIdentity: 'Possession',
    primaryFormation: '4-3-3',
    collectiveStrengthScore: 0.82,
    formationStabilityScore: 0.75,
    pressingScore: 0.7,
    defensiveCompactnessScore: 0.68,
    transitionScore: 0.72,
    setPieceScore: 0.65,
    benchDepthScore: 0.7,
    lineupCohesionScore: 0.78,
    possessionControlScore: 0.8,
    tempoScore: 0.74,
    explanationFactors: ['High tempo increases early-phase chance volume.'],
    confidence: 0.8,
    modelVersion: 'v1',
  },
  away: {
    teamId: 't-mex',
    tacticalIdentity: 'Counter',
    primaryFormation: '4-4-2',
    collectiveStrengthScore: 0.78,
    formationStabilityScore: 0.72,
    pressingScore: 0.65,
    defensiveCompactnessScore: 0.7,
    transitionScore: 0.75,
    setPieceScore: 0.6,
    benchDepthScore: 0.68,
    lineupCohesionScore: 0.74,
    possessionControlScore: 0.65,
    tempoScore: 0.7,
    explanationFactors: ['Attack strengths suggest both sides can score.'],
    confidence: 0.75,
    modelVersion: 'v1',
  },
  disclaimer: 'Projected data',
};

const sampleMarketSignals = {
  signals: {
    matchId: SMOKE_MATCH_ID,
    model: { home: 0.42, draw: 0.28, away: 0.3 },
    market: { home: 0.38, draw: 0.3, away: 0.32 },
    edge: { home: 0.04, draw: -0.02, away: -0.02 },
    volatilityScore: 0.12,
    updatedAt: '2026-06-01T00:00:00Z',
    disclaimer: 'Market disclaimer',
  },
  oddsSnapshots: [],
  disclaimer: 'Not betting advice',
};

const sampleRecap = {
  matchId: SMOKE_MATCH_ID,
  slug: 'usa-vs-mexico',
  summaryVi: 'Tóm tắt trận đấu',
  summaryEn: 'Match recap summary',
  sourceId: 'fifa',
  updatedAt: '2026-06-11T22:00:00Z',
  commentary: [
    {
      id: 'c1',
      minute: 23,
      period: '1H',
      textVi: 'Bàn thắng mở tỷ số',
      textEn: 'Opening goal',
      eventType: 'goal',
    },
  ],
  playerStats: [
    {
      playerId: 'p1',
      playerName: 'Player One',
      teamId: 't-usa',
      shirtNumber: 10,
      minutesPlayed: 90,
      goals: 1,
      assists: 1,
      shots: 4,
      shotsOnTarget: 2,
      xg: 0.8,
      yellowCards: 0,
      redCards: 0,
    },
  ],
};

const sampleStaff = {
  matchId: SMOKE_MATCH_ID,
  slug: 'usa-vs-mexico',
  homeCoach: {
    coachId: 'c1',
    name: 'Coach A',
    nationality: 'US',
    wcAppearances: 2,
    tenureYears: 4,
    tacticalRating: 0.8,
    disciplineIndex: 0.6,
  },
  awayCoach: {
    coachId: 'c2',
    name: 'Coach B',
    nationality: 'MX',
    wcAppearances: 3,
    tenureYears: 5,
    tacticalRating: 0.78,
    disciplineIndex: 0.55,
  },
  officials: [
    { role: 'assistant_referee_1', name: 'AR One', nationality: 'BR' },
    { role: 'fourth_official', name: 'Fourth Official', nationality: 'DE' },
  ],
  referee: {
    role: 'Referee',
    name: 'Ref One',
    nationality: 'IT',
    fifaCategory: 'FIFA',
    strictness: 0.7,
  },
};

const sampleAnalysis = {
  executiveSummary: 'Multi-variable analysis summary',
  variableInsights: [
    {
      variable: 'Form',
      impact: 'high',
      direction: 'home',
      explanation: 'Home team in strong form',
    },
  ],
  tacticalRecommendations: ['Press high in first 15 minutes'],
  riskFactors: ['Key player fitness unknown'],
  confidence: 0.75,
  modelsUsed: ['baseline', 'form'],
};

export function mockApiBody(url: string): unknown {
  if (url.includes('/api/home')) {
    return {
      data: {
        schedule: {
          byDate: buildScheduleByDate(),
          matches: sampleScheduleMatches,
          tournamentId: 't-2026',
          total: sampleScheduleMatches.length,
        },
        scheduleMeta: { expectedMatches: 104, year: 2026 },
        dashboard: {
          featuredMatch: { ...sampleScheduleMatch, probability: sampleProbability },
          matchCount: sampleScheduleMatches.length,
          lastDataRefresh: '2026-06-01T00:00:00Z',
          lastNewsCrawl: '2026-06-01T00:00:00Z',
          refreshIntervalSec: 30,
          newsCrawlIntervalSec: 900,
          tournamentStartUtc: '2026-06-11T14:00:00Z',
          expectedMatches: 104,
          hostCountries: ['USA', 'Mexico', 'Canada'],
          teamsCount: 48,
          groupCount: 12,
          statusCounts: { scheduled: 80, live: 2, completed: 22 },
        },
        hotNews: [sampleArticle],
        standings: sampleStandings,
        matchProbabilities: sampleMatchProbs,
        championOdds: sampleChampionOdds,
      },
    };
  }
  if (url.includes('/api/dashboard')) {
    return {
      data: {
        featuredMatch: { ...sampleLiveMatch, probability: sampleProbability },
        matchCount: 104,
        lastDataRefresh: '2026-06-01T00:00:00Z',
        lastNewsCrawl: '2026-06-01T00:00:00Z',
        refreshIntervalSec: 30,
        newsCrawlIntervalSec: 900,
        tournamentStartUtc: '2026-06-11T14:00:00Z',
        expectedMatches: 104,
        hostCountries: ['USA', 'Mexico', 'Canada'],
        teamsCount: 48,
        groupCount: 12,
        statusCounts: { scheduled: 80, live: 2, completed: 22 },
      },
    };
  }
  if (url.includes('/api/news?')) {
    return {
      data: { hot: [sampleArticle], articles: [sampleArticle] },
      meta: {
        page: 1,
        pageSize: 8,
        total: 1,
        totalPages: 1,
        hotCount: 1,
        lastCrawl: '2026-06-01T00:00:00Z',
        crawlIntervalSec: 900,
      },
    };
  }
  if (url.match(/\/api\/news\/[^/?]+$/)) {
    return { data: sampleArticle };
  }
  if (url.includes('/api/schedule')) {
    return {
      data: {
        byDate: buildScheduleByDate(),
        matches: sampleScheduleMatches,
        tournamentId: 't-2026',
        total: sampleScheduleMatches.length,
      },
      meta: { expectedMatches: 104, year: 2026 },
    };
  }
  if (url.includes('/api/tournaments/') && url.includes('/standings')) {
    return { data: sampleStandings };
  }
  if (url.includes('/api/tournaments/') && url.includes('/match-probabilities')) {
    return { data: sampleMatchProbs };
  }
  if (url.includes('/api/tournaments/') && url.includes('/prediction-accuracy')) {
    return {
      data: {
        tournamentYear: 2026,
        evaluatedAt: '2026-06-01T00:00:00Z',
        completedTotal: 12,
        completedWithSnapshot: 10,
        favoriteHits: 8,
        favoriteHitRate: 0.8,
        drawPredictions: 2,
        drawHits: 1,
        scorelineHits: 2,
        scorelineHitRate: 0.2,
        scorelineTop3Hits: 4,
        scorelineTop3HitRate: 0.4,
        avgBrier: 0.42,
        avgActualScoreProb: 0.11,
        modelVersions: { 'wc-prob-v5': 10 },
        recent: [],
      },
    };
  }
  if (url.includes('/api/tournaments/') && url.includes('/upcoming-probability-verification')) {
    return {
      data: {
        verifiedAt: '2026-06-01T00:00:00Z',
        upcomingTotal: 24,
        withProbability: 20,
        missing: [],
        matches: [],
      },
    };
  }
  if (url.includes('/api/tournaments/') && url.includes('/champion-odds')) {
    return { data: sampleChampionOdds };
  }
  if (url.includes('/api/tournaments/') && url.includes('/bracket')) {
    return { data: sampleBracket };
  }
  if (url.includes('/api/tournaments')) {
    return {
      data: [{ id: 't-2026', year: 2026, name: 'FIFA World Cup 2026', status: 'upcoming' }],
    };
  }
  if (url.match(/\/api\/teams\/[^/]+\/squad$/)) {
    return {
      data: [{ player_id: 'p1', name: 'Player One', position: 'FW', shirt_number: 10, listed_position: 'FW', status: 'active' }],
    };
  }
  if (url.match(/\/api\/teams\/[^/]+\/wc-h2h$/)) {
    return {
      data: {
        teamId: 't-usa',
        totalMeetings: 3,
        opponents: [
          {
            opponentId: 't-mex',
            opponentName: 'Mexico',
            opponentShort: 'MEX',
            meetings: [sampleHistoryMatch],
            wins: 1,
            draws: 1,
            losses: 1,
            goalsFor: 4,
            goalsAgainst: 3,
          },
        ],
      },
    };
  }
  if (url.match(/\/api\/teams\/[^/]+$/)) {
    return { data: sampleTeam };
  }
  if (url.includes('/api/teams')) {
    return { data: [sampleTeam, { id: 't-mex', name: 'Mexico', short_name: 'MEX', country_code: 'MX' }] };
  }
  if (url.match(/\/api\/players\/[^/]+$/)) {
    return { data: samplePlayer };
  }
  if (url.includes('/api/players')) {
    return { data: [samplePlayer] };
  }
  if (url.match(/\/api\/matches\/[^/]+\/stats$/)) {
    return { data: sampleMatchStats };
  }
  if (url.match(/\/api\/matches\/[^/]+\/recap$/)) {
    return { data: sampleRecap };
  }
  if (url.match(/\/api\/matches\/[^/]+\/staff$/)) {
    return { data: sampleStaff };
  }
  if (url.match(/\/api\/matches\/[^/]+\/lineups$/)) {
    return { data: sampleLineups };
  }
  if (url.match(/\/api\/matches\/[^/]+\/tactical-briefing$/)) {
    return { data: sampleBriefing };
  }
  if (url.match(/\/api\/matches\/[^/]+\/preview$/)) {
    return { data: samplePreview };
  }
  if (url.match(/\/api\/matches\/[^/]+\/hints$/)) {
    return { data: { hints: [{ id: 'h1', vi: 'Gợi ý', en: 'Hint', type: 'form' }] } };
  }
  if (url.match(/\/api\/matches\/[^/]+\/team-system$/)) {
    return { data: sampleTeamSystem };
  }
  if (url.match(/\/api\/matches\/[^/]+\/scenarios$/)) {
    return {
      data: {
        matchId: SMOKE_MATCH_ID,
        scenarios: [
          {
            scenarioType: 'upset',
            probability: 0.2,
            confidence: 0.7,
            explanationFactors: ['form'],
          },
        ],
        disclaimer: 'Scenario disclaimer',
      },
    };
  }
  if (url.match(/\/api\/matches\/[^/]+\/scenario-predictions$/)) {
    return { data: sampleScenarioSet };
  }
  if (url.match(/\/api\/matches\/[^/]+\/scenario-comparison$/)) {
    return { data: sampleScenarioSet.comparison };
  }
  if (url.match(/\/api\/matches\/[^/]+\/market-signals$/)) {
    return { data: sampleMarketSignals };
  }
  if (url.match(/\/api\/matches\/[^/]+\/model-vs-market$/)) {
    return { data: sampleMarketSignals.signals };
  }
  if (url.match(/\/api\/matches\/[^/]+\/probability-movement$/)) {
    return {
      data: {
        matchId: SMOKE_MATCH_ID,
        events: [
          {
            label: 'baseline',
            timestamp: '2026-06-11T20:00:00Z',
            minute: 0,
            homeWinBefore: 0.42,
            homeWinAfter: 0.42,
            drawBefore: 0.28,
            drawAfter: 0.28,
            awayBefore: 0.3,
            awayAfter: 0.3,
            deltaHome: 0,
            reasonCode: 'baseline',
          },
          {
            label: 'update-1',
            timestamp: '2026-06-11T20:30:00Z',
            minute: 30,
            homeWinBefore: 0.42,
            homeWinAfter: 0.48,
            drawBefore: 0.28,
            drawAfter: 0.26,
            awayBefore: 0.3,
            awayAfter: 0.26,
            deltaHome: 0.06,
            reasonCode: 'live',
          },
          {
            label: 'update-2',
            timestamp: '2026-06-11T21:00:00Z',
            minute: 55,
            homeWinBefore: 0.48,
            homeWinAfter: 0.45,
            drawBefore: 0.26,
            drawAfter: 0.27,
            awayBefore: 0.26,
            awayAfter: 0.28,
            deltaHome: -0.03,
            reasonCode: 'recalc',
          },
        ],
        modelVersion: 'v1',
      },
    };
  }
  if (url.match(/\/api\/matches\/[^/]+\/pitch-map$/)) {
    return { data: samplePitchMap };
  }
  if (url.match(/\/api\/matches\/[^/]+\/history$/)) {
    return {
      data: {
        history: [sampleHistoryMatch],
        worldCupHistory: [sampleHistoryMatch],
        summary: sampleH2HSummary,
        worldCupSummary: sampleH2HSummary,
        current: sampleHistoryMatch,
        homeRecentWc: [sampleRecentWc],
        awayRecentWc: [{ ...sampleRecentWc, result: 'L' as const, teamScore: 0, opponentScore: 2 }],
      },
    };
  }
  if (url.match(/\/api\/matches\/[^/]+\/probability$/)) {
    return { data: sampleProbability };
  }
  if (url.match(/\/api\/matches\/[^/]+\/events$/)) {
    return {
      data: [{ event_type: 'shot', xg: 0.15, minute: 12 }, { event_type: 'goal', xg: 0.4, minute: 34 }],
    };
  }
  if (url.match(/\/api\/matches\/[^/]+$/)) {
    const matchRef = url.split('/').pop() ?? '';
    if (matchRef === 'm-done' || matchRef.includes('costa-rica')) {
      return { data: sampleCompletedMatch };
    }
    return { data: { ...sampleScheduleMatch, status: 'live', minute: 55, home_score: 1, away_score: 1 } };
  }
  if (url.includes('/api/matches')) {
    return { data: sampleScheduleMatches };
  }
  if (url.includes('/api/analysis/config')) {
    return { data: { gatewayEnabled: true, routing: [{ model: 'gpt-4' }] } };
  }
  if (url.match(/\/api\/analysis\/[^/]+$/)) {
    return { data: sampleAnalysis, meta: { gatewayConfigured: true } };
  }
  if (url.includes('/api/search')) {
    return {
      data: {
        matches: sampleScheduleMatches,
        teams: [sampleTeam],
        players: [samplePlayer],
        news: [sampleArticle],
      },
    };
  }
  if (url.includes('/api/admin/')) {
    return { data: [] };
  }
  if (url.includes('/api/health')) {
    return { status: 'ok', dependencies: { db: 'ok' } };
  }
  return { data: {} };
}

export function installSmokeFetchMock() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      const body = mockApiBody(url);
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
}
