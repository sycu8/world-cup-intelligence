import type { AppEnv } from '../env';

const DEFAULT_TTL_SEC = 45;

export async function getCachedJson<T>(
  env: AppEnv,
  key: string,
  build: () => Promise<T>,
  ttlSec = DEFAULT_TTL_SEC,
): Promise<T> {
  const hit = await env.KV.get(key);
  if (hit) return JSON.parse(hit) as T;

  const value = await build();
  await env.KV.put(key, JSON.stringify(value), {
    expirationTtl: Math.max(15, ttlSec),
  });
  return value;
}

export async function getCachedJsonWithVersion<T>(
  env: AppEnv,
  namespace: string,
  build: () => Promise<T>,
  ttlSec = DEFAULT_TTL_SEC,
): Promise<T> {
  const version =
    (await env.KV.get('meta:last_data_refresh')) ??
    (await env.KV.get('meta:last_fifa_sync')) ??
    'cold';
  const key = `cache:${namespace}:${version}`;
  return getCachedJson(env, key, build, ttlSec);
}
