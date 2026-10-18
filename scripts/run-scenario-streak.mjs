/**
 * Run capability scenarios sequentially until N consecutive PASS (default 10).
 * On FAIL: prints evidence, writes report, exits 1 (restart streak from S01).
 *
 * Usage:
 *   node scripts/run-scenario-streak.mjs
 *   node scripts/run-scenario-streak.mjs --goal 10
 *   BASE_URL=http://127.0.0.1:8790 EXPECT_ENV=development node scripts/run-scenario-streak.mjs
 */
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const goalArg = process.argv.find((a) => a.startsWith('--goal='));
const goal = goalArg ? Number(goalArg.split('=')[1]) : 10;

const env = {
  ...process.env,
  STREAK_GOAL: String(goal),
};

const result = spawnSync('node', ['scripts/run-capability-scenarios.mjs', '--streak'], {
  cwd: root,
  env,
  encoding: 'utf8',
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
