#!/usr/bin/env node
/**
 * Offline score-prediction backtest + optional calibration grid search.
 *
 * Usage:
 *   npm run backtest:scores
 *   node scripts/calibrate-probability-model.mjs --years=2018,2022
 *   node scripts/calibrate-probability-model.mjs --grid
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const yearsArg = process.argv.find((a) => a.startsWith('--years='));
const years = yearsArg ? yearsArg.slice(8) : '2018,2022';
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? limitArg.slice(8) : '';
const runGrid = process.argv.includes('--grid');
const remoteOnly = process.argv.includes('--remote-only');

function hasD1Token() {
  return Boolean(
    process.env.CLOUDFLARE_API_TOKEN?.trim() ||
      existsSync(resolve(root, 'cf-deploy.token')),
  );
}

function run(cmd, args, label) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(cmd, args, { cwd: root, encoding: 'utf8', stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!remoteOnly) {
  run(
    'npx',
    ['vitest', 'run', 'tests/scorelineMetrics.test.ts', 'tests/offlineBacktest.test.ts', 'tests/acceptanceGates.test.ts'],
    'Unit tests (scoreline metrics, offline backtest, acceptance gates)',
  );
}

if (hasD1Token()) {
  const backtestArgs = ['tsx', `scripts/backtest-scores-production-rest.ts`, `--years=${years}`];
  if (limit) backtestArgs.push(`--limit=${limit}`);

  run('npx', [...backtestArgs, '--mode=v4'], 'Remote D1 backtest — wc-prob-v4 baseline');
  run('npx', [...backtestArgs, '--mode=v5'], 'Remote D1 backtest — wc-prob-v5');

  if (runGrid) {
    const gridArgs = ['tsx', 'scripts/calibrate-grid-production-rest.ts', `--years=${years}`];
    if (limit) gridArgs.push(`--limit=${limit}`);
    run('npx', gridArgs, 'Calibration grid search on holdout');
  }

  run('npx', ['tsx', 'scripts/validate-score-model-acceptance.ts', '--cached'], 'Acceptance gates vs v4 baseline');
} else {
  console.log('\nSkipping remote D1 backtest (no CLOUDFLARE_API_TOKEN / cf-deploy.token).');
  if (runGrid) {
    console.log('Grid search requires remote D1 — run with cf-deploy.token present.');
  }
}

console.log('\nScore backtest harness complete.');
