/**
 * Warm production caches by hitting hot endpoints once (populates KV + Workers cache).
 *
 * Usage:
 *   BASE_URL=https://wcstat.orangecloud.vn node scripts/warm-production-caches.mjs
 */
const BASE_URL = (process.env.BASE_URL ?? 'https://wcstat.orangecloud.vn').replace(/\/$/, '');

const PATHS = [
  '/api/health',
  '/api/home',
  '/api/schedule',
  '/api/dashboard',
  '/api/tournaments/2026/standings',
  '/api/matches/m-w26-ga-1v2',
  '/api/matches/m-w26-ga-1v2/probability',
  '/',
  '/matches',
  '/guide',
  '/news-intelligence',
  '/matches/m-w26-ga-1v2',
];

async function warm(path) {
  const res = await fetch(`${BASE_URL}${path}`, { headers: { Accept: '*/*' } });
  return { path, status: res.status };
}

const results = await Promise.all(PATHS.map(warm));
for (const r of results) {
  console.log(`${r.status}\t${r.path}`);
}
