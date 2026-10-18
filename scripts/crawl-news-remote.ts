/**
 * Crawl World Cup news against remote D1 (no admin token).
 * Usage: npx tsx scripts/crawl-news-remote.ts [--production]
 */
import { getPlatformProxy } from 'wrangler';
import type { AppEnv } from '../src/env';
import { crawlWorldCupNews } from '../src/ingestion/newsCrawler';

const production = process.argv.includes('--production');

const { env, dispose } = await getPlatformProxy<AppEnv>({
  configPath: './wrangler.jsonc',
  persist: false,
  remoteBindings: true,
  ...(production ? { environment: 'production' } : {}),
});

try {
  console.log(`Starting news crawl (${production ? 'production' : 'uat'})...`);
  const inserted = await crawlWorldCupNews(env);
  console.log(JSON.stringify({ inserted, environment: production ? 'production' : 'uat' }, null, 2));
} finally {
  await dispose();
}
