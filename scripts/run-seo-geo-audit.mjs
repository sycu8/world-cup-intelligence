/**
 * SEO/GEO audit — crawlability, indexation, intent, titles, links, schema, citations, answer-first.
 *
 * Usage:
 *   node scripts/run-seo-geo-audit.mjs
 *   BASE_URL=https://wcstat.orangecloud.vn node scripts/run-seo-geo-audit.mjs
 *   node scripts/run-seo-geo-audit.mjs --json > reports/seo-geo-audit.json
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = (process.env.BASE_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
const jsonOut = process.argv.includes('--json');

/** Priority Vietnamese queries → canonical landing path */
const TARGET_QUERIES = [
  {
    id: 'Q01',
    query: 'lịch thi đau world cup 2026',
    path: '/lich-thi-dau-world-cup-2026',
    titleNeedle: 'lịch thi đấu',
  },
  {
    id: 'Q02',
    query: 'tỉ số trực tiếp world cup 2026',
    path: '/ti-so-truc-tiep-world-cup-2026',
    titleNeedle: 'trực tiếp',
  },
  {
    id: 'Q03',
    query: 'bảng xếp hạng world cup 2026',
    path: '/bang-xep-hang-world-cup-2026',
    titleNeedle: 'bảng xếp hạng',
  },
  {
    id: 'Q04',
    query: 'kết quả world cup 2026',
    path: '/ket-qua-world-cup-2026',
    titleNeedle: 'kết quả',
  },
  {
    id: 'Q05',
    query: 'dự đoán world cup 2026',
    path: '/du-doan-world-cup-2026',
    titleNeedle: 'dự đoán',
  },
  {
    id: 'Q06',
    query: 'phân tích world cup 2026',
    path: '/phan-tich-world-cup-2026',
    titleNeedle: 'phân tích',
  },
  {
    id: 'Q07',
    query: 'vòng bảng world cup 2026',
    path: '/vong-bang-world-cup-2026',
    titleNeedle: 'vòng bảng',
  },
  {
    id: 'Q08',
    query: 'vòng knockout world cup 2026',
    path: '/vong-knockout-world-cup-2026',
    titleNeedle: 'knockout',
  },
];

const CRAWL_PATHS = [
  '/',
  '/matches',
  '/guide',
  '/news-intelligence',
  '/robots.txt',
  '/sitemap.xml',
  '/llms.txt',
  '/auth.md',
  '/.well-known/openapi.json',
  ...TARGET_QUERIES.map((q) => q.path),
];

function extract(html, re) {
  const m = html.match(re);
  return m?.[1]?.trim() ?? null;
}

function hasJsonLd(html) {
  return /type="application\/ld\+json"/i.test(html);
}

function jsonLdTypes(html) {
  const types = [];
  const re = /"@type"\s*:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) types.push(m[1]);
  return [...new Set(types)];
}

function countInternalLinks(html, origin) {
  const re = new RegExp(`href=["']${origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"']*["']`, 'gi');
  return (html.match(re) ?? []).length;
}

async function fetchText(path) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, { headers: { Accept: 'text/html,application/xml,text/plain,*/*' } });
  const text = await res.text();
  return { url, status: res.status, headers: Object.fromEntries(res.headers.entries()), text };
}

function auditPage(path, { status, text, headers }, origin) {
  const isHtml = text.includes('<html') || text.includes('<!DOCTYPE');
  const gaps = [];

  if (status !== 200) {
    gaps.push({ impact: 'critical', area: 'crawlability', message: `HTTP ${status}` });
    return gaps;
  }

  if (!isHtml) return gaps;

  const title = extract(text, /<title[^>]*>([^<]+)<\/title>/i);
  const description = extract(text, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    ?? extract(text, /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  const canonical = extract(text, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)
    ?? extract(text, /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
  const ogTitle = extract(text, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  const hasNoscriptAnswer = /id="seo-answer"/.test(text);
  const schemaTypes = jsonLdTypes(text);

  if (!title || title.length < 10) {
    gaps.push({ impact: 'high', area: 'titles', message: 'Missing or short title' });
  }
  if (!description || description.length < 40) {
    gaps.push({ impact: 'high', area: 'page intent', message: 'Missing or short meta description' });
  }
  if (!canonical) {
    gaps.push({ impact: 'high', area: 'indexation', message: 'Missing canonical link' });
  } else if (!canonical.startsWith('http://') && !canonical.startsWith('https://')) {
    gaps.push({ impact: 'medium', area: 'indexation', message: 'Canonical is not absolute' });
  }
  if (!ogTitle) {
    gaps.push({ impact: 'medium', area: 'titles', message: 'Missing og:title' });
  }
  if (!hasJsonLd(text)) {
    gaps.push({ impact: 'critical', area: 'structured data', message: 'No JSON-LD' });
  }
  if (path === '/' && !schemaTypes.includes('WebSite')) {
    gaps.push({ impact: 'high', area: 'structured data', message: 'Home missing WebSite schema' });
  }
  if (TARGET_QUERIES.some((q) => q.path === path)) {
    if (!schemaTypes.includes('FAQPage')) {
      gaps.push({ impact: 'high', area: 'structured data', message: 'SEO landing missing FAQPage schema' });
    }
    if (!hasNoscriptAnswer) {
      gaps.push({ impact: 'high', area: 'answer-first', message: 'No answer-first noscript block' });
    }
    const query = TARGET_QUERIES.find((q) => q.path === path);
    if (query && title && !title.toLowerCase().includes(query.titleNeedle.toLowerCase())) {
      gaps.push({ impact: 'high', area: 'page intent', message: `Title missing intent keyword: ${query.titleNeedle}` });
    }
  }
  if (path.startsWith('/matches/') && path.split('/').length === 3) {
    if (!schemaTypes.includes('SportsEvent')) {
      gaps.push({ impact: 'high', area: 'structured data', message: 'Match page missing SportsEvent schema' });
    }
  }
  if (countInternalLinks(text, origin) < 1 && path !== '/') {
    gaps.push({ impact: 'medium', area: 'internal links', message: 'No internal links in initial HTML' });
  }
  if (/noindex/i.test(text)) {
    gaps.push({ impact: 'critical', area: 'indexation', message: 'Page has noindex' });
  }

  const linkHeader = headers.link ?? headers.Link ?? '';
  if (path === '/' && !linkHeader.includes('sitemap')) {
    gaps.push({ impact: 'medium', area: 'crawlability', message: 'Home missing sitemap Link header' });
  }

  return gaps;
}

function auditDiscovery(name, { status, text, headers }) {
  const gaps = [];
  if (status !== 200) {
    gaps.push({ impact: 'critical', area: 'crawlability', message: `${name} HTTP ${status}` });
    return gaps;
  }
  if (name === 'robots.txt') {
    if (!text.includes('Sitemap:')) gaps.push({ impact: 'critical', area: 'crawlability', message: 'robots.txt missing Sitemap' });
    if (!text.includes('GPTBot')) gaps.push({ impact: 'medium', area: 'GEO', message: 'robots.txt missing AI bot rules' });
    if (!text.includes('llms.txt') && !text.includes('Llms-Txt')) {
      gaps.push({ impact: 'high', area: 'GEO', message: 'robots.txt missing llms.txt reference' });
    }
  }
  if (name === 'sitemap.xml') {
    if (!text.includes('<urlset')) gaps.push({ impact: 'critical', area: 'indexation', message: 'Invalid sitemap' });
    for (const q of TARGET_QUERIES) {
      if (!text.includes(q.path)) {
        gaps.push({ impact: 'high', area: 'indexation', message: `Sitemap missing ${q.path}` });
      }
    }
  }
  if (name === 'llms.txt') {
    if (!text.includes('PitchIntel')) gaps.push({ impact: 'high', area: 'GEO', message: 'llms.txt missing site identity' });
    for (const q of TARGET_QUERIES.slice(0, 3)) {
      if (!text.includes(q.path)) {
        gaps.push({ impact: 'medium', area: 'GEO', message: `llms.txt missing ${q.path}` });
      }
    }
    if (!text.includes('FIFA')) gaps.push({ impact: 'medium', area: 'source citations', message: 'llms.txt missing source attribution' });
  }
  if (name === 'auth.md' && !text.includes('agent')) {
    gaps.push({ impact: 'low', area: 'GEO', message: 'auth.md missing agent section' });
  }
  return gaps;
}

function auditQueryMapping(pageAudits) {
  return TARGET_QUERIES.map((q) => {
    const pageGaps = pageAudits.find((p) => p.path === q.path)?.gaps ?? [
      { impact: 'critical', area: 'page intent', message: 'Page not crawled' },
    ];
    const critical = pageGaps.filter((g) => g.impact === 'critical' || g.impact === 'high');
    return {
      ...q,
      pass: critical.length === 0,
      gaps: pageGaps,
    };
  });
}

function rankGaps(allGaps) {
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  const grouped = new Map();
  for (const g of allGaps) {
    const key = `${g.area}::${g.message}`;
    const prev = grouped.get(key);
    if (!prev || order[g.impact] < order[prev.impact]) grouped.set(key, g);
  }
  return [...grouped.values()].sort((a, b) => order[a.impact] - order[b.impact]);
}

async function resolveSampleMatchSlug() {
  try {
    const { status, text } = await fetchText('/sitemap.xml');
    if (status !== 200) return null;
    const m = text.match(/\/matches\/([^<]+)<\/loc>/);
    return m ? `/matches/${m[1]}` : null;
  } catch {
    return null;
  }
}

async function main() {
  const origin = BASE_URL;
  const startedAt = new Date().toISOString();
  const matchPath = await resolveSampleMatchSlug();
  const paths = matchPath ? [...CRAWL_PATHS, matchPath] : CRAWL_PATHS;

  const pageAudits = [];
  const discoveryAudits = [];

  for (const path of paths) {
    try {
      const hit = await fetchText(path);
      if (['/robots.txt', '/sitemap.xml', '/llms.txt', '/auth.md'].includes(path)) {
        discoveryAudits.push({ path, gaps: auditDiscovery(path.slice(1), hit) });
      } else if (path.startsWith('/.well-known')) {
        if (hit.status !== 200) {
          discoveryAudits.push({
            path,
            gaps: [{ impact: 'medium', area: 'GEO', message: `${path} HTTP ${hit.status}` }],
          });
        }
      } else {
        pageAudits.push({ path, gaps: auditPage(path, hit, origin) });
      }
    } catch (e) {
      pageAudits.push({
        path,
        gaps: [{ impact: 'critical', area: 'crawlability', message: String(e) }],
      });
    }
  }

  const queryBenchmark = auditQueryMapping(pageAudits);
  const allGaps = rankGaps([
    ...pageAudits.flatMap((p) => p.gaps.map((g) => ({ ...g, path: p.path }))),
    ...discoveryAudits.flatMap((d) => d.gaps.map((g) => ({ ...g, path: d.path }))),
  ]);

  const criticalCount = allGaps.filter((g) => g.impact === 'critical').length;
  const highCount = allGaps.filter((g) => g.impact === 'high').length;
  const queryPass = queryBenchmark.filter((q) => q.pass).length;
  const pass = criticalCount === 0 && highCount === 0 && queryPass === TARGET_QUERIES.length;

  const report = {
    baseUrl: BASE_URL,
    startedAt,
    finishedAt: new Date().toISOString(),
    pass,
    summary: {
      pagesCrawled: pageAudits.length,
      discoveryChecked: discoveryAudits.length,
      criticalGaps: criticalCount,
      highGaps: highCount,
      queryPass: `${queryPass}/${TARGET_QUERIES.length}`,
    },
    rankedGaps: allGaps,
    queryBenchmark,
    pageAudits,
    discoveryAudits,
  };

  mkdirSync(resolve(root, 'reports'), { recursive: true });
  writeFileSync(resolve(root, 'reports/seo-geo-audit.json'), JSON.stringify(report, null, 2));

  if (jsonOut) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(pass ? 0 : 1);
  }

  console.log('SEO/GEO audit');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Started:  ${startedAt}`);
  console.log('');
  console.log(`Pages crawled: ${pageAudits.length}`);
  console.log(`Priority queries mapped: ${queryPass}/${TARGET_QUERIES.length}`);
  console.log(`Critical gaps: ${criticalCount} | High gaps: ${highCount}`);
  console.log(`Overall: ${pass ? 'PASS' : 'FAIL'}`);
  console.log('');
  if (allGaps.length) {
    console.log('Ranked gaps (by impact):');
    for (const g of allGaps.slice(0, 15)) {
      console.log(`  [${g.impact}] ${g.area} — ${g.message}${g.path ? ` (${g.path})` : ''}`);
    }
  }
  console.log('');
  console.log('Report: reports/seo-geo-audit.json');
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
