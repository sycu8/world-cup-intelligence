import type { AppEnv } from '../../src/env';
import { hashApiKey } from '../../src/services/publicApi/apiKey';
import { createMockDb } from './mockEnv';
import { createRouteTestEnv } from './mockRouteDb';

export const ADMIN_TOKEN = 'test-admin-token';
export const TEST_API_KEY = 'pi_live_test_key_for_route_tests_1234567890';

export function adminHeaders(token = ADMIN_TOKEN): Record<string, string> {
  return { 'X-Admin-Token': token };
}

export function adminEnv(overrides: Partial<AppEnv> = {}): AppEnv {
  return createRouteTestEnv({
    ENVIRONMENT: 'production',
    ADMIN_TOKEN,
    ...overrides,
  });
}

export async function publicApiAuthEnv(overrides: Partial<AppEnv> = {}): Promise<AppEnv> {
  const hash = await hashApiKey(TEST_API_KEY);
  const clients: Array<{ id: string; name: string; api_key_hash: string; enabled: number; created_at: string }> =
    [
      {
        id: 'client-route-test',
        name: 'Route Test Client',
        api_key_hash: hash,
        enabled: 1,
        created_at: '2026-01-01T00:00:00Z',
      },
    ];
  const webhooks: Array<{
    id: string;
    client_id: string;
    url: string;
    secret: string;
    events_json: string;
    enabled: number;
    created_at: string;
  }> = [];

  return createRouteTestEnv({
    PUBLIC_API_REQUIRE_KEY: 'false',
    DB: createMockDb({
      first: (sql, binds) => {
        if (sql.includes('FROM api_clients WHERE api_key_hash')) {
          const row = clients.find((c) => c.api_key_hash === binds[0]);
          return row
            ? { id: row.id, name: row.name, enabled: row.enabled, created_at: row.created_at }
            : null;
        }
        if (sql.includes('FROM api_webhook_subscriptions WHERE id = ?')) {
          return webhooks.find((w) => w.id === binds[0]) ?? null;
        }
        return null;
      },
      all: (sql, binds) => {
        if (sql.includes('FROM api_webhook_subscriptions WHERE client_id')) {
          return {
            results: webhooks.filter((w) => w.client_id === binds[0]),
          };
        }
        if (sql.includes('FROM api_clients ORDER BY')) {
          return {
            results: clients.map(({ id, name, enabled, created_at }) => ({
              id,
              name,
              enabled,
              created_at,
            })),
          };
        }
        return { results: [] };
      },
      run: (sql, binds) => {
        if (sql.includes('INSERT INTO api_webhook_subscriptions')) {
          webhooks.push({
            id: 'wh-test-1',
            client_id: 'client-route-test',
            url: 'https://hook.example.com/events',
            secret: 'whsec_test',
            events_json: '["*"]',
            enabled: 1,
            created_at: '2026-01-01T00:00:00Z',
          });
        }
        if (sql.includes('DELETE FROM api_webhook_subscriptions')) {
          const idx = webhooks.findIndex((w) => w.id === binds[0]);
          if (idx >= 0) {
            webhooks.splice(idx, 1);
            return { success: true, meta: { changes: 1, last_row_id: 99 } };
          }
          return { success: true, meta: { changes: 0, last_row_id: 99 } };
        }
        if (sql.includes('UPDATE api_clients SET enabled = 0')) {
          const client = clients.find((c) => c.id === binds[0]);
          if (client) client.enabled = 0;
        }
        return { success: true, meta: { changes: 1, last_row_id: 99 } };
      },
    }),
    ...overrides,
  });
}

export function apiKeyHeaders(key = TEST_API_KEY): Record<string, string> {
  return { 'X-API-Key': key };
}
