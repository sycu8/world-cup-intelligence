import type {
  BracketPayload,
  GroupStandingsPayload,
  HistoryMatch,
  H2HSummary,
  MatchScenarioSet,
  MatchStatsPayload,
  PitchMapPayload,
  ScheduleMatch,
  TeamRecentWcMatch,
} from '../../app/lib/api';

export const SMOKE_MATCH_ID = 'm-test';

export const sampleScheduleMatch: ScheduleMatch = {
  id: SMOKE_MATCH_ID,
  slug: 'usa-vs-mexico',
  kickoff_utc: '2026-06-11T20:00:00Z',
  status: 'scheduled',
  stage: 'Group',
  group_code: 'A',
  home_team_id: 't-usa',
  away_team_id: 't-mex',
  home_score: 0,
  away_score: 0,
  home_name: 'USA',
  away_name: 'Mexico',
  home_short: 'USA',
  away_short: 'MEX',
  home_country_code: 'US',
  away_country_code: 'MX',
  match_date: '2026-06-11',
};

export const sampleLiveMatch: ScheduleMatch = {
  ...sampleScheduleMatch,
  id: 'm-live',
  slug: 'usa-vs-canada-live',
  status: 'live',
  minute: 67,
  home_score: 2,
  away_score: 1,
  away_name: 'Canada',
  away_short: 'CAN',
  away_team_id: 't-can',
  away_country_code: 'CA',
};

export const sampleCompletedMatch: ScheduleMatch = {
  ...sampleScheduleMatch,
  id: 'm-done',
  slug: 'usa-vs-costa-rica',
  status: 'completed',
  home_score: 3,
  away_score: 0,
  away_name: 'Costa Rica',
  away_short: 'CRC',
  away_team_id: 't-crc',
  away_country_code: 'CR',
};

export const sampleKnockoutMatch: ScheduleMatch = {
  ...sampleScheduleMatch,
  id: 'm-r32',
  slug: 'r32-usa-vs-brazil',
  stage: 'Round of 32',
  group_code: undefined,
  away_name: 'Brazil',
  away_short: 'BRA',
  away_team_id: 't-bra',
  away_country_code: 'BR',
  kickoff_utc: '2026-07-01T00:00:00Z',
};

export const sampleScheduleMatches: ScheduleMatch[] = [
  sampleScheduleMatch,
  sampleLiveMatch,
  sampleCompletedMatch,
  sampleKnockoutMatch,
  {
    ...sampleScheduleMatch,
    id: 'm-b',
    group_code: 'B',
    home_name: 'England',
    away_name: 'France',
    home_short: 'ENG',
    away_short: 'FRA',
    home_country_code: 'GB',
    away_country_code: 'FR',
    kickoff_utc: '2026-06-12T18:00:00Z',
  },
];

export const sampleStandings: GroupStandingsPayload = {
  tournamentId: 't-2026',
  groups: {
    A: {
      complete: true,
      rows: [
        {
          teamId: 't-usa',
          teamName: 'USA',
          shortName: 'USA',
          countryCode: 'US',
          rank: 1,
          played: 2,
          points: 6,
          gf: 5,
          ga: 1,
          gd: 4,
        },
        {
          teamId: 't-mex',
          teamName: 'Mexico',
          shortName: 'MEX',
          countryCode: 'MX',
          rank: 2,
          played: 2,
          points: 3,
          gf: 2,
          ga: 2,
          gd: 0,
        },
        {
          teamId: 't-can',
          teamName: 'Canada',
          shortName: 'CAN',
          countryCode: 'CA',
          rank: 3,
          played: 2,
          points: 1,
          gf: 1,
          ga: 3,
          gd: -2,
          isThirdPlaceCandidate: true,
        },
      ],
    },
    B: {
      complete: false,
      rows: [
        {
          teamId: 't-eng',
          teamName: 'England',
          shortName: 'ENG',
          countryCode: 'GB',
          rank: 1,
          played: 1,
          points: 3,
          gf: 2,
          ga: 0,
          gd: 2,
        },
      ],
    },
  },
  thirdPlaceRanking: [
    {
      teamId: 't-can',
      teamName: 'Canada',
      shortName: 'CAN',
      countryCode: 'CA',
      rank: 1,
      played: 2,
      points: 1,
      gf: 1,
      ga: 3,
      gd: -2,
      group: 'A',
    },
  ],
};

export const sampleMatchProbs: Record<string, { homeWin: number; draw: number; awayWin: number }> = {
  [SMOKE_MATCH_ID]: { homeWin: 0.42, draw: 0.28, awayWin: 0.3 },
  'm-live': { homeWin: 0.55, draw: 0.25, awayWin: 0.2 },
  'm-done': { homeWin: 0.9, draw: 0.05, awayWin: 0.05 },
  'm-r32': { homeWin: 0.38, draw: 0.3, awayWin: 0.32 },
  'm-b': { homeWin: 0.45, draw: 0.27, awayWin: 0.28 },
};

export const sampleBracket: BracketPayload = {
  tournamentId: 't-2026',
  rounds: [
    {
      stage: 'Round of 32',
      matches: [
        {
          id: 'm-r32',
          slug: 'r32-usa-vs-brazil',
          stage: 'Round of 32',
          kickoffUtc: '2026-07-01T00:00:00Z',
          status: 'scheduled',
          homeTeamId: 't-usa',
          awayTeamId: 't-bra',
          homeName: 'USA',
          awayName: 'Brazil',
          homeScore: 0,
          awayScore: 0,
        },
      ],
    },
    {
      stage: 'Round of 16',
      matches: [
        {
          id: 'm-r16',
          slug: 'r16-winner-vs-winner',
          stage: 'Round of 16',
          kickoffUtc: '2026-07-05T00:00:00Z',
          status: 'scheduled',
          homeTeamId: 't-usa',
          awayTeamId: 't-fra',
          homeName: 'USA',
          awayName: 'France',
          homeScore: 0,
          awayScore: 0,
        },
      ],
    },
  ],
};

export const sampleHistoryMatch: HistoryMatch = {
  id: 'm-h1',
  kickoff_utc: '2022-11-25T20:00:00Z',
  stage: 'Group',
  home_name: 'USA',
  away_name: 'Mexico',
  home_short: 'USA',
  away_short: 'MEX',
  home_score: 2,
  away_score: 0,
  tournament_year: 2022,
};

export const sampleH2HSummary: H2HSummary = {
  totalMatches: 3,
  homeTeamWins: 1,
  awayTeamWins: 1,
  draws: 1,
  avgGoalsHome: 1.3,
  avgGoalsAway: 1.0,
  recentFormHome: 'WDL',
  recentFormAway: 'LDW',
};

export const sampleRecentWc: TeamRecentWcMatch = {
  ...sampleHistoryMatch,
  opponentId: 't-mex',
  opponentName: 'Mexico',
  opponentShort: 'MEX',
  teamScore: 2,
  opponentScore: 0,
  result: 'W',
  isHome: true,
};

export const sampleMatchStats: MatchStatsPayload = {
  matchId: SMOKE_MATCH_ID,
  slug: 'usa-vs-mexico',
  status: 'live',
  minute: 55,
  homeScore: 1,
  awayScore: 1,
  updatedAt: '2026-06-11T21:00:00Z',
  dataSource: 'fifa_live',
  dataSourceLabel: 'FIFA Live',
  home: {
    teamId: 't-usa',
    teamName: 'USA',
    possession: 58,
    shots: 12,
    shotsOnTarget: 5,
    xg: 1.45,
    passes: 420,
    passAccuracy: 87,
  },
  away: {
    teamId: 't-mex',
    teamName: 'Mexico',
    possession: 42,
    shots: 8,
    shotsOnTarget: 3,
    xg: 0.92,
    passes: 310,
    passAccuracy: 81,
  },
  events: { goals: 2, yellowCards: 3, redCards: 0, substitutions: 4 },
  xgEstimateNote: 'xG estimated from live feed',
};

export const samplePitchMap: PitchMapPayload = {
  matchId: SMOKE_MATCH_ID,
  slug: 'usa-vs-mexico',
  status: 'live',
  minute: 55,
  showRatings: true,
  updatedAt: '2026-06-11T21:00:00Z',
  home: {
    teamId: 't-usa',
    teamName: 'USA',
    formation: '4-3-3',
    source: 'match_official',
    players: [
      {
        playerId: 'p1',
        name: 'Player One',
        shirtNumber: 10,
        position: 'AM',
        x: 0.55,
        y: 0.5,
        isOnPitch: true,
        isStarter: true,
        subMinute: null,
        subType: null,
        rating: 7.2,
        movement: { dx: 0.02, dy: -0.01, magnitude: 0.022 },
      },
    ],
    bench: [],
  },
  away: {
    teamId: 't-mex',
    teamName: 'Mexico',
    formation: '4-4-2',
    source: 'projected',
    players: [
      {
        playerId: 'p2',
        name: 'Player Two',
        shirtNumber: 9,
        position: 'ST',
        x: 0.45,
        y: 0.35,
        isOnPitch: true,
        isStarter: true,
        subMinute: null,
        subType: null,
        rating: 6.8,
        movement: null,
      },
    ],
    bench: [],
  },
  events: [
    {
      id: 'e1',
      x: 0.7,
      y: 0.4,
      endX: 0.85,
      endY: 0.45,
      eventType: 'pass',
      teamId: 't-usa',
      playerId: 'p1',
      minute: 12,
    },
    {
      id: 'e2',
      x: 0.8,
      y: 0.5,
      eventType: 'shot',
      teamId: 't-usa',
      playerId: 'p1',
      minute: 34,
    },
  ],
};

export const sampleScenarioSet: MatchScenarioSet = {
  matchId: SMOKE_MATCH_ID,
  generatedAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
  scenarios: [
    {
      id: 's1',
      matchId: SMOKE_MATCH_ID,
      scenarioType: 'baseline_expected_flow',
      scenarioName: 'Controlled possession match',
      scenarioRank: 1,
      isBaseline: true,
      initialConditions: [{ condition: 'Home team uses strongest available XI', value: true, confidence: 0.9 }],
      triggerConditions: [
        {
          condition: 'First goal before minute 30',
          threshold: 'before 60',
          currentValue: 'pending',
          status: 'not_triggered',
        },
      ],
      invalidationConditions: [
        {
          condition: 'Early red card',
          threshold: 'invalidates open shape',
          status: 'valid',
        },
      ],
      scenarioProbability: 0.42,
      scenarioConfidence: 0.71,
      homeWinProb: 0.4,
      drawProb: 0.3,
      awayWinProb: 0.3,
      expectedHomeGoals: 1.4,
      expectedAwayGoals: 1.1,
      mostLikelyScore: '1-1',
      scorelineDistribution: { '1-1': 0.14, '2-1': 0.12 },
      keyDrivers: ['Scenario likelihood 42.5% with model confidence 71%.', 'USA collective strength 88%'],
      riskFactors: ['Lineups may still be projected rather than confirmed.'],
      modelVersion: 'v1',
      inputHash: 'hash1',
      status: 'active',
      updatedAt: '2026-06-01T00:00:00Z',
    },
    {
      id: 's2',
      matchId: SMOKE_MATCH_ID,
      scenarioType: 'early_goal_swing',
      scenarioName: 'Early transition swing',
      scenarioRank: 2,
      isBaseline: false,
      initialConditions: [],
      triggerConditions: [],
      invalidationConditions: [],
      scenarioProbability: 0.25,
      scenarioConfidence: 0.65,
      homeWinProb: 0.35,
      drawProb: 0.28,
      awayWinProb: 0.37,
      expectedHomeGoals: 1.2,
      expectedAwayGoals: 1.3,
      mostLikelyScore: '1-2',
      scorelineDistribution: { '1-2': 0.11 },
      keyDrivers: ['Conditional W/D/L: 45/28/27.'],
      riskFactors: ['Alternative path depends on early-phase game-state shifts.'],
      modelVersion: 'v1',
      inputHash: 'hash2',
      status: 'active',
      updatedAt: '2026-06-01T00:00:00Z',
    },
  ],
  comparison: {
    primaryScenarioId: 's1',
    alternativeScenarioId: 's2',
    probabilityGap: 0.17,
    confidenceGap: 0.06,
    summary:
      'Scenario likelihood remains more likely for controlled possession match but early transition swing shifts away win probability.',
    keyDifferences: [
      'Scenario likelihood gap: 17.0 percentage points',
      'Home win delta: 0.05 pp',
      'Away win delta: -0.07 pp',
      'Draw delta: 0.02 pp',
      'xG delta: 0.2 / -0.2',
      'Most likely score: 1-1 vs 1-2',
    ],
    homeWinDelta: 0.05,
    drawDelta: 0.02,
    awayWinDelta: -0.07,
    xgHomeDelta: 0.2,
    xgAwayDelta: -0.2,
  },
  sourceConfidence: { overall: 0.82, notes: ['Lineups projected'] },
};

export const sampleProbability = {
  homeWinProb: 0.42,
  drawProb: 0.28,
  awayWinProb: 0.3,
  expectedHomeGoals: 1.4,
  expectedAwayGoals: 1.0,
  mostLikelyScore: '2-1',
  scorelineDistribution: { '2-1': 0.14, '1-1': 0.12, '1-0': 0.1 },
  intervalDistribution: {
    '15': { homeWinProb: 0.4, drawProb: 0.3, awayWinProb: 0.3 },
    '45': { homeWinProb: 0.43, drawProb: 0.27, awayWinProb: 0.3 },
  },
  confidence: 0.72,
  modelVersion: 'v1',
  updatedAt: '2026-06-11T19:00:00Z',
  topScorelines: [
    { score: '2-1', prob: 0.14 },
    { score: '1-1', prob: 0.12 },
  ],
  drivers: ['Home advantage', 'Recent form'],
};

export function buildScheduleByDate(matches = sampleScheduleMatches): Record<string, ScheduleMatch[]> {
  const byDate: Record<string, ScheduleMatch[]> = {};
  for (const m of matches) {
    const key = m.kickoff_utc.slice(0, 10);
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(m);
  }
  return byDate;
}
