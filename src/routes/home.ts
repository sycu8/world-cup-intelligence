import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { ensureNewsCrawlFresh, ensurePipelineFresh } from '../services/pipelineBootstrap';
import { getCachedJsonWithVersion } from '../services/payloadCache';
import { buildHomePayloadData } from '../services/homePayload';
import { persistMissingTournamentProbabilities } from '../services/tournamentMatchProbabilities';
import { WC2026_TOURNAMENT_ID } from '../constants/tournament';
import * as matchesRepo from '../db/repositories/matchesRepo';
import * as probabilityRepo from '../db/repositories/probabilityRepo';

export const homeRoutes = new Hono<{ Bindings: AppEnv }>();

async function missingProbabilityIds(env: AppEnv): Promise<string[]> {
  const [rows, matches] = await Promise.all([
    probabilityRepo.listLatestSnapshotsForTournament(env.DB, WC2026_TOURNAMENT_ID),
    matchesRepo.getMatchesByTournament(env.DB, WC2026_TOURNAMENT_ID),
  ]);
  const withProb = new Set(rows.map((r) => r.matchId));
  return matches.map((m) => m.id).filter((id) => !withProb.has(id));
}

/** Single round-trip payload for the homepage (schedule + dashboard + hot news). */
homeRoutes.get('/', async (c) => {
  c.executionCtx.waitUntil(
    Promise.all([
      ensurePipelineFresh(c.env).catch(() => undefined),
      ensureNewsCrawlFresh(c.env).catch(() => undefined),
    ]),
  );

  const tournament = c.req.query('tournament') ?? 't-2026';
  const data = await getCachedJsonWithVersion(c.env, `home:${tournament}`, () =>
    buildHomePayloadData(c.env, tournament),
  );

  c.executionCtx.waitUntil(
    missingProbabilityIds(c.env)
      .then((ids) => (ids.length ? persistMissingTournamentProbabilities(c.env, ids) : undefined))
      .catch(() => undefined),
  );

  return c.json({ data }, 200, {
    'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
  });
});
