import { describe, expect, it } from 'vitest';
import { createMockDb, createMockEnv, createMockKv } from './helpers/mockEnv';
import { FIXTURE_MATCH } from './helpers/fixtures';
import { getMatchLineups } from '../src/db/repositories/lineupsRepo';
import { listActiveScenariosForMatch } from '../src/db/repositories/matchPredictionScenarioRepo';
import { buildBracketPayload } from '../src/services/bracketPayload';
import { getGroupContextForMatch } from '../src/services/matchGroupContext';
import { getHeadToHead, getTeamRecentWorldCupMatches } from '../src/services/matchHistory';
import { getProjectedLineupForMatch } from '../src/services/matchLineupProjection';
import { getMatchRecap } from '../src/services/matchRecap';
import { fetchHotNewsArticles } from '../src/services/newsListPayload';
import { classifyNewsImpact } from '../src/services/newsMatchImpact';
import { listApiClients } from '../src/services/publicApi/clients';
import { recomputeAllActiveMatches } from '../src/services/recomputeMatch';
import { backfillNewsThumbnails } from '../src/services/newsThumbnailBackfill';
import { getMatchEvents } from '../src/db/repositories/eventsRepo';
import { listPlayers } from '../src/db/repositories/playersRepo';
import { listSources } from '../src/db/repositories/sourcesRepo';
import { listTeams, getTeamsByTournament } from '../src/db/repositories/teamsRepo';
import { listMatches, getMatchesByTournament } from '../src/db/repositories/matchesRepo';
import { getLatestMarketOdds } from '../src/db/repositories/marketRepo';
import { listLatestSnapshotsForTournament } from '../src/db/repositories/probabilityRepo';
import { listScenariosForMatch } from '../src/db/repositories/scenarioRepo';
import { listMatchesWithSlug } from '../src/services/matchRef';
import { getMatchStaff } from '../src/services/matchStaff';
import { getProbabilityMovement } from '../src/services/matchIntelligence';
import { buildGroupStandingsPayload } from '../src/services/tournamentStandings';
import { computeGroupStandings } from '../src/services/tournamentProgression';
import { queryFeed } from '../src/services/publicApi/feed';
import { listWebhooks } from '../src/services/publicApi/webhooks';
import { buildSchedulePayload } from '../src/services/schedulePayload';
import { buildSitemapXml } from '../src/services/siteDiscovery';
import { countUntranslatedNews } from '../src/services/newsTranslation';
import { jsonRoute } from './helpers/routeHarness';
import { playerRoutes } from '../src/routes/players';
import { teamRoutes } from '../src/routes/teams';
import { searchRoutes } from '../src/routes/search';

describe('coverage D1 null results batch', () => {
  const emptyAll = () => ({}) as { results?: unknown[] };

  it('repository list functions return [] when results omitted', async () => {
    const db = createMockDb({ all: emptyAll, first: () => null });
    expect(await getMatchEvents(db, 'm-1')).toEqual([]);
    expect(await listPlayers(db)).toEqual([]);
    expect(await listSources(db)).toEqual([]);
    expect(await listTeams(db)).toEqual([]);
    expect(await getTeamsByTournament(db, 't-2026')).toEqual([]);
    expect(await listMatches(db)).toEqual([]);
    expect(await getMatchesByTournament(db, 't-2026')).toEqual([]);
    expect(await getLatestMarketOdds(db, 'm-1')).toEqual([]);
    expect(await listLatestSnapshotsForTournament(db, 't-2026')).toEqual([]);
    expect(await listScenariosForMatch(db, 'm-1')).toEqual([]);
    expect(await listActiveScenariosForMatch(db, 'm-1')).toEqual([]);
    expect(await listMatchesWithSlug(db)).toEqual([]);
  });

  it('getMatchLineups coalesces missing lineup and player results', async () => {
    const db = createMockDb({
      all: (sql) => {
        if (sql.includes('FROM lineups')) return {};
        if (sql.includes('lineup_players')) return {};
        return {};
      },
    });
    expect(await getMatchLineups(db, 'm-1')).toEqual([]);

    const db2 = createMockDb({
      all: (sql) => {
        if (sql.includes('FROM lineups')) return { results: [{ id: 'lu-1', formation: '4-3-3' }] };
        if (sql.includes('lineup_players')) return {};
        return {};
      },
    });
    const enriched = await getMatchLineups(db2, 'm-1');
    expect(enriched).toHaveLength(1);
    expect(enriched[0]?.players).toEqual([]);
  });

  it('service payloads tolerate omitted D1 results', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        all: emptyAll,
        first: (sql) => {
          if (sql.includes('FROM matches m')) return { ...FIXTURE_MATCH, slug: 'slug-1' };
          if (sql.includes('FROM match_recaps')) return null;
          return null;
        },
      }),
      KV: createMockKv(),
    });

    expect(await buildBracketPayload(env)).toBeTruthy();
    expect(await getGroupContextForMatch(env, FIXTURE_MATCH.id)).toEqual({ fixtures: [], groupCode: null });
    expect(await getHeadToHead(env, FIXTURE_MATCH.home_team_id, FIXTURE_MATCH.away_team_id)).toBeTruthy();
    expect(await getTeamRecentWorldCupMatches(env, FIXTURE_MATCH.home_team_id)).toEqual([]);
    expect(await listApiClients(env)).toEqual([]);
    expect(await recomputeAllActiveMatches(env)).toEqual([]);
    expect(await backfillNewsThumbnails(env, 1)).toBe(0);
    expect(await fetchHotNewsArticles(env)).toEqual([]);
    expect((await buildSchedulePayload(env)).data.matches).toEqual([]);
    expect(await listWebhooks(env, 'client-1')).toEqual([]);
    expect(await queryFeed(env, {})).toEqual({ events: [], nextCursor: null });
    expect(await countUntranslatedNews(env)).toBe(0);
    expect(await buildSitemapXml(env, 'https://example.com')).toContain('urlset');
    expect(await buildGroupStandingsPayload(env)).toBeTruthy();
    expect(await computeGroupStandings(env.DB, 'A')).toEqual([]);

    const staff = await getMatchStaff(env, FIXTURE_MATCH.id);
    expect(staff?.officials).toEqual([]);

    expect(await getMatchRecap(env, FIXTURE_MATCH.id)).toBeNull();
    const movement = await getProbabilityMovement(env, FIXTURE_MATCH.id);
    expect(movement?.events).toEqual([]);
  });

  it('getProjectedLineupForMatch uses empty squad and club results', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        first: () => null,
        all: emptyAll,
      }),
    });
    const projected = await getProjectedLineupForMatch(env, 'm-1', 'team-usa', 'United States');
    expect(projected.source).toBe('projected');
    expect(projected.players.length).toBeGreaterThan(0);
  });

  it('classifyNewsImpact skips short needles', () => {
    expect(classifyNewsImpact('ab', null)).toBe('none');
  });

  it('routes return empty arrays when D1 omits results', async () => {
    const env = createMockEnv({
      DB: createMockDb({ all: emptyAll, first: () => null }),
    });
    const players = await jsonRoute(playerRoutes, '/', { env });
    expect(players.res.status).toBe(200);
    expect((players.json as { data: unknown[] }).data).toEqual([]);

    const teams = await jsonRoute(teamRoutes, '/', { env });
    expect((teams.json as { data: unknown[] }).data).toEqual([]);

    const search = await jsonRoute(searchRoutes, '/?q=test', { env });
    expect((search.json as { data: { teams: unknown[]; players: unknown[]; matches: unknown[] } }).data.teams).toEqual(
      [],
    );
  });
});
