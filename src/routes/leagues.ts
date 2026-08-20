import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { parseEnv } from '../env';
import { buildLeagueCatalogPayload, buildLeagueHubPayload } from '../services/leaguePayload';
import { getLeagueBySlug } from '../constants/leagues';
import { syncAllClubLeagues, syncLeague } from '../ingestion/leagues/syncLeagues';
import { recomputeMatchProbability } from '../services/recomputeMatch';

export const leagueRoutes = new Hono<{ Bindings: AppEnv }>();

leagueRoutes.get('/', async (c) => {
  const data = await buildLeagueCatalogPayload(c.env);
  return c.json(
    { data },
    200,
    { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' },
  );
});

leagueRoutes.get('/:slug', async (c) => {
  const slug = c.req.param('slug');
  const data = await buildLeagueHubPayload(c.env, slug);
  if (!data) return c.json({ error: 'Not found' }, 404);
  return c.json(
    { data },
    200,
    { 'Cache-Control': 'public, max-age=20, stale-while-revalidate=40' },
  );
});

leagueRoutes.post('/sync', async (c) => {
  const cfg = parseEnv(c.env);
  const token = c.req.header('X-Admin-Token');
  if (cfg.adminToken && token !== cfg.adminToken) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const slug = c.req.query('slug');
  const league = slug ? getLeagueBySlug(slug) : undefined;
  const results = league && league.format !== 'world_cup'
    ? [await syncLeague(c.env, league)]
    : await syncAllClubLeagues(c.env);

  const matchIds = (
    await c.env.DB.prepare(
      `SELECT id FROM matches
       WHERE tournament_id IN ('t-la-liga','t-j1','t-vleague','t-caf-cl')
         AND status IN ('scheduled','live')
       ORDER BY kickoff_utc ASC LIMIT 16`,
    ).all<{ id: string }>()
  ).results?.map((r) => r.id) ?? [];

  if (matchIds.length && c.env.MODEL_QUEUE) {
    await c.env.MODEL_QUEUE.send({ type: 'recompute_all', matchIds });
  } else {
    for (const id of matchIds.slice(0, 8)) {
      await recomputeMatchProbability(c.env, id).catch(() => undefined);
    }
  }

  return c.json({ data: { results, queued: matchIds.length } });
});
