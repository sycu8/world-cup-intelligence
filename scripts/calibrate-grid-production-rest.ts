/**
 * Grid-search baseGoalRate, rho, and drawInflation on WC holdout via D1 REST.
 *
 * Usage: npx tsx scripts/calibrate-grid-production-rest.ts --years=2018,2022
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppEnv } from '../src/env';
import { runOfflineBacktestFromEnv } from '../src/models/backtesting/offlineBacktest';
import {
  buildCalibrationGrid,
  pickBestCalibration,
  scoreCalibrationCandidate,
} from '../src/models/probability/calibrateGrid';
import { mergeCalibration } from '../src/models/probability/calibration';
import { createD1RestDatabase, PRODUCTION_D1 } from './d1RestShim';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reportsDir = resolve(root, 'reports');
mkdirSync(reportsDir, { recursive: true });

const yearsArg = process.argv.find((a) => a.startsWith('--years='));
const years = yearsArg ? yearsArg.slice(8).split(',').map(Number) : [2018, 2022];
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.slice(8)) : undefined;

const env = {
  DB: createD1RestDatabase(PRODUCTION_D1.accountId, PRODUCTION_D1.databaseId),
  ENVIRONMENT: 'production',
} as AppEnv;

const grid = buildCalibrationGrid();
const candidates = [];

console.log(`Grid search: ${grid.length} candidates on years ${years.join(', ')}...`);

for (let i = 0; i < grid.length; i++) {
  const overrides = grid[i]!;
  const calibration = mergeCalibration(overrides);
  const report = await runOfflineBacktestFromEnv(env, years, overrides, limit, 'v5');
  candidates.push(scoreCalibrationCandidate(calibration, report));
  if ((i + 1) % 10 === 0 || i === grid.length - 1) {
    console.log(`  evaluated ${i + 1}/${grid.length}`);
  }
}

const best = pickBestCalibration(candidates);
const outPath = resolve(reportsDir, 'calibration-grid-best.json');
writeFileSync(
  outPath,
  JSON.stringify(
    {
      years,
      evaluated: grid.length,
      best,
      top5: [...candidates].sort((a, b) => a.score - b.score).slice(0, 5),
    },
    null,
    2,
  ),
);

console.log(JSON.stringify({ best, reportPath: outPath }, null, 2));
process.exit(best ? 0 : 1);
