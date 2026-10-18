import type { AppEnv } from '../env';
import { buildHomePayloadData } from './homePayload';
import { buildDashboardPayload } from './dashboardPayload';
import { buildSchedulePayload } from './schedulePayload';
import { buildGroupStandingsPayload } from './tournamentStandings';
import { getCachedJson, getCachedJsonWithVersion } from './payloadCache';
import { buildHealthPayload } from './healthPayload';

/** Pre-warm KV caches after data refresh so hot paths stay under budget. */
export async function warmPayloadCaches(env: AppEnv): Promise<void> {
  const version =
    (await env.KV.get('meta:last_data_refresh')) ??
    (await env.KV.get('meta:last_fifa_sync')) ??
    'cold';

  await Promise.allSettled([
    getCachedJsonWithVersion(env, 'home:t-2026', () => buildHomePayloadData(env), 60),
    getCachedJsonWithVersion(env, 'schedule:t-2026', () => buildSchedulePayload(env, 't-2026'), 60),
    getCachedJsonWithVersion(env, 'dashboard', () => buildDashboardPayload(env), 60),
    getCachedJsonWithVersion(env, 'standings', () => buildGroupStandingsPayload(env), 60),
    getCachedJson(env, 'cache:health:v1', () => buildHealthPayload(env), 15),
    env.KV.put('cache:warm:version', version, { expirationTtl: 120 }),
  ]);
}
