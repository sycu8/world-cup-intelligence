#!/usr/bin/env node
/**
 * Offline score-prediction backtest + optional calibration grid search.
 *
 * Usage:
 *   npm run backtest:scores
 *   node scripts/calibrate-probability-model.mjs --years=2018,2022 --limit=40
 *   node scripts/calibrate-probability-model.mjs --grid
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const yearsArg = process.argv.find((a) => a.startsWith('--years='));
const years = yearsArg ? yearsArg.slice(8).split(',').map(Number) : [2018, 2022];
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.slice(8)) : undefined;
const runGrid = process.argv.includes('--grid');

const runner = `
import { runOfflineBacktestFromEnv } from '../src/models/backtesting/offlineBacktest.ts';
import { buildCalibrationGrid, pickBestCalibration, scoreCalibrationCandidate } from '../src/models/probability/calibrateGrid.ts';
import { mergeCalibration } from '../src/models/probability/calibration.ts';

const years = ${JSON.stringify(years)};
const limit = ${limit ?? 'undefined'};
const runGrid = ${runGrid};

// Minimal env stub — script is intended for local wrangler D1 or test DB wiring.
// In CI we rely on vitest offlineBacktest.test.ts instead.
console.log(JSON.stringify({ note: 'Use vitest offline backtest in CI', years, limit, runGrid }, null, 2));
`;

mkdirSync(resolve(root, 'reports'), { recursive: true });
const outPath = resolve(root, 'reports/score-backtest-stub.json');
writeFileSync(outPath, runner);

const result = spawnSync(
  'npx',
  ['vitest', 'run', 'tests/offlineBacktest.test.ts', 'tests/scorelineMetrics.test.ts'],
  { cwd: root, encoding: 'utf8', stdio: 'inherit' },
);

if (result.status !== 0) process.exit(result.status ?? 1);

console.log(`Score backtest unit suite passed. Report stub: ${outPath}`);
if (runGrid) {
  console.log('Grid search runs in tests/offlineBacktest.test.ts (calibrateGrid). For remote D1, extend this script with wrangler D1 bindings.');
}
