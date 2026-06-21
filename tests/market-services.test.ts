import { describe, expect, it, vi } from 'vitest';
import { ManualMarketInputAdapter } from '../src/market/adapters/ManualMarketInputAdapter';
import { CompliantPublicOddsAdapter } from '../src/market/adapters/CompliantPublicOddsAdapter';
import { LicensedOddsApiAdapter } from '../src/market/adapters/LicensedOddsApiAdapter';
import { getMarketAdapters } from '../src/market/marketSourceRegistry';
import {
  ingestManualMarketInput,
  ingestMatchMarkets,
} from '../src/market/services/marketIngestionService';
import { buildModelVsMarket, getMarketSignalsPayload } from '../src/market/services/marketSignalService';
import { createMockDb, createMockEnv } from './helpers/mockEnv';

vi.mock('../src/market/marketSourceRegistry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/market/marketSourceRegistry')>();
  return {
    ...actual,
    getMarketAdapters: vi.fn(actual.getMarketAdapters),
  };
});

vi.mock('../src/db/repositories/marketRepo', () => ({
  saveMarketOddsBatch: vi.fn(async () => undefined),
  saveMarketSignalAnalysis: vi.fn(async () => 'msa-1'),
  getLatestMarketSignal: vi.fn(async () => null),
  getLatestMarketOdds: vi.fn(async () => [
    {
      selection: 'home',
      normalized_probability: 0.45,
      source_id: 'mkt-manual',
      retrieved_at: '2026-06-01T00:00:00Z',
    },
    {
      selection: 'draw',
      normalized_probability: 0.28,
      source_id: 'mkt-manual',
      retrieved_at: '2026-06-01T00:00:00Z',
    },
    {
      selection: 'away',
      normalized_probability: 0.27,
      source_id: 'mkt-manual',
      retrieved_at: '2026-06-01T00:00:00Z',
    },
  ]),
}));

vi.mock('../src/db/repositories/probabilityRepo', () => ({
  getLatestSnapshot: vi.fn(async () => ({
    home_win_prob: 0.5,
    draw_prob: 0.25,
    away_win_prob: 0.25,
  })),
}));

describe('market adapters', () => {
  it('ManualMarketInputAdapter returns empty fetch by default', async () => {
    const adapter = new ManualMarketInputAdapter();
    expect(adapter.sourceId).toBe('mkt-manual');
    expect(await adapter.fetchMatchMarkets('m-1')).toEqual([]);
  });

  it('CompliantPublicOddsAdapter exposes source metadata', async () => {
    const adapter = new CompliantPublicOddsAdapter('mkt-public');
    expect(adapter.sourceType).toBe('compliant_public_api');
    expect(await adapter.fetchMatchMarkets('m-1')).toEqual([]);
  });

  it('LicensedOddsApiAdapter requires api base URL', async () => {
    const empty = new LicensedOddsApiAdapter('mkt-licensed', null);
    expect(await empty.fetchMatchMarkets('m-1')).toEqual([]);
    const configured = new LicensedOddsApiAdapter('mkt-licensed', 'https://api.example.com');
    expect(await configured.fetchMatchMarkets('m-1')).toEqual([]);
  });
});

describe('getMarketAdapters', () => {
  it('returns manual licensed and public adapters', () => {
    const adapters = getMarketAdapters({});
    expect(adapters.map((a) => a.sourceId)).toEqual(['mkt-manual', 'mkt-licensed', 'mkt-public']);
  });
});

describe('marketIngestionService', () => {
  it('ingestManualMarketInput stores normalized odds', async () => {
    const put = vi.fn(async () => undefined);
    const env = createMockEnv({ R2_RAW: { put } as never });
    const count = await ingestManualMarketInput(env, 'm-1', { home: 2.1, draw: 3.2, away: 3.5 });
    expect(count).toBe(3);
    expect(put).toHaveBeenCalled();
  });

  it('ingestMatchMarkets skips empty adapter results', async () => {
    vi.mocked(getMarketAdapters).mockReturnValueOnce([
      { sourceId: 'empty', fetchMatchMarkets: vi.fn(async () => []) } as never,
    ]);
    const env = createMockEnv({ R2_RAW: { put: vi.fn(async () => undefined) } as never });
    expect(await ingestMatchMarkets(env, 'm-1')).toBe(0);
  });
});

describe('marketSignalService', () => {
  it('buildModelVsMarket computes edge and persists analysis', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        first: () => ({ name: 'Manual', reliability_score: 0.8 }),
      }),
    });
    const result = await buildModelVsMarket(env, 'm-1');
    expect(result?.edge.home).toBeCloseTo(0.05);
    expect(result?.sourceName).toBe('Manual');
  });

  it('getMarketSignalsPayload builds from odds when no cached signal', async () => {
    const payload = await getMarketSignalsPayload(createMockEnv(), 'm-1');
    expect(payload.signals?.matchId).toBe('m-1');
    expect(payload.oddsSnapshots).toHaveLength(3);
    expect(payload.disclaimer).toContain('not betting advice');
  });
});
