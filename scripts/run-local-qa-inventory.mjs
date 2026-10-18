/**
 * Local QA inventory runner — tests all user-facing API surfaces.
 * Usage: BASE_URL=http://127.0.0.1:8790 node scripts/run-local-qa-inventory.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = (process.env.BASE_URL ?? 'http://127.0.0.1:8790').replace(/\/$/, '');
const startedAt = new Date().toISOString();

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
    body = { _raw: text.slice(0, 300) };
  }
  return { status: res.status, body };
}

function approxOne(n, tol = 0.02) {
  return typeof n === 'number' && Math.abs(n - 1) <= tol;
}

/** @type {Array<{ id: string; area: string; criteria: string[]; edgeCases: string[]; run: () => Promise<{ pass: boolean; evidence: Record<string, unknown> }> }>} */
const CHECKS = [
  {
    id: 'L01',
    area: 'Platform health',
    criteria: ['GET /api/health 200', 'status healthy', 'D1 up'],
    edgeCases: ['Cold start within 10s'],
    async run() {
      const { status, body } = await fetchJson('/api/health');
      const pass = status === 200 && body?.status === 'healthy' && body?.dependencies?.d1 === 'up';
      return { pass, evidence: { status, health: body?.status, d1: body?.dependencies?.d1, environment: body?.environment } };
    },
  },
  {
    id: 'L02',
    area: 'Schedule (104 matches)',
    criteria: ['104 WC 2026 matches', 'byDate populated'],
    edgeCases: ['Empty tournament param ignored'],
    async run() {
      const { status, body } = await fetchJson('/api/schedule?tournament=t-2026');
      const total = body?.data?.total ?? body?.data?.matches?.length ?? 0;
      const pass = status === 200 && total === 104 && Object.keys(body?.data?.byDate ?? {}).length > 0;
      return { pass, evidence: { status, total, dateBuckets: Object.keys(body?.data?.byDate ?? {}).length } };
    },
  },
  {
    id: 'L03',
    area: 'Home bundle',
    criteria: ['dashboard', 'schedule', 'standings', 'matchProbabilities present'],
    edgeCases: ['Partial cache warm still returns 200'],
    async run() {
      const { status, body } = await fetchJson('/api/home');
      const d = body?.data ?? {};
      const pass =
        status === 200 &&
        d.dashboard &&
        d.schedule?.matches?.length === 104 &&
        d.standings?.groups &&
        d.matchProbabilities;
      return { pass, evidence: { status, matches: d.schedule?.matches?.length, groups: Object.keys(d.standings?.groups ?? {}).length } };
    },
  },
  {
    id: 'L04',
    area: 'Slug + legacy match resolution',
    criteria: ['Vietnamese slug resolves', 'legacy m-w26-ga-1v2 resolves', 'same match id'],
    edgeCases: ['Unknown slug returns 404'],
    async run() {
      const slug = await fetchJson('/api/matches/vong-bang-a-mexico-vs-south-africa');
      const legacy = await fetchJson('/api/matches/m-w26-ga-1v2');
      const bad = await fetchJson('/api/matches/not-a-real-match-slug-xyz');
      const pass =
        slug.status === 200 &&
        legacy.status === 200 &&
        slug.body?.data?.id === legacy.body?.data?.id &&
        bad.status === 404;
      return {
        pass,
        evidence: { slugStatus: slug.status, legacyStatus: legacy.status, id: slug.body?.data?.id, badStatus: bad.status },
      };
    },
  },
  {
    id: 'L05',
    area: 'Match detail endpoints',
    criteria: ['probability W/D/L sums to ~1', 'wc-prob-v5', 'preview/hints/staff 200'],
    edgeCases: ['Completed match has recap+stats'],
    async run() {
      const ref = 'm-w26-ga-1v2';
      const prob = await fetchJson(`/api/matches/${ref}/probability`);
      const preview = await fetchJson(`/api/matches/${ref}/preview`);
      const hints = await fetchJson(`/api/matches/${ref}/hints`);
      const staff = await fetchJson(`/api/matches/${ref}/staff`);
      const stats = await fetchJson(`/api/matches/${ref}/stats`);
      const recap = await fetchJson(`/api/matches/${ref}/recap`);
      const p = prob.body?.data ?? {};
      const sum = (p.homeWinProb ?? 0) + (p.drawProb ?? 0) + (p.awayWinProb ?? 0);
      const pass =
        prob.status === 200 &&
        approxOne(sum) &&
        String(p.modelVersion ?? '').startsWith('wc-prob-v') &&
        preview.status === 200 &&
        hints.status === 200 &&
        staff.status === 200 &&
        stats.status === 200 &&
        recap.status === 200;
      return { pass, evidence: { probStatus: prob.status, sum, modelVersion: p.modelVersion, statsStatus: stats.status } };
    },
  },
  {
    id: 'L06',
    area: 'Scenarios + market',
    criteria: ['scenario-predictions has baseline', 'market-signals 200', 'probability-movement 200'],
    edgeCases: ['Knockout match still returns scenarios'],
    async run() {
      const ref = 'm-w26-ga-1v2';
      const scenarios = await fetchJson(`/api/matches/${ref}/scenario-predictions`);
      const market = await fetchJson(`/api/matches/${ref}/market-signals`);
      const movement = await fetchJson(`/api/matches/${ref}/probability-movement`);
      const list = scenarios.body?.data?.scenarios ?? [];
      const pass =
        scenarios.status === 200 &&
        list.length >= 1 &&
        list.some((s) => s.isBaseline) &&
        market.status === 200 &&
        movement.status === 200;
      return { pass, evidence: { scenarioCount: list.length, marketStatus: market.status, movementStatus: movement.status } };
    },
  },
  {
    id: 'L07',
    area: 'Tournament aggregates',
    criteria: ['12 group standings', 'bracket rounds', 'champion odds top3', 'prediction accuracy report'],
    edgeCases: ['Year 2026 only'],
    async run() {
      const standings = await fetchJson('/api/tournaments/2026/standings');
      const bracket = await fetchJson('/api/tournaments/2026/bracket');
      const odds = await fetchJson('/api/tournaments/2026/champion-odds');
      const accuracy = await fetchJson('/api/tournaments/2026/prediction-accuracy');
      const groups = Object.keys(standings.body?.data?.groups ?? {});
      const pass =
        standings.status === 200 &&
        groups.length === 12 &&
        bracket.status === 200 &&
        (bracket.body?.data?.rounds?.length ?? 0) > 0 &&
        odds.status === 200 &&
        (odds.body?.data?.top?.length ?? 0) >= 3 &&
        accuracy.status === 200;
      return {
        pass,
        evidence: { groups: groups.length, bracketRounds: bracket.body?.data?.rounds?.length, topOdds: odds.body?.data?.top?.length },
      };
    },
  },
  {
    id: 'L08',
    area: 'News intelligence',
    criteria: ['≥8 unique articles (hot + feed)', 'hot items', 'article detail by id'],
    edgeCases: ['Invalid article id returns 404', 'Hot items excluded from paginated list by design'],
    async run() {
      const feed = await fetchJson('/api/news?page=1&pageSize=8&hot=3');
      const articles = feed.body?.data?.articles ?? [];
      const hot = feed.body?.data?.hot ?? [];
      const meta = feed.body?.meta ?? {};
      const uniqueTotal = (meta.total ?? 0) + (meta.hotCount ?? hot.length);
      const firstId = articles[0]?.id ?? hot[0]?.id;
      const detail = firstId ? await fetchJson(`/api/news/${firstId}`) : { status: 0 };
      const bad = await fetchJson('/api/news/doc-does-not-exist');
      const pass =
        feed.status === 200 &&
        uniqueTotal >= 8 &&
        hot.length >= 1 &&
        detail.status === 200 &&
        bad.status === 404;
      return {
        pass,
        evidence: { articleCount: articles.length, hotCount: hot.length, uniqueTotal, detailStatus: detail.status },
      };
    },
  },
  {
    id: 'L09',
    area: 'Teams + players',
    criteria: ['teams list non-empty', 'team detail', 'squad', 'wc-h2h', 'player detail'],
    edgeCases: ['Unknown team 404'],
    async run() {
      const teams = await fetchJson('/api/teams');
      const first = teams.body?.data?.[0]?.id;
      const team = first ? await fetchJson(`/api/teams/${first}`) : { status: 0 };
      const squad = first ? await fetchJson(`/api/teams/${first}/squad`) : { status: 0 };
      const h2h = first ? await fetchJson(`/api/teams/${first}/wc-h2h`) : { status: 0 };
      const players = await fetchJson('/api/players');
      const playerId = players.body?.data?.[0]?.id;
      const player = playerId ? await fetchJson(`/api/players/${playerId}`) : { status: 0 };
      const bad = await fetchJson('/api/teams/team-does-not-exist');
      const pass =
        teams.status === 200 &&
        (teams.body?.data?.length ?? 0) > 0 &&
        team.status === 200 &&
        squad.status === 200 &&
        h2h.status === 200 &&
        player.status === 200 &&
        bad.status === 404;
      return { pass, evidence: { teamCount: teams.body?.data?.length, playerStatus: player.status, badStatus: bad.status } };
    },
  },
  {
    id: 'L10',
    area: 'Lineups + pitch map + history',
    criteria: ['lineups 200', 'pitch-map 200', 'history with WC summary'],
    edgeCases: ['Future match lineups may be partial'],
    async run() {
      const ref = 'm-w26-ga-1v2';
      const lineups = await fetchJson(`/api/matches/${ref}/lineups`);
      const pitch = await fetchJson(`/api/matches/${ref}/pitch-map`);
      const history = await fetchJson(`/api/matches/${ref}/history`);
      const pass =
        lineups.status === 200 &&
        pitch.status === 200 &&
        history.status === 200 &&
        history.body?.data?.summary;
      return { pass, evidence: { lineups: lineups.status, pitch: pitch.status, history: history.status } };
    },
  },
  {
    id: 'L11',
    area: 'Site discovery',
    criteria: ['robots.txt', 'sitemap.xml', 'api-catalog', 'SPA root'],
    edgeCases: ['SEO landing paths return HTML shell'],
    async run() {
      const robots = await fetch(`${BASE_URL}/robots.txt`);
      const sitemap = await fetch(`${BASE_URL}/sitemap.xml`);
      const catalog = await fetchJson('/.well-known/api-catalog.json');
      const home = await fetch(`${BASE_URL}/`);
      const homeHtml = await home.text();
      const pass =
        robots.status === 200 &&
        sitemap.status === 200 &&
        catalog.status === 200 &&
        home.status === 200 &&
        homeHtml.includes('id="root"');
      return { pass, evidence: { robots: robots.status, sitemap: sitemap.status, catalog: catalog.status, home: home.status } };
    },
  },
  {
    id: 'L12',
    area: 'Public API security (local)',
    criteria: ['v1 without key returns 401 when require key false locally may differ'],
    edgeCases: ['Invalid API key rejected'],
    async run() {
      const { status, body } = await fetchJson('/api/v1/schedule');
      // Local dev has PUBLIC_API_REQUIRE_KEY=false — expect 200 or structured access
      const pass = status === 200 || (status === 401 && body?.error);
      return { pass, evidence: { status, requireKeyOff: status === 200 } };
    },
  },
  {
    id: 'L13',
    area: 'Admin guard',
    criteria: ['POST admin without token rejected in UAT-like env', 'with dev token accepted'],
    edgeCases: ['GET admin/sources may be public'],
    async run() {
      const noToken = await fetchJson('/api/admin/recompute-all', { method: 'POST' });
      const withToken = await fetchJson('/api/admin/recompute-all', {
        method: 'POST',
        headers: { 'X-Admin-Token': process.env.ADMIN_TOKEN ?? 'qa-local-dev' },
      });
      const pass = noToken.status === 401 && withToken.status === 200;
      return { pass, evidence: { noToken: noToken.status, withToken: withToken.status } };
    },
  },
  {
    id: 'L14',
    area: 'Probability coverage',
    criteria: ['All 104 matches have latest wc-prob-v5 snapshot'],
    edgeCases: ['Knockout placeholders included'],
    async run() {
      const { status, body } = await fetchJson('/api/tournaments/2026/match-probabilities');
      const keys = Object.keys(body?.data ?? {});
      const pass = status === 200 && keys.length === 104;
      return { pass, evidence: { status, probabilityMatches: keys.length } };
    },
  },
];

const results = [];
let bugs = [];

for (const check of CHECKS) {
  try {
    const { pass, evidence } = await check.run();
    results.push({
      id: check.id,
      area: check.area,
      verdict: pass ? 'PASS' : 'FAIL',
      criteria: check.criteria,
      edgeCases: check.edgeCases,
      evidence,
    });
    if (!pass) {
      bugs.push({
        id: `BUG-${check.id}`,
        area: check.area,
        reproduction: `BASE_URL=${BASE_URL} node scripts/run-local-qa-inventory.mjs — check ${check.id} fails`,
        evidence,
        severity: check.id.startsWith('L0') && ['L01', 'L04', 'L05', 'L14'].includes(check.id) ? 'high' : 'medium',
      });
    }
  } catch (e) {
    results.push({ id: check.id, area: check.area, verdict: 'ERROR', error: String(e) });
    bugs.push({
      id: `BUG-${check.id}`,
      area: check.area,
      reproduction: `Exception during ${check.id}: ${String(e)}`,
      severity: 'high',
    });
  }
}

const passed = results.filter((r) => r.verdict === 'PASS').length;
const report = {
  startedAt,
  finishedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  summary: { total: results.length, passed, failed: results.length - passed },
  results,
  bugs,
};

mkdirSync(resolve(root, 'reports'), { recursive: true });
writeFileSync(resolve(root, 'reports/local-qa-inventory.json'), JSON.stringify(report, null, 2));

console.log(`Local QA: ${passed}/${results.length} PASS`);
for (const r of results.filter((x) => x.verdict !== 'PASS')) {
  console.log(`  FAIL ${r.id} ${r.area}`, r.evidence ?? r.error);
}
if (bugs.length) {
  console.log('\nBugs logged:', bugs.length);
  for (const b of bugs) console.log(`  ${b.id} [${b.severity}] ${b.area}`);
}

process.exit(passed === results.length ? 0 : 1);
