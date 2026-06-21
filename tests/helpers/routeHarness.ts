import type { Hono } from 'hono';
import { beforeEach, vi } from 'vitest';
import type { AppEnv } from '../../src/env';
import { createRouteTestEnv } from './mockRouteDb';

const pathCacheStore = new Map<string, Response>();

beforeEach(() => {
  pathCacheStore.clear();
  vi.stubGlobal('caches', {
    default: {
      match: async (req: Request) => pathCacheStore.get(req.url),
      put: async (req: Request, res: Response) => {
        pathCacheStore.set(req.url, res);
      },
    },
  });
});

export const mockExecutionCtx = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
} as unknown as ExecutionContext;

type RouteRequestOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  env?: AppEnv;
};

export async function requestRoute(
  app: Hono<{ Bindings: AppEnv }>,
  path: string,
  options: RouteRequestOptions = {},
) {
  const { method = 'GET', headers = {}, body, env = createRouteTestEnv() } = options;
  const init: RequestInit = { method, headers: { ...headers } };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { ...init.headers, 'Content-Type': 'application/json' };
  }
  return app.request(path, init, env, mockExecutionCtx);
}

export async function jsonRoute<T = unknown>(
  app: Hono<{ Bindings: AppEnv }>,
  path: string,
  options: RouteRequestOptions = {},
) {
  const res = await requestRoute(app, path, options);
  const json = (await res.json()) as T;
  return { res, json };
}
