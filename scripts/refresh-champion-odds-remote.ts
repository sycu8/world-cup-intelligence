/**
 * Compute and cache WC 2026 champion odds against remote D1/KV.
 * Usage: npx tsx scripts/refresh-champion-odds-remote.ts [simulations]
 */
import { getPlatformProxy } from 'wrangler';
import type { AppEnv } from '../src/env';
import { computeChampionOdds, refreshChampionOdds } from '../src/services/tournamentChampionOdds';

const simulations = Number(process.argv[2] ?? 12_000);

const { env, dispose } = await getPlatformProxy<AppEnv>({
  configPath: './wrangler.jsonc',
  persist: false,
  remoteBindings: true,
});

try {
  const t0 = Date.now();
  const payload = await computeChampionOdds(env, { simulations });
  console.log('computeMs', Date.now() - t0);
  console.log('top3', JSON.stringify(payload.top, null, 2));
  await refreshChampionOdds(env);
  console.log('cached', payload.generatedAt);
} finally {
  await dispose();
}
