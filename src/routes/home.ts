import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { ensureNewsCrawlFresh, ensurePipelineFresh } from '../services/pipelineBootstrap';
import { getCachedJsonWithVersion } from '../services/payloadCache';
import { buildHomePayloadData, emptyHomeSections } from '../services/homePayload';
import { persistMissingTournamentProbabilities } from '../services/tournamentMatchProbabilities';
import { getChampionOddsForHome } from '../services/tournamentChampionOdds';
import { WC2026_TOURNAMENT_ID } from '../constants/tournament';
import * as matchesRepo from '../db/repositories/matchesRepo';
import * as probabilityRepo from '../db/repositories/probabilityRepo';
import { withPathCache } from '../services/workersPathCache';
import { logWarn } from '../utils/logger';

const HOME_CACHE_CONTROL = 'public, max-age=30, stale-while-revalidate=60';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

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
  return withPathCache(`api:home:${tournament}`, 30, async () => {
    const [data, championOdds] = await Promise.all([
      getCachedJsonWithVersion(c.env, `home:${tournament}`, () => buildHomePayloadData(c.env, tournament)).catch(
        (err: unknown) => {
          logWarn('home payload unavailable', { tournament, error: errorMessage(err) });
          return emptyHomeSections(tournament);
        },
      ),
      getChampionOddsForHome(c.env, c.executionCtx).catch((err: unknown) => {
        logWarn('home champion odds unavailable', { error: errorMessage(err) });
        return null;
      }),
    ]);

    c.executionCtx.waitUntil(
      missingProbabilityIds(c.env)
        .then((ids) => (ids.length ? persistMissingTournamentProbabilities(c.env, ids) : undefined))
        .catch(() => undefined),
    );

    return c.json({ data: { ...data, championOdds } }, 200, {
      'Cache-Control': HOME_CACHE_CONTROL,
    });
  });
});
