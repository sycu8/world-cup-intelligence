import { vi } from 'vitest';
import type { AppEnv } from '../../src/env';

export type MockKvStore = Map<string, string>;

export function createMockKv(initial: Record<string, string> = {}): AppEnv['KV'] {
  const store: MockKvStore = new Map(Object.entries(initial));
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(async () => ({ keys: [], list_complete: true, cacheStatus: null })),
    getWithMetadata: vi.fn(async (key: string) => ({
      value: store.get(key) ?? null,
      metadata: null,
      cacheStatus: null,
    })),
  } as unknown as AppEnv['KV'];
}

type D1Result<T = Record<string, unknown>> = { results?: T[] };

export function createMockDb(handlers: {
  first?: (sql: string, binds: unknown[]) => unknown;
  all?: (sql: string, binds: unknown[]) => D1Result;
  run?: (sql: string, binds: unknown[]) => { success: boolean };
} = {}): AppEnv['DB'] {
  const prepare = vi.fn((sql: string) => {
    const binds: unknown[] = [];
    const stmt = {
      bind: (...args: unknown[]) => {
        binds.push(...args);
        return stmt;
      },
      first: async <T>() => (handlers.first?.(sql, binds) ?? null) as T | null,
      all: async <T>() => (handlers.all?.(sql, binds) ?? { results: [] }) as D1Result<T>,
      run: async () => handlers.run?.(sql, binds) ?? { success: true },
    };
    return stmt;
  });
  return { prepare } as unknown as AppEnv['DB'];
}

export function createMockEnv(overrides: Partial<AppEnv> = {}): AppEnv {
  return {
    KV: createMockKv(),
    DB: createMockDb(),
    R2_RAW: {} as AppEnv['R2_RAW'],
    R2_SNAPSHOTS: {} as AppEnv['R2_SNAPSHOTS'],
    R2_ARTIFACTS: {} as AppEnv['R2_ARTIFACTS'],
    ASSETS: {
      fetch: vi.fn(async () => new Response('<html></html>', { status: 200 })),
    } as unknown as AppEnv['ASSETS'],
    AI: {} as AppEnv['AI'],
    ...overrides,
  } as AppEnv;
}
