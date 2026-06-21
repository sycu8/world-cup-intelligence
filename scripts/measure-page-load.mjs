/**
 * Repeatable page-load benchmark — server TTFB (time to first byte) per route.
 *
 * Usage:
 *   node scripts/measure-page-load.mjs
 *   BASE_URL=https://wcstat.orangecloud.vn SAMPLES=5 node scripts/measure-page-load.mjs
 *   node scripts/measure-page-load.mjs --json > reports/page-load.json
 *
 * Conditions (fixed unless overridden via env):
 *   - curl time_starttransfer (seconds → ms)
 *   - Cache-Control: no-cache on each request (worker still executes; CDN may vary)
 *   - 1 warmup request per target (discarded) unless WARMUP=0
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = (process.env.BASE_URL ?? 'https://wcstat.orangecloud.vn').replace(/\/$/, '');
const SAMPLES = Math.max(1, Number(process.env.SAMPLES ?? 5));
const WARMUP = process.env.WARMUP !== '0';
const TARGET_MS = Number(process.env.TARGET_MS ?? 50);
const jsonOut = process.argv.includes('--json');

/** @type {{ id: string; kind: 'spa' | 'api'; path: string }[]} */
const TARGETS = [
  { id: 'spa-home', kind: 'spa', path: '/' },
  { id: 'spa-matches', kind: 'spa', path: '/matches' },
  { id: 'spa-guide', kind: 'spa', path: '/guide' },
  { id: 'spa-news', kind: 'spa', path: '/news-intelligence' },
  { id: 'spa-api-docs', kind: 'spa', path: '/docs/api' },
  { id: 'spa-seo-schedule', kind: 'spa', path: '/lich-thi-dau-world-cup-2026' },
  { id: 'spa-seo-live', kind: 'spa', path: '/ti-so-truc-tiep-world-cup-2026' },
  { id: 'spa-seo-standings', kind: 'spa', path: '/bang-xep-hang-world-cup-2026' },
  { id: 'spa-seo-results', kind: 'spa', path: '/ket-qua-world-cup-2026' },
  { id: 'spa-seo-predict', kind: 'spa', path: '/du-doan-world-cup-2026' },
  { id: 'spa-seo-analysis', kind: 'spa', path: '/phan-tich-world-cup-2026' },
  { id: 'spa-seo-groups', kind: 'spa', path: '/vong-bang-world-cup-2026' },
  { id: 'spa-seo-knockout', kind: 'spa', path: '/vong-knockout-world-cup-2026' },
  { id: 'spa-match', kind: 'spa', path: '/matches/m-w26-ga-1v2' },
  { id: 'api-health', kind: 'api', path: '/api/health' },
  { id: 'api-home', kind: 'api', path: '/api/home' },
  { id: 'api-schedule', kind: 'api', path: '/api/schedule' },
  { id: 'api-dashboard', kind: 'api', path: '/api/dashboard' },
  { id: 'api-standings', kind: 'api', path: '/api/tournaments/2026/standings' },
  { id: 'api-match', kind: 'api', path: '/api/matches/m-w26-ga-1v2' },
  { id: 'api-probability', kind: 'api', path: '/api/matches/m-w26-ga-1v2/probability' },
];

function curlTtfbMs(url) {
  const args = [
    '-o',
    '/dev/null',
    '-s',
    '-w',
    '%{http_code}\t%{time_starttransfer}',
    '-H',
    'Cache-Control: no-cache',
    '-H',
    'Pragma: no-cache',
    url,
  ];
  const out = spawnSync('curl', args, { encoding: 'utf8' });
  if (out.status !== 0) {
    throw new Error(`curl failed for ${url}: ${out.stderr || out.stdout}`);
  }
  const line = out.stdout.trim();
  const [status, ttfbSec] = line.split('\t');
  return { status: Number(status), ttfbMs: Math.round(Number(ttfbSec) * 1000) };
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function measureTarget(target) {
  const url = `${BASE_URL}${target.path}`;
  if (WARMUP) curlTtfbMs(`${url}${url.includes('?') ? '&' : '?'}_w=1`);

  const samples = [];
  for (let i = 0; i < SAMPLES; i += 1) {
    const bust = `_b=${Date.now()}-${i}`;
    const full = `${url}${url.includes('?') ? '&' : '?'}${bust}`;
    const { status, ttfbMs } = curlTtfbMs(full);
    samples.push({ status, ttfbMs });
  }

  const times = samples.map((s) => s.ttfbMs).sort((a, b) => a - b);
  const statuses = [...new Set(samples.map((s) => s.status))];
  const p50 = percentile(times, 50);
  const p95 = percentile(times, 95);
  const pass = p95 <= TARGET_MS && statuses.every((s) => s >= 200 && s < 400);

  return {
    id: target.id,
    kind: target.kind,
    path: target.path,
    samples: times,
    p50,
    p95,
    max: times[times.length - 1] ?? 0,
    min: times[0] ?? 0,
    httpStatus: statuses,
    pass,
  };
}

function main() {
  const startedAt = new Date().toISOString();
  const results = TARGETS.map(measureTarget);
  const failed = results.filter((r) => !r.pass);
  const report = {
    startedAt,
    baseUrl: BASE_URL,
    samples: SAMPLES,
    warmup: WARMUP,
    targetMs: TARGET_MS,
    summary: {
      total: results.length,
      pass: results.length - failed.length,
      fail: failed.length,
      allPass: failed.length === 0,
    },
    results,
  };

  if (jsonOut) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Page-load benchmark — ${BASE_URL}`);
    console.log(`Target: p95 ≤ ${TARGET_MS} ms | samples=${SAMPLES} warmup=${WARMUP}\n`);
    console.log('ID\tKIND\tP50\tP95\tMAX\tPASS\tPATH');
    for (const r of results) {
      console.log(
        `${r.id}\t${r.kind}\t${r.p50}\t${r.p95}\t${r.max}\t${r.pass ? 'PASS' : 'FAIL'}\t${r.path}`,
      );
    }
    console.log(`\n${report.summary.pass}/${report.summary.total} pass (p95 ≤ ${TARGET_MS} ms)`);
    if (failed.length) {
      console.log('Slowest failures:');
      for (const r of [...failed].sort((a, b) => b.p95 - a.p95).slice(0, 8)) {
        console.log(`  ${r.id} p95=${r.p95}ms ${r.path}`);
      }
    }
  }

  const reportsDir = resolve(root, 'reports');
  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(resolve(reportsDir, 'page-load.json'), `${JSON.stringify(report, null, 2)}\n`);

  process.exit(report.summary.allPass ? 0 : 1);
}

main();
