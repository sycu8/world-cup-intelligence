import { logError } from '../utils/logger';

/**
 * Shared counters and the DLQ replay cursor.
 * One KV key accepts about one write per second, so a batch that rewrites the
 * same key keeps a single update. These rows are D1 upserts. The in-isolate
 * map is only the fallback when D1 does not return a number (tests, or D1 down).
 */
export const PIPELINE_COUNTERS_SQL = `CREATE TABLE IF NOT EXISTS pipeline_counters (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL
)`;

const localCounters = new WeakMap<object, Map<string, number>>();

type CounterEnv = {
  DB: {
    prepare(sql: string): {
      bind(...args: unknown[]): {
        first<T>(): Promise<T | null>;
        run(): Promise<unknown>;
      };
      run(): Promise<unknown>;
    };
  };
  KV: {
    get(key: string): Promise<string | null>;
    put(key: string, value: string): Promise<unknown>;
  };
};

function localMap(env: object): Map<string, number> {
  let map = localCounters.get(env);
  if (!map) {
    map = new Map();
    localCounters.set(env, map);
  }
  return map;
}

async function ensureTable(env: CounterEnv): Promise<void> {
  await env.DB.prepare(PIPELINE_COUNTERS_SQL).run();
}

function numeric(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Add `delta` once. Ten calls return ten, including when KV keeps only the first write. */
export async function addPipelineCounter(env: CounterEnv, key: string, delta: number): Promise<number> {
  if (!Number.isFinite(delta) || delta === 0) return readPipelineCounter(env, key);
  try {
    await ensureTable(env);
    const row = await env.DB.prepare(
      `INSERT INTO pipeline_counters (key, value) VALUES (?1, ?2)
       ON CONFLICT(key) DO UPDATE SET value = pipeline_counters.value + ?2
       RETURNING value`,
    )
      .bind(key, delta)
      .first<{ value: number }>();
    const value = numeric(row?.value);
    if (value != null) {
      localMap(env).set(key, value);
      return value;
    }
  } catch (error) {
    logError('pipeline counter failed', { key, error: String(error) });
  }
  const map = localMap(env);
  const next = (map.get(key) ?? (await readKv(env, key))) + delta;
  map.set(key, next);
  try {
    await env.KV.put(key, String(next));
  } catch (error) {
    logError('pipeline counter kv failed', { key, error: String(error) });
  }
  return next;
}

export async function readPipelineCounter(env: CounterEnv, key: string): Promise<number> {
  try {
    const row = await env.DB.prepare(`SELECT value FROM pipeline_counters WHERE key = ?`).bind(key).first<{
      value: number;
    }>();
    const value = numeric(row?.value);
    if (value != null) return value;
  } catch (error) {
    logError('pipeline counter read failed', { key, error: String(error) });
  }
  const local = localCounters.get(env)?.get(key);
  if (local != null) return local;
  return readKv(env, key);
}

async function readKv(env: CounterEnv, key: string): Promise<number> {
  try {
    const raw = await env.KV.get(key);
    const value = Number.parseInt(raw ?? '0', 10);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

/** Absolute cursor write. A failed send must not call this. */
export async function writePipelineCounter(env: CounterEnv, key: string, value: number): Promise<void> {
  try {
    await ensureTable(env);
    const row = await env.DB.prepare(
      `INSERT INTO pipeline_counters (key, value) VALUES (?1, ?2)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value
       WHERE excluded.value > pipeline_counters.value
       RETURNING value`,
    )
      .bind(key, value)
      .first<{ value: number }>();
    const stored = numeric(row?.value);
    if (stored != null) {
      localMap(env).set(key, stored);
      return;
    }
  } catch (error) {
    logError('pipeline counter write failed', { key, error: String(error) });
  }
  const map = localMap(env);
  const current = map.get(key) ?? 0;
  if (value > current) map.set(key, value);
}
