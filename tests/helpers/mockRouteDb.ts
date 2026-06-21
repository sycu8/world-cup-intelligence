import { NEWS_CRAWL_KV_KEY } from '../../src/constants/pipeline';
import { WC2026_TOURNAMENT_ID } from '../../src/constants/tournament';
import type { AppEnv } from '../../src/env';
import {
  FIXTURE_MATCH,
  FIXTURE_NEWS,
  FIXTURE_PLAYER,
  FIXTURE_SNAPSHOT,
  FIXTURE_SOURCE,
  FIXTURE_TEAMS,
  FIXTURE_TOURNAMENT,
  matchWithNames,
  type MatchWithNames,
} from './fixtures';
import { createMockDb, createMockEnv, createMockKv } from './mockEnv';

export type RouteDbFixtures = {
  tournament: typeof FIXTURE_TOURNAMENT;
  teams: typeof FIXTURE_TEAMS;
  match: MatchWithNames;
  player: typeof FIXTURE_PLAYER;
  snapshot: typeof FIXTURE_SNAPSHOT;
  news: typeof FIXTURE_NEWS[];
  sources: typeof FIXTURE_SOURCE[];
  feedEvents: Array<{
    id: number;
    event_type: string;
    match_id: string | null;
    payload_json: string;
    created_at: string;
  }>;
};

const DEFAULT_FIXTURES: RouteDbFixtures = {
  tournament: FIXTURE_TOURNAMENT,
  teams: FIXTURE_TEAMS,
  match: matchWithNames(),
  player: FIXTURE_PLAYER,
  snapshot: FIXTURE_SNAPSHOT,
  news: [FIXTURE_NEWS],
  sources: [FIXTURE_SOURCE],
  feedEvents: [
    {
      id: 1,
      event_type: 'match.score_updated',
      match_id: FIXTURE_MATCH.id,
      payload_json: '{"homeScore":1,"awayScore":0}',
      created_at: '2026-01-01T12:00:00Z',
    },
  ],
};

function teamById(teams: RouteDbFixtures['teams'], id: unknown) {
  return teams.find((t) => t.id === id) ?? null;
}

function matchJoinRow(fixtures: RouteDbFixtures, matchId?: string): MatchWithNames | null {
  if (matchId && matchId !== fixtures.match.id) return null;
  return fixtures.match;
}

function handleFirst(sql: string, binds: unknown[], fixtures: RouteDbFixtures): unknown {
  if (sql.includes('SELECT 1 AS ok')) return { ok: 1 };

  if (sql.includes('FROM tournaments WHERE id')) {
    return binds[0] === fixtures.tournament.id ? fixtures.tournament : null;
  }

  if (sql.includes('SELECT year FROM tournaments WHERE id')) {
    return binds[0] === fixtures.tournament.id ? { year: fixtures.tournament.year } : null;
  }

  if (sql.includes('FROM teams WHERE id')) {
    return teamById(fixtures.teams, binds[0]);
  }

  if (sql.includes('FROM players WHERE id')) {
    return binds[0] === fixtures.player.id ? fixtures.player : null;
  }

  if (sql.includes('FROM probability_snapshots') && sql.includes('match_id = ?')) {
    return binds[0] === fixtures.snapshot.match_id ? fixtures.snapshot : null;
  }

  if (sql.includes('FROM matches m') && sql.includes('m.id = ?')) {
    return matchJoinRow(fixtures, String(binds[1] ?? binds[0]));
  }

  if (sql.includes('FROM matches m') && sql.includes('JOIN teams ht')) {
    if (sql.includes("m.status = 'live'")) return null;
    if (sql.includes('kickoff_utc > ?')) return null;
    if (sql.includes("m.status = 'scheduled'")) return fixtures.match;
    return fixtures.match;
  }

  if (sql.includes('FROM matches WHERE id = ?') && !sql.includes('tournament_id')) {
    const matchId = String(binds[0]);
    if (matchId !== fixtures.match.id) return null;
    return {
      status: fixtures.match.status,
      minute: fixtures.match.minute,
      home_score: fixtures.match.home_score,
      away_score: fixtures.match.away_score,
      updated_at: fixtures.match.updated_at,
    };
  }

  if (sql.includes('SELECT COUNT(*) AS n FROM matches WHERE tournament_id')) {
    return { n: 1 };
  }

  if (sql.includes('SELECT COUNT(DISTINCT group_code)')) {
    return { n: 1 };
  }

  if (sql.includes('FROM source_documents') && sql.includes('WHERE sd.id = ?')) {
    return binds[0] === fixtures.news[0]?.id ? fixtures.news[0] : null;
  }

  if (sql.includes('SELECT thumbnail_url FROM source_documents WHERE id = ?')) {
    return { thumbnail_url: null };
  }

  if (sql.includes('SELECT COUNT(*) AS n FROM source_documents')) {
    return { n: 0 };
  }

  if (sql.includes('SELECT 1 FROM match_recaps WHERE match_id = ?')) {
    return null;
  }

  if (sql.includes('FROM match_events WHERE match_id = ?') && sql.includes('SUM(CASE')) {
    return { goals: 0, yellow_cards: 0, red_cards: 0, substitutions: 0 };
  }

  return null;
}

function handleAll(sql: string, binds: unknown[], fixtures: RouteDbFixtures): { results: unknown[] } {
  if (sql.includes('FROM tournaments')) {
    return { results: [fixtures.tournament] };
  }

  if (sql.includes("GLOB 'team-w26-[a-l][1-4]'")) {
    return { results: fixtures.teams };
  }

  if (sql.includes("LIKE 'team-w26-%'") && sql.includes('country_code')) {
    return {
      results: fixtures.teams.map((t) => ({
        id: t.id,
        name: t.name,
        short_name: t.short_name,
        country_code: t.country_code,
      })),
    };
  }

  if (sql.includes('FROM matches m') && sql.includes('JOIN teams ht')) {
    if (sql.includes("m.status = 'live'")) return { results: [] };
    if (sql.includes('kickoff_utc > ?')) return { results: [fixtures.match] };
    if (sql.includes("m.status = 'scheduled'")) return { results: [fixtures.match] };
    return { results: [fixtures.match] };
  }

  if (sql.includes('FROM matches WHERE tournament_id = ?') && sql.includes('ORDER BY kickoff_utc')) {
    return { results: [fixtures.match] };
  }

  if (sql.includes('FROM matches') && sql.includes("stage = 'Group'") && sql.includes('group_code')) {
    if (sql.includes('GROUP BY group_code')) {
      return { results: [{ group_code: 'A', total: 1, done: 0 }] };
    }
    return {
      results: [
        {
          group_code: fixtures.match.group_code,
          home_team_id: fixtures.match.home_team_id,
          away_team_id: fixtures.match.away_team_id,
          home_score: fixtures.match.home_score,
          away_score: fixtures.match.away_score,
          status: fixtures.match.status,
        },
      ],
    };
  }

  if (sql.includes('FROM probability_snapshots ps')) {
    return {
      results: [
        {
          matchId: fixtures.snapshot.match_id,
          homeWinProb: fixtures.snapshot.home_win_prob,
          drawProb: fixtures.snapshot.draw_prob,
          awayWinProb: fixtures.snapshot.away_win_prob,
        },
      ],
    };
  }

  if (sql.includes('FROM players ORDER BY name')) {
    return { results: [fixtures.player] };
  }

  if (sql.includes('FROM source_registry ORDER BY source_name')) {
    return { results: fixtures.sources };
  }

  if (sql.includes('FROM source_documents')) {
    const limit = Number(binds[binds.length - 1] ?? binds[0] ?? 10);
    void limit;
    return { results: fixtures.news };
  }

  if (sql.includes('GROUP BY status')) {
    return { results: [{ status: 'scheduled', n: 1 }] };
  }

  if (sql.includes('FROM team_match_stats WHERE match_id = ?')) {
    return { results: [] };
  }

  if (sql.includes('FROM match_events e') && sql.includes('player_id = ?')) {
    return { results: [] };
  }

  if (sql.includes('FROM squad_players sp')) {
    return {
      results: [
        {
          player_id: fixtures.player.id,
          name: fixtures.player.name,
          position: fixtures.player.position,
        },
      ],
    };
  }

  if (sql.includes('FROM api_feed_events')) {
    return { results: fixtures.feedEvents };
  }

  if (sql.includes('FROM teams t') && sql.includes('JOIN matches m') && sql.includes('LIKE ?')) {
    return {
      results: fixtures.teams
        .filter((t) => t.name.toLowerCase().includes(String(binds[1]).replace(/%/g, '').toLowerCase()))
        .map((t) => ({ id: t.id, name: t.name })),
    };
  }

  if (sql.includes('FROM players p') && sql.includes('LIKE ?')) {
    return {
      results: [{ id: fixtures.player.id, name: fixtures.player.name }],
    };
  }

  if (sql.includes('ht.name as home') || sql.includes('ht.name AS home')) {
    return {
      results: [
        {
          id: fixtures.match.id,
          stage: fixtures.match.stage,
          home: fixtures.match.home_name,
          away: fixtures.match.away_name,
        },
      ],
    };
  }

  return { results: [] };
}

export function createRouteTestDb(fixtures: Partial<RouteDbFixtures> = {}) {
  const data: RouteDbFixtures = {
    ...DEFAULT_FIXTURES,
    ...fixtures,
    teams: fixtures.teams ?? DEFAULT_FIXTURES.teams,
    news: fixtures.news ?? DEFAULT_FIXTURES.news,
    sources: fixtures.sources ?? DEFAULT_FIXTURES.sources,
    feedEvents: fixtures.feedEvents ?? DEFAULT_FIXTURES.feedEvents,
  };

  return createMockDb({
    first: (sql, binds) => handleFirst(sql, binds, data),
    all: (sql, binds) => handleAll(sql, binds, data),
    run: () => ({ success: true, meta: { last_row_id: 2 } }),
  });
}

export function createRouteTestEnv(overrides: Partial<AppEnv> = {}): AppEnv {
  const now = new Date().toISOString();
  const kv = createMockKv({
    'meta:last_data_refresh': now,
    [NEWS_CRAWL_KV_KEY]: now,
    'meta:last_news_thumb_backfill': now,
    'meta:last_news_thumb_recompress': now,
    'meta:last_news_source_backfill': now,
    'meta:news_untranslated_count': '0',
    'meta:last_fifa_sync': now,
  });

  return createMockEnv({
    ENVIRONMENT: 'development',
    MOCK_SOURCES: 'true',
    AI_FALLBACK_MODE: 'true',
    VECTORIZE_FALLBACK_MODE: 'true',
    CORS_ORIGINS: 'http://localhost:5173',
    KV: kv,
    DB: createRouteTestDb(),
    R2_ARTIFACTS: {
      head: async () => null,
      get: async () => null,
    } as unknown as AppEnv['R2_ARTIFACTS'],
    INGEST_QUEUE: {
      send: async () => undefined,
    } as unknown as AppEnv['INGEST_QUEUE'],
    MODEL_QUEUE: {
      send: async () => undefined,
    } as unknown as AppEnv['MODEL_QUEUE'],
    MATCH_ROOM: {
      idFromName: () => ({ toString: () => 'room-id' }),
      get: () => ({ fetch: async () => new Response(null, { status: 101 }) }),
    } as unknown as AppEnv['MATCH_ROOM'],
    ...overrides,
  });
}
