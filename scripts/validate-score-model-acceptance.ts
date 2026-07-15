/**
 * Acceptance gates: v5 must beat v4 on WC holdout + Mexico–SA fixture test passes.
 *
 * Usage: npx tsx scripts/validate-score-model-acceptance.ts
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppEnv } from '../src/env';
import { evaluateAcceptanceGates } from '../src/models/backtesting/acceptanceGates';
import { runOfflineBacktestFromEnv } from '../src/models/backtesting/offlineBacktest';
import { createD1RestDatabase, PRODUCTION_D1 } from './d1RestShim';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reportsDir = resolve(root, 'reports');
mkdirSync(reportsDir, { recursive: true });

const years = [2018, 2022];
const v4Path = resolve(reportsDir, 'score-backtest-v4.json');
const v5Path = resolve(reportsDir, 'score-backtest-v5.json');
const acceptancePath = resolve(reportsDir, 'score-acceptance-gates.json');

function hasD1Token(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_API_TOKEN?.trim() ||
      existsSync(resolve(root, 'cf-deploy.token')),
  );
}

async function loadOrRunBacktests(): Promise<{ v4: Awaited<ReturnType<typeof runOfflineBacktestFromEnv>>; v5: Awaited<ReturnType<typeof runOfflineBacktestFromEnv>> }> {
  if (hasD1Token() && !process.argv.includes('--cached')) {
    const env = {
      DB: createD1RestDatabase(PRODUCTION_D1.accountId, PRODUCTION_D1.databaseId),
      ENVIRONMENT: 'production',
    } as AppEnv;

    console.log('Running v4 baseline backtest...');
    const v4 = await runOfflineBacktestFromEnv(env, years, undefined, undefined, 'v4');
    writeFileSync(v4Path, JSON.stringify(v4, null, 2));

    console.log('Running v5 backtest...');
    const v5 = await runOfflineBacktestFromEnv(env, years, undefined, undefined, 'v5');
    writeFileSync(v5Path, JSON.stringify(v5, null, 2));

    return { v4, v5 };
  }

  if (!existsSync(v4Path) || !existsSync(v5Path)) {
    throw new Error(
      'Missing reports/score-backtest-v4.json or score-backtest-v5.json — run with D1 token or provide cached reports',
    );
  }

  return {
    v4: JSON.parse(readFileSync(v4Path, 'utf8')),
    v5: JSON.parse(readFileSync(v5Path, 'utf8')),
  };
}

const { v4, v5 } = await loadOrRunBacktests();
const gates = evaluateAcceptanceGates(v4, v5);
writeFileSync(acceptancePath, JSON.stringify({ v4, v5, gates }, null, 2));

console.log('Acceptance gates:');
for (const g of gates.gates) {
  console.log(`  ${g.passed ? 'PASS' : 'FAIL'} ${g.name}: v4=${g.v4} v5=${g.v5} (${g.rule})`);
}

console.log('Running mexicoSouthAfricaModel regression test...');
const testResult = spawnSync(
  'npx',
  ['vitest', 'run', 'tests/mexicoSouthAfricaModel.test.ts'],
  { cwd: root, encoding: 'utf8', stdio: 'inherit' },
);

const fixturePassed = testResult.status === 0;
const allPassed = gates.passed && fixturePassed;

console.log(
  JSON.stringify(
    {
      acceptanceGates: gates.passed,
      mexicoSouthAfricaFixture: fixturePassed,
      passed: allPassed,
      reportPath: acceptancePath,
    },
    null,
    2,
  ),
);

process.exit(allPassed ? 0 : 1);
