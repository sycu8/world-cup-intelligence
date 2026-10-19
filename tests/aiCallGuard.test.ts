import { describe, expect, it, vi } from 'vitest';
import {
  AI_BACKOFF_KEY,
  aiEnqueueBlocked,
  aiResultCacheKey,
  guardedAiRun,
  isAiCapacityError,
  readAiBudget,
  withAiRun,
} from '../src/ai/aiCallGuard';
import { translateMatchRecapText } from '../src/ai/translateMatchRecap';
import { createMockEnv } from './helpers/mockEnv';

const VI = '{"textVi":"Đội ghi bàn từ pha đá phạt."}';
const LINE = 'The team scores from a corner.';

function aiLogs(spy: { mock: { calls: unknown[][] } }): Array<{ calls?: number; message?: string }> {
  return spy.mock.calls
    .map((call) => String(call[0]))
    .filter((line) => line.includes('"message":"ai calls"'))
    .map((line) => JSON.parse(line) as { calls?: number; message?: string });
}

describe('ai call guard', () => {
  it('reads a positive integer budget and ignores anything else', () => {
    expect(readAiBudget(undefined, 40)).toBe(40);
    expect(readAiBudget('  ', 40)).toBe(40);
    expect(readAiBudget('0', 40)).toBe(40);
    expect(readAiBudget('-3', 40)).toBe(40);
    expect(readAiBudget('8.5', 40)).toBe(40);
    expect(readAiBudget('nope', 40)).toBe(40);
    expect(readAiBudget('12', 40)).toBe(12);
  });

  it('recognises Workers AI capacity errors 3021 and 3040', () => {
    expect(isAiCapacityError(new Error('Workers AI 3040 Capacity temporarily exceeded'))).toBe(true);
    expect(isAiCapacityError('error 3021')).toBe(true);
    expect(isAiCapacityError(new Error('13040 nearby'))).toBe(false);
    expect(isAiCapacityError(new Error('network'))).toBe(false);
  });

  it('keeps a redelivery storm at zero AI calls and reuses the cached line', async () => {
    const run = vi.fn(async () => ({ response: VI }));
    const env = createMockEnv({ AI: { run } as never, AI_CALLS_PER_RUN: '4', AI_CALLS_PER_MINUTE: '4' });
    const logs = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const first = await withAiRun({ runId: 'prime' }, () =>
      translateMatchRecapText(env, LINE, 520, 'shot', 12, { matchId: 'm-1' }),
    );
    expect(first).toContain('Đội');
    expect(run).toHaveBeenCalledTimes(1);

    run.mockClear();
    for (let i = 0; i < 200; i++) {
      const again = await withAiRun(
        { redelivery: true, fromDlq: i % 2 === 0, stale: i % 5 === 0, runId: `storm-${i}` },
        () => translateMatchRecapText(env, LINE, 520, 'shot', 12, { matchId: 'm-1' }),
      );
      expect(again).toContain('Đội');
    }

    expect(run).not.toHaveBeenCalled();
    expect(run.mock.calls.length).toBeLessThanOrEqual(0);
    const counts = aiLogs(logs).map((line) => line.calls ?? 0);
    expect(Math.max(...counts)).toBeLessThanOrEqual(1);
    logs.mockRestore();
  });

  it('stops a fresh run at the per-run budget', async () => {
    const run = vi.fn(async () => ({ response: VI }));
    const env = createMockEnv({ AI: { run } as never, AI_CALLS_PER_RUN: '4', AI_CALLS_PER_MINUTE: '100' });
    const logs = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await withAiRun({ runId: 'budget' }, async () => {
      for (let i = 0; i < 50; i++) {
        await translateMatchRecapText(env, `Corner number ${i} finds the net.`, 520, 'shot', i, {
          matchId: 'm-budget',
        });
      }
    });

    expect(run).toHaveBeenCalledTimes(4);
    expect(run.mock.calls.length).toBeLessThanOrEqual(4);
    const logged = aiLogs(logs).find((line) => line.message === 'ai calls');
    expect(logged?.calls).toBe(4);
    logs.mockRestore();
  });

  it('applies the per-minute cap to the AI Gateway path', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        choices: [{ message: { content: 'ok' } }],
        model: 'gateway-model',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const env = createMockEnv({
      AI_GATEWAY_ENABLED: 'true',
      AI_GATEWAY_ACCOUNT_ID: 'acct',
      OPENAI_API_KEY: 'sk-test',
      AI_CALLS_PER_MINUTE: '1',
    });
    const { gatewayChat } = await import('../src/ai/gatewayClient');

    const first = await gatewayChat(env, 'news_summary', [{ role: 'user', content: 'one' }]);
    const second = await gatewayChat(env, 'news_summary', [{ role: 'user', content: 'two' }]);

    expect(first?.content).toBe('ok');
    expect(second).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('stops later runs at the per-minute budget', async () => {
    const run = vi.fn(async () => ({ response: VI }));
    const env = createMockEnv({ AI: { run } as never, AI_CALLS_PER_RUN: '10', AI_CALLS_PER_MINUTE: '3' });

    for (let i = 0; i < 3; i++) {
      await withAiRun({ runId: `minute-${i}` }, () =>
        translateMatchRecapText(env, `Minute call ${i} finds the net.`, 520, 'shot', i, { matchId: 'm-min' }),
      );
    }
    expect(run).toHaveBeenCalledTimes(3);

    await withAiRun({ runId: 'minute-over' }, () =>
      translateMatchRecapText(env, 'One more attack finds the net.', 520, 'shot', 9, { matchId: 'm-min' }),
    );
    expect(run).toHaveBeenCalledTimes(3);
    expect(run.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it('backs off on 3040 and 3021 and does not call the next model or enqueue', async () => {
    for (const code of ['3040', '3021']) {
      const run = vi.fn(async () => {
        throw new Error(`Workers AI ${code} capacity`);
      });
      const env = createMockEnv({ AI: { run } as never });
      let blocked = false;
      await withAiRun({ runId: `cap-${code}` }, async () => {
        await translateMatchRecapText(env, 'The team scores from a corner.', 520, 'shot', 4, { matchId: 'm-cap' });
        await translateMatchRecapText(env, 'Another attack breaks the line.', 520, 'shot', 5, { matchId: 'm-cap' });
        blocked = aiEnqueueBlocked();
      });
      expect(run).toHaveBeenCalledTimes(1);
      expect(run.mock.calls.length).toBeLessThanOrEqual(1);
      expect(blocked).toBe(true);
      expect(await env.KV.get(AI_BACKOFF_KEY)).toBe(code);

      await withAiRun({ runId: `cap-next-${code}` }, () =>
        translateMatchRecapText(env, 'A third attack is saved.', 520, 'shot', 6, { matchId: 'm-cap' }),
      );
      expect(run).toHaveBeenCalledTimes(1);
    }
  });

  it('still throws a non-capacity error and skips AI when the message is stale or from the DLQ', async () => {
    const run = vi.fn(async () => {
      throw new Error('network down');
    });
    const env = createMockEnv({ AI: { run } as never });
    await expect(
      guardedAiRun(env, '@cf/meta/llama-3.1-8b-instruct-fp8', { max_tokens: 32 }, { source: 'plain' }),
    ).rejects.toThrow('network down');

    run.mockClear();
    await withAiRun({ stale: true, runId: 'stale' }, () =>
      translateMatchRecapText(env, LINE, 520, 'shot', 1, { matchId: 'm-stale' }),
    );
    await withAiRun({ fromDlq: true, runId: 'dlq' }, () =>
      translateMatchRecapText(env, LINE, 520, 'shot', 2, { matchId: 'm-dlq' }),
    );
    expect(run).not.toHaveBeenCalled();
  });

  it('returns a seeded cache entry without calling AI when the KV counter cannot be read', async () => {
    const run = vi.fn(async () => ({ response: VI }));
    const key = aiResultCacheKey('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      matchId: 'm-kv',
      minute: 3,
      source: LINE,
    });
    const env = createMockEnv({
      AI: { run } as never,
      KV: {
        get: vi.fn(async (stored: string) => (stored === key ? JSON.stringify({ response: VI }) : null)),
        put: vi.fn(async () => {
          throw new Error('kv down');
        }),
        delete: vi.fn(async () => undefined),
      } as never,
    });
    const cached = await withAiRun({ redelivery: true, runId: 'kv' }, () =>
      translateMatchRecapText(env, LINE, 520, 'shot', 3, { matchId: 'm-kv' }),
    );
    expect(cached).toContain('Đội');
    expect(run).not.toHaveBeenCalled();

    const broken = createMockEnv({
      AI: { run } as never,
      KV: {
        get: vi.fn(async () => {
          throw new Error('kv down');
        }),
        put: vi.fn(async () => {
          throw new Error('kv down');
        }),
        delete: vi.fn(async () => undefined),
      } as never,
    });
    const live = await guardedAiRun(
      broken,
      '@cf/meta/llama-3.1-8b-instruct-fp8',
      { max_tokens: 32, messages: [] },
      { source: 'still-runs' },
    );
    expect(live).toEqual({ response: VI });
    expect(run).toHaveBeenCalledTimes(1);
  });
});
