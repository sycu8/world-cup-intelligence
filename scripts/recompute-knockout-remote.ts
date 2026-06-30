/**
 * Recompute knockout match probabilities (R32 → Final) on remote D1.
 * Usage: npx tsx scripts/recompute-knockout-remote.ts
 */
import { getPlatformProxy } from 'wrangler';
import type { AppEnv } from '../src/env';
import { recomputeKnockoutMatches } from '../src/services/recomputeMatch';
import { refreshChampionOdds } from '../src/services/tournamentChampionOdds';

const { env, dispose } = await getPlatformProxy<AppEnv>({
  configPath: './wrangler.jsonc',
  persist: false,
  remoteBindings: true,
  env: 'production',
});

try {
  const result = await recomputeKnockoutMatches(env);
  console.log(JSON.stringify(result, null, 2));
  await refreshChampionOdds(env).catch((e) => {
    console.warn('champion odds refresh failed', e);
  });
} finally {
  await dispose();
}
