#!/usr/bin/env node
/**
 * Prune probability_snapshots on D1 (UAT recovery / maintenance).
 *
 * Usage:
 *   node scripts/prune-probability-snapshots.mjs --remote
 *   node scripts/prune-probability-snapshots.mjs --remote --production
 *   node scripts/prune-probability-snapshots.mjs --remote --keep-latest
 */
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const remote = process.argv.includes('--remote');
const production = process.argv.includes('--production');
const keepLatest = process.argv.includes('--keep-latest');
const skipCount = process.argv.includes('--skip-count');
const batchArg = process.argv.find((a) => a.startsWith('--batch='));
const batchSize = batchArg ? Math.max(500, Number(batchArg.slice(8)) || 2000) : 2000;
const maxBatchesArg = process.argv.find((a) => a.startsWith('--max-batches='));
const maxBatches = maxBatchesArg ? Math.max(1, Number(maxBatchesArg.slice(14)) || 500) : 500;

const dbName = production ? 'wc-tactical-db' : 'wc-tactical-db-uat-v2';
const envArgs = production ? ['--env', 'production'] : [];
const locationArgs = remote ? ['--remote'] : ['--local'];

function runWrangler(args) {
  const result = spawnSync('node', ['scripts/wrangler-with-env.mjs', ...args], {
    cwd: root,
    encoding: 'utf8',
  });
  const out = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  return { ok: result.status === 0, out };
}

function execute(sql) {
  return runWrangler(['d1', 'execute', dbName, ...locationArgs, ...envArgs, '--command', sql]);
}

function parseChanges(out) {
  const match = out.match(/"changes"\s*:\s*(\d+)/);
  return match ? Number(match[1]) : 0;
}

function parseCount(out) {
  const match = out.match(/"n"\s*:\s*(\d+)/);
  return match ? Number(match[1]) : null;
}

function countRows() {
  const { ok, out } = execute('SELECT COUNT(*) AS n FROM probability_snapshots');
  if (!ok) return null;
  return parseCount(out);
}

function deleteBatch(limit) {
  const { ok, out } = execute(
    `DELETE FROM probability_snapshots WHERE rowid IN (SELECT rowid FROM probability_snapshots LIMIT ${limit})`,
  );
  if (!ok) throw new Error(out);
  return parseChanges(out);
}

function pruneKeepLatestPerMatch() {
  const { ok, out } = execute(
    `DELETE FROM probability_snapshots
     WHERE id NOT IN (
       SELECT MAX(id) FROM probability_snapshots GROUP BY match_id
     )`,
  );
  if (!ok) throw new Error(out);
  return parseChanges(out);
}

async function main() {
  console.log(`Pruning ${dbName} (${remote ? 'remote' : 'local'}) batch=${batchSize}`);

  const before = skipCount ? null : countRows();
  if (before != null) console.log(`Rows before: ${before}`);
  else console.log('Rows before: (skipped — table too large for COUNT)');

  if (keepLatest && before != null && before <= 500) {
    const removed = pruneKeepLatestPerMatch();
    console.log(`keep-latest pass removed ${removed} rows`);
  } else {
    let totalRemoved = 0;
    for (let i = 1; i <= maxBatches; i += 1) {
      let removed = 0;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          removed = deleteBatch(attempt === 1 ? batchSize : Math.max(500, Math.floor(batchSize / 2)));
          break;
        } catch (err) {
          const message = String(err?.message ?? err);
          if (attempt === 3) {
            console.log(`Batch ${i} failed after retries: ${message.split('\n')[0]}`);
            removed = 0;
            break;
          }
          console.log(`Batch ${i} attempt ${attempt} failed, retrying...`);
        }
      }

      if (removed === 0 && i > 1) break;
      if (removed === 0) continue;

      totalRemoved += removed;
      if (i % 10 === 0 || removed < batchSize) {
        console.log(`Batch ${i}: removed ${removed} (total ${totalRemoved})`);
      }
      if (keepLatest && before != null && before - totalRemoved <= 500) break;
    }

    if (keepLatest) {
      const removed = pruneKeepLatestPerMatch();
      console.log(`keep-latest pass removed ${removed} rows`);
    }
  }

  const after = skipCount ? null : countRows();
  if (after != null && before != null) {
    console.log(`Rows after: ${after} (removed ${before - after})`);
  } else if (after != null) {
    console.log(`Rows after: ${after}`);
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
