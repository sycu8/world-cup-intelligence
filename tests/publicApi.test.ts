import { describe, it, expect, vi } from 'vitest';
import { sha256Hex, hmacSha256Hex, generateApiKey } from '../src/services/publicApi/crypto';
import { PUBLIC_API_EVENT_TYPES } from '../src/services/publicApi/types';
import { hashApiKey, publicApiKeyRequired, resolveApiKey } from '../src/services/publicApi/apiKey';
import { createApiClient, listApiClients, revokeApiClient } from '../src/services/publicApi/clients';
import { appendFeedEvent, getLatestFeedCursor, queryFeed } from '../src/services/publicApi/feed';
import {
  createWebhook,
  deleteWebhook,
  deliverWebhook,
  enqueueWebhookDeliveries,
  listWebhooks,
} from '../src/services/publicApi/webhooks';
import {
  emitMatchCommentaryUpdated,
  emitMatchCompleted,
  emitMatchEventsUpdated,
  emitMatchScoreUpdate,
  emitMatchStatsUpdated,
  emitMatchStatusChange,
} from '../src/services/publicApi/emitter';
import { createMockDb, createMockEnv } from './helpers/mockEnv';
import { FIXTURE_MATCH } from './helpers/fixtures';

describe('publicApi crypto', () => {
  it('generates pi_live_ API keys', () => {
    const key = generateApiKey();
    expect(key.startsWith('pi_live_')).toBe(true);
    expect(key.length).toBeGreaterThan(20);
  });

  it('hashes and signs consistently', async () => {
    const hash = await sha256Hex('test-key');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    const sig = await hmacSha256Hex('secret', '{"a":1}');
    expect(sig).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('publicApi event types', () => {
  it('defines match update events', () => {
    expect(PUBLIC_API_EVENT_TYPES).toContain('match.score_updated');
    expect(PUBLIC_API_EVENT_TYPES).toContain('match.commentary_updated');
    expect(PUBLIC_API_EVENT_TYPES.length).toBeGreaterThanOrEqual(6);
  });
});

describe('publicApi apiKey', () => {
  it('resolves enabled client from pi_live_ key', async () => {
    const apiKey = generateApiKey();
    const hash = await hashApiKey(apiKey);
    const env = createMockEnv({
      DB: createMockDb({
        first: () => ({ id: 'client-1', name: 'Partner', enabled: 1, created_at: '2026-01-01T00:00:00Z' }),
      }),
    });
    const auth = await resolveApiKey(env, apiKey);
    expect(auth?.client.name).toBe('Partner');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('publicApiKeyRequired reads env flag', () => {
    expect(publicApiKeyRequired(createMockEnv({ PUBLIC_API_REQUIRE_KEY: 'true' }))).toBe(true);
    expect(publicApiKeyRequired(createMockEnv())).toBe(false);
  });
});

describe('publicApi clients', () => {
  it('creates, lists, and revokes API clients', async () => {
    const clients: Array<{ id: string; name: string; enabled: number; created_at: string }> = [];
    const env = createMockEnv({
      DB: createMockDb({
        run: () => ({ success: true, meta: { changes: 1 } }),
        all: () => ({ results: clients }),
      }),
    });

    const created = await createApiClient(env, 'Test Client');
    clients.push({
      id: created.client.id,
      name: created.client.name,
      enabled: 1,
      created_at: created.client.createdAt,
    });
    expect(created.apiKey.startsWith('pi_live_')).toBe(true);

    const listed = await listApiClients(env);
    expect(listed).toHaveLength(1);

    const revoked = await revokeApiClient(env, created.client.id);
    expect(revoked).toBe(true);
  });
});

describe('publicApi feed', () => {
  it('appendFeedEvent inserts and returns event', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        run: () => ({ success: true, meta: { last_row_id: 42 } }),
      }),
    });
    const event = await appendFeedEvent(env, 'match.score_updated', FIXTURE_MATCH.id, { homeScore: 1 });
    expect(event?.id).toBe(42);
    expect(event?.type).toBe('match.score_updated');
  });

  it('queryFeed paginates with cursor and filters', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        all: () => ({
          results: [
            {
              id: 2,
              event_type: 'match.score_updated',
              match_id: FIXTURE_MATCH.id,
              payload_json: '{"homeScore":1}',
              created_at: '2026-01-01T12:00:00Z',
            },
          ],
        }),
        first: () => ({ max_id: 2 }),
      }),
    });
    const page = await queryFeed(env, { cursor: 0, matchId: FIXTURE_MATCH.id, types: ['match.score_updated'] });
    expect(page.events).toHaveLength(1);
    expect(await getLatestFeedCursor(env)).toBe(2);
  });
});

describe('publicApi webhooks', () => {
  it('creates and lists webhook subscriptions', async () => {
    const rows: Array<{
      id: string;
      client_id: string;
      url: string;
      events_json: string;
      enabled: number;
      created_at: string;
    }> = [];
    const env = createMockEnv({
      DB: createMockDb({
        run: () => ({ success: true, meta: { changes: 1 } }),
        all: () => ({ results: rows }),
      }),
    });

    const { subscription, secret } = await createWebhook(env, 'client-1', 'https://hook.example.com', [
      'match.score_updated',
    ]);
    rows.push({
      id: subscription.id,
      client_id: subscription.clientId,
      url: subscription.url,
      events_json: JSON.stringify(subscription.events),
      enabled: 1,
      created_at: subscription.createdAt,
    });
    expect(secret.startsWith('whsec_')).toBe(true);
    expect(await listWebhooks(env, 'client-1')).toHaveLength(1);
  });

  it('enqueueWebhookDeliveries sends ingest queue messages', async () => {
    const send = vi.fn(async () => undefined);
    const env = createMockEnv({
      INGEST_QUEUE: { send } as never,
      DB: createMockDb({
        all: () => ({
          results: [
            {
              id: 'wh-1',
              client_id: 'client-1',
              url: 'https://hook.example.com',
              secret: 'whsec_test',
              events_json: '["*"]',
            },
          ],
        }),
      }),
    });
    await enqueueWebhookDeliveries(env, {
      id: 9,
      type: 'match.score_updated',
      matchId: FIXTURE_MATCH.id,
      createdAt: '2026-01-01T00:00:00Z',
      data: { homeScore: 1 },
    });
    expect(send).toHaveBeenCalled();
  });

  it('deliverWebhook posts signed payload to subscriber URL', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('ok', { status: 200 })),
    );
    const env = createMockEnv({
      DB: createMockDb({
        first: (sql) => {
          if (sql.includes('api_webhook_subscriptions')) {
            return { id: 'wh-1', url: 'https://hook.example.com', secret: 'whsec_test', enabled: 1 };
          }
          if (sql.includes('api_feed_events')) {
            return {
              id: 7,
              event_type: 'match.score_updated',
              match_id: FIXTURE_MATCH.id,
              payload_json: '{"homeScore":2}',
              created_at: '2026-01-01T00:00:00Z',
            };
          }
          return null;
        },
      }),
    });
    const result = await deliverWebhook(env, 'wh-1', 7);
    expect(result.ok).toBe(true);
  });

  it('deleteWebhook removes subscription row', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        run: () => ({ success: true, meta: { changes: 1 } }),
      }),
    });
    expect(await deleteWebhook(env, 'client-1', 'wh-1')).toBe(true);
  });
});

describe('publicApi emitter', () => {
  it('emitMatchScoreUpdate appends feed event', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        run: () => ({ success: true, meta: { last_row_id: 1 } }),
      }),
      INGEST_QUEUE: { send: vi.fn(async () => undefined) } as never,
    });
    await emitMatchScoreUpdate(env, {
      matchId: FIXTURE_MATCH.id,
      slug: 'custom-slug',
      homeName: 'Mexico',
      awayName: 'South Africa',
      stage: 'Group',
      groupCode: 'A',
      status: 'live',
      minute: 55,
      homeScore: 1,
      awayScore: 0,
      updatedAt: '2026-01-01T00:00:00Z',
    });
    await emitMatchScoreUpdate(env, {
      matchId: FIXTURE_MATCH.id,
      homeName: 'Mexico',
      awayName: 'South Africa',
      stage: null,
      groupCode: null,
      status: 'live',
      minute: 55,
      homeScore: 1,
      awayScore: 0,
      updatedAt: '2026-01-01T00:00:00Z',
    });
    await emitMatchStatusChange(env, {
      matchId: FIXTURE_MATCH.id,
      status: 'live',
      minute: 55,
      homeScore: 1,
      awayScore: 0,
      updatedAt: '2026-01-01T00:00:00Z',
    });
    await emitMatchCompleted(env, {
      matchId: FIXTURE_MATCH.id,
      status: 'completed',
      minute: 90,
      homeScore: 2,
      awayScore: 1,
      updatedAt: '2026-01-01T02:00:00Z',
    });
    await emitMatchStatsUpdated(env, FIXTURE_MATCH.id, {
      matchId: FIXTURE_MATCH.id,
      updatedAt: '2026-01-01T00:00:00Z',
      dataSource: 'fifa_live',
    });
    await emitMatchCommentaryUpdated(env, FIXTURE_MATCH.id, {
      matchId: FIXTURE_MATCH.id,
      lineCount: 12,
      updatedAt: '2026-01-01T00:00:00Z',
    });
    await emitMatchEventsUpdated(env, FIXTURE_MATCH.id, {
      matchId: FIXTURE_MATCH.id,
      eventCount: 8,
      updatedAt: '2026-01-01T00:00:00Z',
    });
  });
});
