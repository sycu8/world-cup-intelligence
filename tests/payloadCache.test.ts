import { describe, expect, it, vi } from 'vitest';
import { createMockEnv, createMockKv } from './helpers/mockEnv';
import { getCachedJson, getCachedJsonWithVersion } from '../src/services/payloadCache';

describe('payloadCache', () => {
  it('returns cached JSON on KV hit without calling build', async () => {
    const kv = createMockKv({ 'cache:test': JSON.stringify({ ok: true }) });
    const env = createMockEnv({ KV: kv });
    const build = vi.fn(async () => ({ ok: false }));

    const result = await getCachedJson(env, 'cache:test', build, 30);

    expect(result).toEqual({ ok: true });
    expect(build).not.toHaveBeenCalled();
  });

  it('builds, stores, and returns fresh JSON on miss', async () => {
    const kv = createMockKv();
    const env = createMockEnv({ KV: kv });
    const build = vi.fn(async () => ({ value: 42 }));

    const result = await getCachedJson(env, 'cache:miss', build, 10);

    expect(result).toEqual({ value: 42 });
    expect(build).toHaveBeenCalledOnce();
    expect(kv.put).toHaveBeenCalledWith(
      'cache:miss',
      JSON.stringify({ value: 42 }),
      { expirationTtl: 15 },
    );
  });

  it('uses version from last_data_refresh for namespaced cache keys', async () => {
    const kv = createMockKv({ 'meta:last_data_refresh': 'v1' });
    const env = createMockEnv({ KV: kv });
    const build = vi.fn(async () => ({ warm: true }));

    await getCachedJsonWithVersion(env, 'home', build, 60);

    expect(kv.put).toHaveBeenCalledWith(
      'cache:home:v1',
      JSON.stringify({ warm: true }),
      { expirationTtl: 60 },
    );
  });

  it('falls back to last_fifa_sync then cold for version key', async () => {
    const kv = createMockKv({ 'meta:last_fifa_sync': 'fifa-9' });
    const env = createMockEnv({ KV: kv });
    const build = vi.fn(async () => ({ x: 1 }));

    await getCachedJsonWithVersion(env, 'dash', build);

    expect(kv.put).toHaveBeenCalledWith(
      'cache:dash:fifa-9',
      JSON.stringify({ x: 1 }),
      { expirationTtl: 45 },
    );
  });

  it('uses cold version when no refresh metadata exists', async () => {
    const kv = createMockKv();
    const env = createMockEnv({ KV: kv });
    const build = vi.fn(async () => ({ cold: true }));

    await getCachedJsonWithVersion(env, 'standings', build);

    expect(kv.put).toHaveBeenCalledWith(
      'cache:standings:cold',
      JSON.stringify({ cold: true }),
      { expirationTtl: 45 },
    );
  });
});
