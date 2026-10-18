/**
 * Compute and cache WC 2026 champion odds against remote D1/KV.
 * Usage: npx tsx scripts/refresh-champion-odds-remote.ts [simulations] [--production]
 */
import { getPlatformProxy } from 'wrangler';
import type { AppEnv } from '../src/env';
import { computeChampionOdds, refreshChampionOdds } from '../src/services/tournamentChampionOdds';

const args = process.argv.slice(2);
const production = args.includes('--production');
const simulations = Number(args.find((arg) => arg !== '--production') ?? 12_000);

const { env, dispose } = await getPlatformProxy<AppEnv>({
  configPath: './wrangler.jsonc',
  persist: false,
  remoteBindings: true,
  environment: production ? 'production' : undefined,
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
