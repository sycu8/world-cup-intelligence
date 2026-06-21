/**
 * PitchIntel capability scenario suite — pass/fail rubric, consistent conditions.
 *
 * Usage:
 *   node scripts/run-capability-scenarios.mjs
 *   BASE_URL=https://wcstat.orangecloud.vn node scripts/run-capability-scenarios.mjs
 *   node scripts/run-capability-scenarios.mjs --json > reports/capability-scenarios.json
 *
 * Evaluation: each scenario is PASS (all criteria met) or FAIL (any criterion missed).
 * Evidence is recorded per scenario for audit.
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  allFifaKickoffs,
  completedFifaMatches,
  kickoffUtcForFifaNumber,
  fifaMatchIdForFifaNumber,
} from './wc2026-fifa-kickoffs.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = (process.env.BASE_URL ?? 'https://wcstat.orangecloud.vn').replace(/\/$/, '');
const jsonOut = process.argv.includes('--json');
const startedAt = new Date().toISOString();

/** @typedef {{ id: string; capability: string; criteria: string[]; run: () => Promise<{ pass: boolean; evidence: Record<string, unknown> }> }} Scenario */

async function fetchJson(path, init) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { _raw: text.slice(0, 200) };
  }
  return { status: res.status, body };
}

function approxOne(n, tol = 0.02) {
  return typeof n === 'number' && Math.abs(n - 1) <= tol;
}

function sumWdl(p) {
  return (p.homeWinProb ?? 0) + (p.drawProb ?? 0) + (p.awayWinProb ?? 0);
}

/** @type {Scenario[]} */
const SCENARIOS = [
  {
    id: 'S01',
    capability: 'Platform health',
    criteria: [
      'GET /api/health returns 200',
      'status is healthy',
      'D1 dependency is up',
      'environment is production',
    ],
    async run() {
      const { status, body } = await fetchJson('/api/health');
      const evidence = {
        status,
        health: body?.status,
        d1: body?.dependencies?.d1,
        environment: body?.environment,
      };
      const pass =
        status === 200 &&
        body?.status === 'healthy' &&
        body?.dependencies?.d1 === 'up' &&
        body?.environment === 'production';
      return { pass, evidence };
    },
  },
  {
    id: 'S02',
    capability: 'WC 2026 schedule completeness',
    criteria: ['GET /api/schedule returns 200', 'total matches equals 104'],
    async run() {
      const { status, body } = await fetchJson('/api/schedule');
      const total = body?.data?.total;
      return {
        pass: status === 200 && total === 104,
        evidence: { status, total },
      };
    },
  },
  {
    id: 'S03',
    capability: 'Homepage aggregate API',
    criteria: [
      'GET /api/home returns 200',
      'payload includes dashboard, schedule, standings, matchProbabilities',
    ],
    async run() {
      const { status, body } = await fetchJson('/api/home');
      const data = body?.data ?? {};
      const keys = ['dashboard', 'schedule', 'standings', 'matchProbabilities'];
      const present = Object.fromEntries(keys.map((k) => [k, k in data]));
      const pass = status === 200 && keys.every((k) => k in data);
      return { pass, evidence: { status, present } };
    },
  },
  {
    id: 'S04',
    capability: 'FIFA kickoff reference data',
    criteria: [
      'Local FIFA kickoff dataset has exactly 104 fixtures',
      'Every row has kickoffUtc and fifaMatchId',
    ],
    async run() {
      const rows = allFifaKickoffs();
      const missing = rows.filter((r) => !r.kickoffUtc || !r.fifaMatchId);
      return {
        pass: rows.length === 104 && missing.length === 0,
        evidence: { count: rows.length, missing: missing.length },
      };
    },
  },
  {
    id: 'S05',
    capability: 'FIFA completed results seed',
    criteria: [
      'At least 6 completed fixtures in FIFA reference data',
      'Each completed row has numeric homeScore and awayScore',
    ],
    async run() {
      const completed = completedFifaMatches();
      const bad = completed.filter(
        (r) => typeof r.homeScore !== 'number' || typeof r.awayScore !== 'number',
      );
      return {
        pass: completed.length >= 6 && bad.length === 0,
        evidence: { completed: completed.length, invalid: bad.length },
      };
    },
  },
  {
    id: 'S06',
    capability: 'Match slug resolution',
    criteria: [
      'GET /api/matches/{slug} returns 200',
      'Mexico vs South Africa is completed 2–0',
      'Response includes canonical slug',
    ],
    async run() {
      const slug = 'vong-bang-a-mexico-vs-south-africa';
      const { status, body } = await fetchJson(`/api/matches/${slug}`);
      const m = body?.data;
      const pass =
        status === 200 &&
        m?.status === 'completed' &&
        m?.home_score === 2 &&
        m?.away_score === 0 &&
        m?.slug === slug;
      return {
        pass,
        evidence: {
          status,
          home_score: m?.home_score,
          away_score: m?.away_score,
          slug: m?.slug,
        },
      };
    },
  },
  {
    id: 'S07',
    capability: 'Legacy match ID compatibility',
    criteria: ['GET /api/matches/m-w26-ga-1v2 returns 200', 'Resolves to Mexico vs South Africa'],
    async run() {
      const { status, body } = await fetchJson('/api/matches/m-w26-ga-1v2');
      const m = body?.data;
      const pass =
        status === 200 && m?.home_name === 'Mexico' && m?.away_name === 'South Africa';
      return {
        pass,
        evidence: { status, home: m?.home_name, away: m?.away_name },
      };
    },
  },
  {
    id: 'S08',
    capability: 'FIFA Match Centre linkage',
    criteria: [
      'Mexico vs South Africa has fifa_match_id set',
      'kickoff_utc matches FIFA reference for match #1',
    ],
    async run() {
      const { status, body } = await fetchJson('/api/matches/m-w26-ga-1v2');
      const m = body?.data;
      const expectedKickoff = kickoffUtcForFifaNumber(1);
      const expectedFifaId = fifaMatchIdForFifaNumber(1);
      const pass =
        status === 200 &&
        m?.fifa_match_id === expectedFifaId &&
        m?.kickoff_utc === expectedKickoff;
      return {
        pass,
        evidence: {
          fifa_match_id: m?.fifa_match_id,
          expectedFifaId,
          kickoff_utc: m?.kickoff_utc,
          expectedKickoff,
        },
      };
    },
  },
  {
    id: 'S09',
    capability: 'Probability engine output',
    criteria: [
      'GET /api/matches/:id/probability returns 200',
      'W/D/L probabilities sum to ~1',
      'mostLikelyScore is present',
      'modelVersion starts with wc-prob-',
    ],
    async run() {
      const { status, body } = await fetchJson('/api/matches/m-w26-ga-1v2/probability');
      const p = body?.data;
      const wdlSum = sumWdl(p ?? {});
      const pass =
        status === 200 &&
        approxOne(wdlSum) &&
        typeof p?.mostLikelyScore === 'string' &&
        p.mostLikelyScore.length >= 3 &&
        String(p?.modelVersion ?? '').startsWith('wc-prob-');
      return {
        pass,
        evidence: {
          status,
          wdlSum,
          mostLikelyScore: p?.mostLikelyScore,
          modelVersion: p?.modelVersion,
        },
      };
    },
  },
  {
    id: 'S10',
    capability: 'Strong-favorite scoreline calibration',
    criteria: [
      'Clear favorite (Portugal vs Congo DR) has homeWin > 0.6',
      'mostLikelyScore is not 1-1',
      'mostLikelyScore is a tight win (1-0, 2-0, or 2-1)',
    ],
    async run() {
      const { status, body } = await fetchJson('/api/matches/m-w26-gk-1v2/probability');
      const p = body?.data;
      const tight = ['1-0', '2-0', '2-1'];
      const pass =
        status === 200 &&
        (p?.homeWinProb ?? 0) > 0.6 &&
        p?.mostLikelyScore !== '1-1' &&
        tight.includes(p?.mostLikelyScore);
      return {
        pass,
        evidence: {
          status,
          homeWinProb: p?.homeWinProb,
          mostLikelyScore: p?.mostLikelyScore,
        },
      };
    },
  },
  {
    id: 'S11',
    capability: 'Live match statistics',
    criteria: [
      'GET /api/matches/:id/stats returns 200 for completed FIFA match',
      'Payload includes matchId and team stat sides',
    ],
    async run() {
      const { status, body } = await fetchJson('/api/matches/m-w26-ga-1v2/stats');
      const d = body?.data;
      const pass =
        status === 200 &&
        d?.matchId === 'm-w26-ga-1v2' &&
        (d?.home != null || d?.homeStats != null || d?.teams != null);
      return {
        pass,
        evidence: { status, keys: d ? Object.keys(d).slice(0, 10) : [] },
      };
    },
  },
  {
    id: 'S12',
    capability: 'Scenario predictions',
    criteria: [
      'GET /api/matches/:id/scenario-predictions returns 200',
      'At least one scenario with baseline rank',
    ],
    async run() {
      const { status, body } = await fetchJson('/api/matches/m-w26-gk-1v2/scenario-predictions');
      const scenarios = body?.data?.scenarios ?? [];
      const hasBaseline = scenarios.some((s) => s.isBaseline || s.scenarioType === 'baseline_expected_flow');
      const pass = status === 200 && scenarios.length >= 1 && hasBaseline;
      return {
        pass,
        evidence: { status, count: scenarios.length, hasBaseline },
      };
    },
  },
  {
    id: 'S13',
    capability: 'Group standings',
    criteria: [
      'GET /api/tournaments/2026/standings returns 200',
      '12 group codes A–L present',
    ],
    async run() {
      const { status, body } = await fetchJson('/api/tournaments/2026/standings');
      const groups = body?.data?.groups ?? {};
      const codes = Object.keys(groups).sort();
      const pass = status === 200 && codes.length === 12 && codes[0] === 'A' && codes[11] === 'L';
      return { pass, evidence: { status, groupCount: codes.length, codes } };
    },
  },
  {
    id: 'S14',
    capability: 'Knockout bracket',
    criteria: ['GET /api/tournaments/2026/bracket returns 200', 'Bracket payload is non-empty'],
    async run() {
      const { status, body } = await fetchJson('/api/tournaments/2026/bracket');
      const data = body?.data;
      const nonEmpty =
        data != null &&
        (Array.isArray(data) ? data.length > 0 : Object.keys(data).length > 0);
      return { pass: status === 200 && nonEmpty, evidence: { status, type: Array.isArray(data) ? 'array' : 'object' } };
    },
  },
  {
    id: 'S15',
    capability: 'News intelligence feed',
    criteria: ['GET /api/news returns 200', 'At least one article in items or hot list'],
    async run() {
      const { status, body } = await fetchJson('/api/news?page=1&pageSize=8');
      const items = body?.data?.items ?? body?.data?.articles ?? [];
      const hot = body?.data?.hot ?? [];
      const pass = status === 200 && (items.length >= 1 || hot.length >= 1);
      return {
        pass,
        evidence: { status, items: items.length, hot: hot.length },
      };
    },
  },
  {
    id: 'S16',
    capability: 'Site discovery (SEO / agents)',
    criteria: [
      'robots.txt references sitemap and blocks /api/admin/',
      'sitemap.xml is valid XML with /matches URLs',
      'api-catalog advertises API anchor',
    ],
    async run() {
      const [robots, sitemap, catalog] = await Promise.all([
        fetch(`${BASE_URL}/robots.txt`).then((r) => r.text()),
        fetch(`${BASE_URL}/sitemap.xml`).then((r) => r.text()),
        fetchJson('/.well-known/api-catalog'),
      ]);
      const pass =
        robots.includes('Sitemap:') &&
        robots.includes('Disallow: /api/admin/') &&
        sitemap.includes('<?xml') &&
        sitemap.includes('/matches/') &&
        catalog.status === 200 &&
        JSON.stringify(catalog.body).includes('/api');
      return {
        pass,
        evidence: {
          robotsOk: robots.includes('Sitemap:'),
          sitemapOk: sitemap.includes('<urlset'),
          catalogStatus: catalog.status,
        },
      };
    },
  },
  {
    id: 'S17',
    capability: 'Public API security',
    criteria: [
      'GET /api/v1/matches without API key returns 401',
      '401 body includes API key hint',
    ],
    async run() {
      const unauth = await fetchJson('/api/v1/matches');
      const hint = JSON.stringify(unauth.body ?? {});
      const pass =
        unauth.status === 401 &&
        hint.toLowerCase().includes('api key');
      return {
        pass,
        evidence: { unauthStatus: unauth.status, body: unauth.body },
      };
    },
  },
  {
    id: 'S18',
    capability: 'Match preview & hints',
    criteria: [
      'GET /api/matches/:id/preview returns 200',
      'GET /api/matches/:id/hints returns 200',
    ],
    async run() {
      const [preview, hints] = await Promise.all([
        fetchJson('/api/matches/m-w26-gk-1v2/preview'),
        fetchJson('/api/matches/m-w26-gk-1v2/hints'),
      ]);
      const pass = preview.status === 200 && hints.status === 200;
      return {
        pass,
        evidence: { previewStatus: preview.status, hintsStatus: hints.status },
      };
    },
  },
  {
    id: 'S19',
    capability: 'SPA shell delivery',
    criteria: [
      'GET / returns 200 HTML',
      'Response includes root mount point for React app',
    ],
    async run() {
      const res = await fetch(`${BASE_URL}/`);
      const html = await res.text();
      const pass = res.status === 200 && html.includes('id="root"');
      return { pass, evidence: { status: res.status, hasRoot: html.includes('id="root"') } };
    },
  },
  {
    id: 'S20',
    capability: 'Unit test suite',
    criteria: ['npm test exits 0', 'Vitest reports zero failures'],
    async run() {
      const result = spawnSync('npm', ['test'], {
        cwd: root,
        encoding: 'utf8',
        shell: false,
      });
      const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
      const pass = result.status === 0 && /Tests\s+\d+\s+passed/.test(output);
      return {
        pass,
        evidence: {
          exitCode: result.status,
          summary: output.match(/Tests\s+.*passed.*/)?.[0] ?? 'no summary',
        },
      };
    },
  },
  {
    id: 'S21',
    capability: 'TypeScript type safety',
    criteria: ['npm run typecheck exits 0'],
    async run() {
      const result = spawnSync('npm', ['run', 'typecheck'], {
        cwd: root,
        encoding: 'utf8',
        shell: false,
      });
      const pass = result.status === 0;
      return {
        pass,
        evidence: {
          exitCode: result.status,
          stderr: (result.stderr ?? '').slice(0, 300) || undefined,
        },
      };
    },
  },
  {
    id: 'S22',
    capability: 'FIFA lineup sync windows',
    criteria: [
      'vitest tests/fifaLineupSync.test.ts passes',
      'Pre-kickoff and live lineup windows behave as expected',
    ],
    async run() {
      const result = spawnSync('npm', ['test', '--', 'tests/fifaLineupSync.test.ts'], {
        cwd: root,
        encoding: 'utf8',
        shell: false,
      });
      const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
      const pass = result.status === 0 && output.includes('passed');
      return {
        pass,
        evidence: {
          exitCode: result.status,
          summary: output.match(/Tests\s+.*passed.*/)?.[0] ?? 'no summary',
        },
      };
    },
  },
];

async function main() {
  const results = [];
  let failed = 0;

  console.log(`PitchIntel capability scenarios`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Started:  ${startedAt}`);
  console.log(`Method:   pass/fail rubric (${SCENARIOS.length} scenarios)\n`);

  for (const scenario of SCENARIOS) {
    const t0 = Date.now();
    let outcome;
    try {
      outcome = await scenario.run();
    } catch (err) {
      outcome = {
        pass: false,
        evidence: { error: String(err) },
      };
    }
    const elapsedMs = Date.now() - t0;
    const record = {
      id: scenario.id,
      capability: scenario.capability,
      criteria: scenario.criteria,
      pass: outcome.pass,
      evidence: outcome.evidence,
      elapsedMs,
    };
    results.push(record);
    if (!outcome.pass) failed += 1;
    const mark = outcome.pass ? 'PASS' : 'FAIL';
    console.log(`${mark}  ${scenario.id}  ${scenario.capability}  (${elapsedMs}ms)`);
    if (!outcome.pass) {
      console.log(`       evidence: ${JSON.stringify(outcome.evidence)}`);
    }
  }

  const finishedAt = new Date().toISOString();
  const report = {
    baseUrl: BASE_URL,
    startedAt,
    finishedAt,
    method: 'pass/fail',
    total: SCENARIOS.length,
    passed: SCENARIOS.length - failed,
    failed,
    results,
  };

  const reportsDir = resolve(root, 'reports');
  mkdirSync(reportsDir, { recursive: true });
  const reportPath = resolve(reportsDir, 'capability-scenarios.json');
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`\nSummary: ${report.passed}/${report.total} passed`);
  console.log(`Report:  ${reportPath}`);

  if (jsonOut) {
    console.log(JSON.stringify(report, null, 2));
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();
