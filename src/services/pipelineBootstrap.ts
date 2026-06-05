import type { AppEnv } from '../env';
import type { IngestJob } from '../queues/types';

/** Enqueue refresh if stale — never block read APIs on heavy inline recompute. */
export async function ensurePipelineFresh(env: AppEnv, maxAgeSec = 90): Promise<void> {
  const last = await env.KV.get('meta:last_data_refresh');
  if (last) {
    const age = (Date.now() - new Date(last).getTime()) / 1000;
    if (age < maxAgeSec) return;
  }

  const lock = await env.KV.get('meta:refresh_lock');
  if (lock) return;

  await env.KV.put('meta:refresh_lock', '1', { expirationTtl: 45 });

  if (env.INGEST_QUEUE) {
    const job: IngestJob = { type: 'refresh_minute', idempotencyKey: crypto.randomUUID() };
    await env.INGEST_QUEUE.send(job);
  }
}
