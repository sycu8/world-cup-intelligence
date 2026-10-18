/**
 * Offline score-prediction backtest on production D1 via REST (recomputes at minute 0).
 *
 * Usage:
 *   npx tsx scripts/backtest-scores-production-rest.ts
 *   npx tsx scripts/backtest-scores-production-rest.ts --years=2018,2022 --mode=v4
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppEnv } from '../src/env';
import { runOfflineBacktestFromEnv } from '../src/models/backtesting/offlineBacktest';
import type { ProbabilityEngineMode } from '../src/models/probability/engine';
import { createD1RestDatabase, PRODUCTION_D1 } from './d1RestShim';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reportsDir = resolve(root, 'reports');
mkdirSync(reportsDir, { recursive: true });

const yearsArg = process.argv.find((a) => a.startsWith('--years='));
const years = yearsArg ? yearsArg.slice(8).split(',').map(Number) : [2018, 2022];
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.slice(8)) : undefined;
const modeArg = process.argv.find((a) => a.startsWith('--mode='));
const mode = (modeArg?.slice(7) ?? 'v5') as ProbabilityEngineMode;

const env = {
  DB: createD1RestDatabase(PRODUCTION_D1.accountId, PRODUCTION_D1.databaseId),
  ENVIRONMENT: 'production',
} as AppEnv;

const t0 = Date.now();
console.log(`Running offline score backtest (${mode}) on years ${years.join(', ')}...`);

const report = await runOfflineBacktestFromEnv(env, years, undefined, limit, mode);
const outPath = resolve(reportsDir, `score-backtest-${mode}.json`);
writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log(
  JSON.stringify(
    {
      mode,
      years,
      matchCount: report.matchCount,
      favoriteHitRate: report.favoriteHitRate,
      scorelineTop1Rate: report.scorelineTop1Rate,
      scorelineTop3Rate: report.scorelineTop3Rate,
      avgBrier: report.avgBrier,
      avgActualScoreProb: report.avgActualScoreProb,
      elapsedMs: Date.now() - t0,
      reportPath: outPath,
    },
    null,
    2,
  ),
);

process.exit(report.matchCount === 0 ? 1 : 0);
