import { vi } from 'vitest';

const emptyStandings = {
  tournamentId: 't-2026',
  groups: {},
  thirdPlaceRanking: [],
};

const sampleMatch = {
  id: 'm-test',
  slug: 'm-test',
  home_team_id: 't-usa',
  away_team_id: 't-mex',
  home_name: 'USA',
  away_name: 'Mexico',
  status: 'scheduled',
  home_score: 0,
  away_score: 0,
  kickoff_utc: '2026-06-11T20:00:00Z',
};

const samplePlayer = {
  id: 'p-test',
  name: 'Test Player',
  position: 'FW',
  club: 'Test FC',
};

const sampleTeam = {
  id: 't-usa',
  name: 'USA',
  short_name: 'USA',
  country_code: 'US',
};

export function mockApiBody(url: string): unknown {
  if (url.includes('/api/home')) {
    return {
      data: {
        schedule: { byDate: {}, matches: [], tournamentId: 't-2026', total: 0 },
        scheduleMeta: { expectedMatches: 104, year: 2026 },
        dashboard: { tournamentStartUtc: '2026-06-11T14:00:00Z' },
        hotNews: [],
        standings: emptyStandings,
        matchProbabilities: {},
      },
    };
  }
  if (url.includes('/api/news?')) {
    return {
      data: { hot: [], articles: [] },
      meta: {
        page: 1,
        pageSize: 8,
        total: 0,
        totalPages: 1,
        hotCount: 0,
        lastCrawl: null,
        crawlIntervalSec: 900,
      },
    };
  }
  if (url.match(/\/api\/news\/[^/?]+$/)) {
    return {
      data: {
        id: 'n-test',
        title: 'Test article',
        source_url: 'https://example.com',
        summary: 'Summary',
        published_at: '2026-01-01T00:00:00Z',
        reliability_score: 0.8,
      },
    };
  }
  if (url.includes('/api/schedule')) {
    return { data: { byDate: {}, matches: [], tournamentId: 't-2026', total: 0 } };
  }
  if (url.includes('/api/tournaments/') && url.includes('/standings')) {
    return { data: emptyStandings };
  }
  if (url.includes('/api/tournaments/') && url.includes('/match-probabilities')) {
    return { data: {} };
  }
  if (url.includes('/api/tournaments/') && url.includes('/bracket')) {
    return { data: { rounds: [] } };
  }
  if (url.includes('/api/tournaments')) {
    return { data: [] };
  }
  if (url.match(/\/api\/teams\/[^/]+\/squad$/)) {
    return { data: [] };
  }
  if (url.match(/\/api\/teams\/[^/]+\/wc-h2h$/)) {
    return { data: { teamId: 't-usa', totalMeetings: 0, opponents: [] } };
  }
  if (url.match(/\/api\/teams\/[^/]+$/)) {
    return { data: sampleTeam };
  }
  if (url.includes('/api/teams')) {
    return { data: [sampleTeam] };
  }
  if (url.match(/\/api\/players\/[^/]+$/)) {
    return { data: samplePlayer };
  }
  if (url.includes('/api/players')) {
    return { data: [samplePlayer] };
  }
  if (url.match(/\/api\/matches\/[^/]+\/probability-movement$/)) {
    return { data: { intervals: [], currentMinute: 0 } };
  }
  if (url.match(/\/api\/matches\/[^/]+\/pitch-map$/)) {
    return {
      data: {
        home: { teamName: 'USA', players: [], events: [] },
        away: { teamName: 'Mexico', players: [], events: [] },
        events: [],
      },
    };
  }
  if (url.match(/\/api\/matches\/[^/]+\/history$/)) {
    return {
      data: {
        history: [],
        worldCupHistory: [],
        summary: { meetings: 0, homeWins: 0, awayWins: 0, draws: 0 },
        worldCupSummary: { meetings: 0, homeWins: 0, awayWins: 0, draws: 0 },
        current: sampleMatch,
        homeRecentWc: [],
        awayRecentWc: [],
      },
    };
  }
  if (url.match(/\/api\/matches\/[^/]+\/probability$/)) {
    return { data: { homeWin: 0.4, draw: 0.3, awayWin: 0.3, xgHome: 1.2, xgAway: 1.0 } };
  }
  if (url.match(/\/api\/matches\/[^/]+$/)) {
    return { data: sampleMatch };
  }
  if (url.includes('/api/matches')) {
    return { data: [sampleMatch] };
  }
  if (url.includes('/api/analysis/config')) {
    return { data: { gatewayEnabled: false, routing: [] } };
  }
  if (url.includes('/api/analysis/')) {
    return { data: null };
  }
  if (url.includes('/api/admin/')) {
    return { data: [] };
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
