import { logError } from '../utils/logger';

/**
 * Shared counters and the DLQ replay cursor.
 * One KV key accepts about one write per second, so a batch that rewrites the
 * same key keeps a single update. These rows are D1 upserts. KV is only the
 * cutover seed and the last cursor that D1 accepted. A D1 error leaves that
 * last good value in place.
 */
export const PIPELINE_COUNTERS_SQL = `CREATE TABLE IF NOT EXISTS pipeline_counters (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL
)`;

/** Insert `seed + delta` once. A conflicting writer adds only `delta`. */
export const PIPELINE_COUNTER_UPSERT_SQL = `INSERT INTO pipeline_counters (key, value) VALUES (?, ?)
 ON CONFLICT(key) DO UPDATE SET value = pipeline_counters.value + ?
 RETURNING value`;

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

async function readKv(env: CounterEnv, key: string): Promise<number> {
  try {
    const raw = await env.KV.get(key);
    const value = Number.parseInt(raw ?? '0', 10);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

/** In-isolate only. Does not write D1 or KV. */
export function rememberPipelineCounter(env: object, key: string, value: number): void {
  if (!Number.isFinite(value)) return;
  const map = localMap(env);
  const current = map.get(key);
  if (current == null || value > current) map.set(key, value);
}

function remembered(env: object, key: string): number | null {
  const value = localCounters.get(env)?.get(key);
  return value == null ? null : value;
}

async function selectValue(env: CounterEnv, key: string): Promise<number | null> {
  const row = await env.DB.prepare(`SELECT value FROM pipeline_counters WHERE key = ?`).bind(key).first<{
    value: number;
  }>();
  return numeric(row?.value);
}

/**
 * Add `delta` once. The first D1 row copies the old KV value, then later adds
 * do not read that KV key again.
 */
export async function addPipelineCounter(env: CounterEnv, key: string, delta: number): Promise<number> {
  if (!Number.isFinite(delta) || delta === 0) return readPipelineCounter(env, key);
  try {
    await ensureTable(env);
    const existing = await selectValue(env, key);
    const seed = existing == null ? await readKv(env, key) : 0;
    const insertValue = existing == null ? seed + delta : delta;
    const row = await env.DB.prepare(PIPELINE_COUNTER_UPSERT_SQL)
      .bind(key, insertValue, delta)
      .first<{ value: number }>();
    const value = numeric(row?.value);
    if (value != null) {
      localMap(env).set(key, value);
      return value;
    }
  } catch (error) {
    logError('pipeline counter failed', { key, error: String(error) });
    const kept = remembered(env, key);
    if (kept != null) return kept;
    const seeded = await readKv(env, key);
    const next = seeded + delta;
    localMap(env).set(key, next);
    return next;
  }
  const map = localMap(env);
  const base = map.get(key);
  const next = (base ?? (await readKv(env, key))) + delta;
  map.set(key, next);
  return next;
}

/** Read D1. A failed read returns the last value this isolate stored, then KV. */
export async function readPipelineCounter(env: CounterEnv, key: string, backupKey = key): Promise<number> {
  try {
    await ensureTable(env);
    const value = await selectValue(env, key);
    if (value != null) {
      localMap(env).set(key, value);
      return value;
    }
  } catch (error) {
    logError('pipeline counter read failed', { key, error: String(error) });
    const kept = remembered(env, key);
    if (kept != null) return kept;
    return readKv(env, backupKey);
  }
  const local = remembered(env, key);
  if (local != null) return local;
  const seeded = await readKv(env, backupKey);
  if (seeded > 0 && backupKey !== key) {
    await writePipelineCounter(env, key, seeded, backupKey);
    return remembered(env, key) ?? seeded;
  }
  if (seeded > 0) {
    try {
      await env.DB.prepare(
        `INSERT INTO pipeline_counters (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING`,
      )
        .bind(key, seeded)
        .run();
      const stored = await selectValue(env, key);
      if (stored != null) {
        localMap(env).set(key, stored);
        return stored;
      }
    } catch (error) {
      logError('pipeline counter seed failed', { key, error: String(error) });
    }
    localMap(env).set(key, seeded);
    return seeded;
  }
  return 0;
}

/**
 * Absolute cursor write. Returns false when D1 throws, and does not replace
 * the last good value with zero.
 */
export async function writePipelineCounter(
  env: CounterEnv,
  key: string,
  value: number,
  backupKey?: string,
): Promise<boolean> {
  if (!Number.isFinite(value)) return false;
  try {
    await ensureTable(env);
    const row = await env.DB.prepare(
      `INSERT INTO pipeline_counters (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value
       WHERE excluded.value > pipeline_counters.value
       RETURNING value`,
    )
      .bind(key, value)
      .first<{ value: number }>();
    const stored = numeric(row?.value);
    if (stored != null) {
      localMap(env).set(key, stored);
      if (backupKey) {
        try {
          await env.KV.put(backupKey, String(stored));
        } catch (error) {
          logError('pipeline counter backup failed', { key, error: String(error) });
        }
      }
      return true;
    }
  } catch (error) {
    logError('pipeline counter write failed', { key, error: String(error) });
    return false;
  }
  const map = localMap(env);
  const current = map.get(key) ?? 0;
  if (value > current) map.set(key, value);
  return true;
}
