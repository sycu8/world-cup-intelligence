/**
 * Bulk-recompute all WC 2026 matches on production D1 via REST API (no admin token).
 * Usage: npx tsx scripts/recompute-all-production-rest.ts
 */
import type { AppEnv } from '../src/env';
import { recomputeAllWc2026Matches } from '../src/services/recomputeMatch';
import { createD1RestDatabase, PRODUCTION_D1 } from './d1RestShim';

const env = {
  DB: createD1RestDatabase(PRODUCTION_D1.accountId, PRODUCTION_D1.databaseId),
  ENVIRONMENT: 'production',
} as AppEnv;

const t0 = Date.now();
console.log('Starting production bulk recompute via D1 REST...');
const result = await recomputeAllWc2026Matches(env);
console.log(JSON.stringify({ ...result, elapsedMs: Date.now() - t0 }, null, 2));
process.exit(result.failed.length > 0 ? 1 : 0);
