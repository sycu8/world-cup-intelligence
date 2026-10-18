import { describe, expect, it, vi } from 'vitest';
import { warmPayloadCaches } from '../src/services/cacheWarm';
import { createMockEnv, createMockKv } from './helpers/mockEnv';

vi.mock('../src/services/homePayload', () => ({
  buildHomePayloadData: vi.fn(async () => ({ schedule: [], dashboard: {} })),
}));

vi.mock('../src/services/schedulePayload', () => ({
  buildSchedulePayload: vi.fn(async () => ({ data: {}, meta: {} })),
}));

vi.mock('../src/services/dashboardPayload', () => ({
  buildDashboardPayload: vi.fn(async () => ({ matchCount: 0 })),
}));

vi.mock('../src/services/tournamentStandings', () => ({
  buildGroupStandingsPayload: vi.fn(async () => ({ groups: {} })),
}));

vi.mock('../src/services/healthPayload', () => ({
  buildHealthPayload: vi.fn(async () => ({ status: 'healthy' })),
}));

describe('warmPayloadCaches', () => {
  it('pre-warms versioned payload caches and records warm version', async () => {
    const kv = createMockKv({ 'meta:last_data_refresh': 'refresh-1' });
    const env = createMockEnv({ KV: kv });

    await warmPayloadCaches(env);

    expect(kv.put).toHaveBeenCalledWith(
      'cache:warm:version',
      'refresh-1',
      { expirationTtl: 120 },
    );
    expect(kv.put).toHaveBeenCalledWith(
      'cache:home:t-2026:refresh-1',
      expect.any(String),
      { expirationTtl: 60 },
    );
    expect(kv.put).toHaveBeenCalledWith(
      'cache:health:v1',
      JSON.stringify({ status: 'healthy' }),
      { expirationTtl: 15 },
    );
  });

  it('uses fifa sync version when data refresh metadata is absent', async () => {
    const kv = createMockKv({ 'meta:last_fifa_sync': 'fifa-2' });
    const env = createMockEnv({ KV: kv });

    await warmPayloadCaches(env);

    expect(kv.put).toHaveBeenCalledWith('cache:warm:version', 'fifa-2', { expirationTtl: 120 });
  });

  it('uses cold version when no refresh metadata exists', async () => {
    const kv = createMockKv();
    const env = createMockEnv({ KV: kv });

    await warmPayloadCaches(env);

    expect(kv.put).toHaveBeenCalledWith('cache:warm:version', 'cold', { expirationTtl: 120 });
  });
});
