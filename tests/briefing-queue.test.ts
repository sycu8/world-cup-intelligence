import { describe, expect, it, vi } from 'vitest';
import { probabilityRoutes } from '../src/routes/probability';
import { BRIEFING_INFLIGHT_TTL_SECONDS, BRIEFING_STALE_MS } from '../src/ai/briefingQueue';
import { fallbackBriefing } from '../src/ai/tacticalBriefing';
import { FIXTURE_MATCH } from './helpers/fixtures';
import { jsonRoute } from './helpers/routeHarness';
import { createRouteTestEnv } from './helpers/mockRouteDb';

const path = `/${FIXTURE_MATCH.id}/tactical-briefing`;

describe('tactical briefing queue', () => {
  it('enqueues once on a cache miss and serves the statistical draft while generating', async () => {
    const send = vi.fn(async () => undefined);
    const env = createRouteTestEnv({
      AI_FALLBACK_MODE: 'false',
      MODEL_QUEUE: { send } as never,
    });

    const first = await jsonRoute<{
      data: { summary: { en: string } };
      generating: boolean;
    }>(probabilityRoutes, path, { env });

    expect(first.res.status).toBe(200);
    expect(first.json.generating).toBe(true);
    expect(first.json.data.summary.en).toContain('statistical model');
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ type: 'ai_briefing', matchId: FIXTURE_MATCH.id });

    const second = await jsonRoute<{ generating: boolean }>(probabilityRoutes, path, { env });
    expect(second.json.generating).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('serves a cached briefing and does not enqueue', async () => {
    const send = vi.fn(async () => undefined);
    const cached = fallbackBriefing({
      matchId: FIXTURE_MATCH.id,
      aiFallback: false,
      probability: { homeWinProb: 0.4, drawProb: 0.3, awayWinProb: 0.3 },
    });
    cached.summary = { vi: 'Ban AI', en: 'AI briefing text' };
    const env = createRouteTestEnv({
      AI_FALLBACK_MODE: 'false',
      MODEL_QUEUE: { send } as never,
    });
    await env.KV.put(`briefing:vi3:${FIXTURE_MATCH.id}`, JSON.stringify(cached));

    const { json } = await jsonRoute<{
      data: { summary: { en: string } };
      generating: boolean;
    }>(probabilityRoutes, path, { env });

    expect(json.generating).toBe(false);
    expect(json.data.summary.en).toBe('AI briefing text');
    expect(send).not.toHaveBeenCalled();
  });

  it('does not enqueue when AI fallback mode is on', async () => {
    const send = vi.fn(async () => undefined);
    const env = createRouteTestEnv({
      AI_FALLBACK_MODE: 'true',
      MODEL_QUEUE: { send } as never,
    });
    const { json } = await jsonRoute<{ generating: boolean }>(probabilityRoutes, path, { env });
    expect(json.generating).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it('enqueues the canonical match id when the page asks by slug', async () => {
    const send = vi.fn(async () => undefined);
    const env = createRouteTestEnv({
      AI_FALLBACK_MODE: 'false',
      MODEL_QUEUE: { send } as never,
    });
    const slug = 'vong-bang-a-mexico-vs-south-africa';

    const first = await jsonRoute<{
      data: { matchId: string; summary: { en: string } };
      generating: boolean;
    }>(probabilityRoutes, `/${slug}/tactical-briefing`, { env });

    expect(first.res.status).toBe(200);
    expect(first.json.generating).toBe(true);
    expect(first.json.data.matchId).toBe(FIXTURE_MATCH.id);
    expect(first.json.data.summary.en).toContain('statistical model');
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ type: 'ai_briefing', matchId: FIXTURE_MATCH.id });
    expect(env.KV.put).toHaveBeenCalledWith(
      `briefing:inflight:${FIXTURE_MATCH.id}`,
      expect.stringMatching(/^1:\d+$/),
      { expirationTtl: BRIEFING_INFLIGHT_TTL_SECONDS },
    );
    expect(BRIEFING_STALE_MS).toBe(150_000);
    expect(BRIEFING_INFLIGHT_TTL_SECONDS).toBeGreaterThan(5 * 120);
    expect(await env.KV.get(`briefing:inflight:${slug}`)).toBeNull();

    const second = await jsonRoute<{ generating: boolean }>(
      probabilityRoutes,
      `/${slug}/tactical-briefing`,
      { env },
    );
    expect(second.json.generating).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('serves the statistical draft without generating after a blank reply is withheld', async () => {
    const send = vi.fn(async () => undefined);
    const env = createRouteTestEnv({
      AI_FALLBACK_MODE: 'false',
      MODEL_QUEUE: { send } as never,
    });
    await env.KV.put(`briefing:inflight:${FIXTURE_MATCH.id}`, 'withheld');

    const { json } = await jsonRoute<{
      data: { summary: { en: string } };
      generating: boolean;
    }>(probabilityRoutes, path, { env });

    expect(json.generating).toBe(false);
    expect(json.data.summary.en).toContain('statistical model');
    expect(send).not.toHaveBeenCalled();
  });

  it.each(['1', `1:${Date.now() - BRIEFING_STALE_MS - 1_000}`])(
    'treats a stuck marker %s as not-ready and queues one retry',
    async (marker) => {
      const send = vi.fn(async () => undefined);
      const env = createRouteTestEnv({
        AI_FALLBACK_MODE: 'false',
        MODEL_QUEUE: { send } as never,
      });
      await env.KV.put(`briefing:inflight:${FIXTURE_MATCH.id}`, marker);

      const { json } = await jsonRoute<{
        generating: boolean;
        briefingStatus: string;
      }>(probabilityRoutes, path, { env });

      expect(json.generating).toBe(false);
      expect(json.briefingStatus).toBe('failed');
      expect(json).not.toMatchObject({ generating: true });
      expect(send).toHaveBeenCalledTimes(1);
      expect(send).toHaveBeenCalledWith({ type: 'ai_briefing', matchId: FIXTURE_MATCH.id });
    },
  );
});
