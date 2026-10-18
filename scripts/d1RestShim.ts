import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { D1Database, D1PreparedStatement, D1Result } from '@cloudflare/workers-types';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tokenPath = resolve(root, 'cf-deploy.token');

function apiToken(): string {
  if (process.env.CLOUDFLARE_API_TOKEN?.trim()) return process.env.CLOUDFLARE_API_TOKEN.trim();
  if (existsSync(tokenPath)) return readFileSync(tokenPath, 'utf8').trim();
  throw new Error('Missing CLOUDFLARE_API_TOKEN / cf-deploy.token');
}

type QueryResult = {
  success?: boolean;
  results?: unknown[];
  meta?: D1Result['meta'];
};

async function queryD1(
  accountId: string,
  databaseId: string,
  sql: string,
  params: unknown[] = [],
): Promise<QueryResult> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
  const body = JSON.stringify({ sql, params });
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken()}`,
          'Content-Type': 'application/json',
        },
        body,
      });
      const json = (await res.json()) as {
        success: boolean;
        errors?: { message: string }[];
        result?: QueryResult[];
      };
      if (!json.success) {
        throw new Error(json.errors?.map((e) => e.message).join('; ') || `D1 query failed (${res.status})`);
      }
      return json.result?.[0] ?? { success: true, results: [] };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      }
    }
  }

  throw lastError ?? new Error('D1 query failed');
}

class RestPreparedStatement implements D1PreparedStatement {
  constructor(
    private readonly accountId: string,
    private readonly databaseId: string,
    private sql: string,
    private params: unknown[] = [],
  ) {}

  bind(...values: unknown[]): D1PreparedStatement {
    return new RestPreparedStatement(this.accountId, this.databaseId, this.sql, values);
  }

  async first<T = unknown>(colName?: string): Promise<T | null> {
    const row = (await this.all<T>()).results?.[0];
    if (!row) return null;
    if (colName && row && typeof row === 'object') {
      return (row as Record<string, unknown>)[colName] as T;
    }
    return row as T;
  }

  async run(): Promise<D1Result> {
    const result = await queryD1(this.accountId, this.databaseId, this.sql, this.params);
    return {
      success: true,
      meta: result.meta ?? { changes: 0, duration: 0, last_row_id: 0, rows_read: 0, rows_written: 0 },
    };
  }

  async all<T = unknown>(): Promise<{ results: T[] }> {
    const result = await queryD1(this.accountId, this.databaseId, this.sql, this.params);
    return { results: (result.results ?? []) as T[] };
  }

  async raw<T = unknown[]>(): Promise<T[]> {
    const { results } = await this.all();
    return results as T[];
  }
}

export function createD1RestDatabase(accountId: string, databaseId: string): D1Database {
  return {
    prepare(sql: string) {
      return new RestPreparedStatement(accountId, databaseId, sql);
    },
    async batch<T extends D1PreparedStatement>(statements: T[]) {
      const outputs: D1Result[] = [];
      for (const stmt of statements) {
        outputs.push(await (stmt as RestPreparedStatement).run());
      }
      return outputs;
    },
    async exec(sql: string) {
      const result = await queryD1(accountId, databaseId, sql);
      return {
        count: result.results?.length ?? 0,
        duration: result.meta?.duration ?? 0,
      };
    },
  } as D1Database;
}

export const PRODUCTION_D1 = {
  accountId: '4c15704ef706b9c8954cd6f9feb678d8',
  databaseId: '9571e8df-797c-4f45-890b-dbb01174dee3',
} as const;
