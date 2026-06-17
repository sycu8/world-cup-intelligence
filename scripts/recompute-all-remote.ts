/**
 * Bulk-recompute all WC 2026 matches against remote D1.
 * Usage:
 *   npx tsx scripts/recompute-all-remote.ts
 *   npx tsx scripts/recompute-all-remote.ts --production
 */
import { getPlatformProxy } from 'wrangler';
import type { AppEnv } from '../src/env';
import { recomputeAllWc2026Matches } from '../src/services/recomputeMatch';

const production = process.argv.includes('--production');

const { env, dispose } = await getPlatformProxy<AppEnv>({
  configPath: './wrangler.jsonc',
  environment: production ? 'production' : undefined,
  persist: false,
  remoteBindings: true,
});

try {
  console.log(`Recomputing WC 2026 matches on ${production ? 'production' : 'uat'} D1…`);
  const result = await recomputeAllWc2026Matches(env);
  console.log(JSON.stringify(result, null, 2));
} finally {
  await dispose();
}
