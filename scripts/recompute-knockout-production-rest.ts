/**
 * Recompute knockout match probabilities (R32 → Final) on production D1 via REST.
 * Usage: npx tsx scripts/recompute-knockout-production-rest.ts
 */
import type { AppEnv } from '../src/env';
import { recomputeKnockoutMatches } from '../src/services/recomputeMatch';
import { createD1RestDatabase, PRODUCTION_D1 } from './d1RestShim';

const env = {
  DB: createD1RestDatabase(PRODUCTION_D1.accountId, PRODUCTION_D1.databaseId),
  ENVIRONMENT: 'production',
} as AppEnv;

const t0 = Date.now();
console.log('Starting production knockout recompute via D1 REST...');
const result = await recomputeKnockoutMatches(env);
console.log(JSON.stringify({ ...result, elapsedMs: Date.now() - t0 }, null, 2));
process.exit(result.failed.length > 0 ? 1 : 0);
