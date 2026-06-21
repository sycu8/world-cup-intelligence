import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  buildMatchThumbnailSvg,
  getMatchThumbnailPng,
  getMatchThumbnailSvg,
  matchThumbnailPngR2Key,
  matchThumbnailSvgR2Key,
} from '../src/services/matchThumbnail';
import { createMockEnv } from './helpers/mockEnv';
import { matchWithNames } from './helpers/fixtures';
import * as matchRef from '../src/services/matchRef';

vi.mock('../src/services/matchRef', () => ({
  resolveMatchRef: vi.fn(async () => matchWithNames()),
}));

vi.mock('../src/services/matchThumbnailPng', () => ({
  renderMatchSvgToPng: vi.fn(async () => new Uint8Array(700).buffer),
}));

describe('matchThumbnail async helpers', () => {
  it('exposes stable R2 keys', () => {
    expect(matchThumbnailSvgR2Key('m-1')).toBe('match-thumbs/m-1.svg');
    expect(matchThumbnailPngR2Key('m-1')).toBe('match-thumbs/m-1.png');
  });

  it('buildMatchThumbnailSvg renders placeholder flags when slugs missing', () => {
    const svg = buildMatchThumbnailSvg({
      homeName: 'Team Alpha With Very Long Name Here',
      awayName: 'Team Beta',
      status: 'scheduled',
    });
    expect(svg).toContain('?');
    expect(svg).toContain('FIFA World Cup 2026');
  });

  it('getMatchThumbnailSvg returns cached svg from R2', async () => {
    const env = createMockEnv({
      R2_ARTIFACTS: {
        get: vi.fn(async () => ({
          text: async () => '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
        })),
        put: vi.fn(async () => undefined),
      } as never,
    });
    const result = await getMatchThumbnailSvg(env, 'm-w26-ga-1v2');
    expect(result?.svg).toContain('<svg');
    expect(env.R2_ARTIFACTS.put).not.toHaveBeenCalled();
  });

  it('getMatchThumbnailSvg stores fresh svg when cache miss', async () => {
    const put = vi.fn(async () => undefined);
    const env = createMockEnv({
      R2_ARTIFACTS: {
        get: vi.fn(async () => null),
        put,
      } as never,
    });
    const result = await getMatchThumbnailSvg(env, 'm-w26-ga-1v2', { refresh: true });
    expect(result?.svg).toContain('Mexico');
    expect(put).toHaveBeenCalled();
  });

  it('getMatchThumbnailPng returns cached png bytes', async () => {
    const pngBytes = new Uint8Array(600).fill(9);
    const env = createMockEnv({
      R2_ARTIFACTS: {
        get: vi.fn(async (key: string) => {
          if (key.endsWith('.svg')) {
            return { text: async () => '<svg xmlns="http://www.w3.org/2000/svg"></svg>' };
          }
          return { arrayBuffer: async () => pngBytes.buffer };
        }),
        put: vi.fn(async () => undefined),
      } as never,
    });
    const result = await getMatchThumbnailPng(env, 'm-w26-ga-1v2');
    expect(result?.png.byteLength).toBeGreaterThan(500);
  });

  it('getMatchThumbnailPng renders and stores png when cache miss', async () => {
    const put = vi.fn(async () => undefined);
    const env = createMockEnv({
      R2_ARTIFACTS: {
        get: vi.fn(async (key: string) => {
          if (key.endsWith('.svg')) {
            return { text: async () => '<svg xmlns="http://www.w3.org/2000/svg"></svg>' };
          }
          return null;
        }),
        put,
      } as never,
    });
    const result = await getMatchThumbnailPng(env, 'm-w26-ga-1v2', { refresh: true });
    expect(result?.png.byteLength).toBe(700);
    expect(put).toHaveBeenCalled();
  });

  it('getMatchThumbnailSvg returns null when match cannot be resolved', async () => {
    vi.spyOn(matchRef, 'resolveMatchRef').mockResolvedValueOnce(null);
    expect(await getMatchThumbnailSvg(createMockEnv(), 'missing-slug')).toBeNull();
  });

  it('getMatchThumbnailSvg ignores invalid cached svg payloads', async () => {
    vi.spyOn(matchRef, 'resolveMatchRef').mockResolvedValueOnce(matchWithNames());
    const put = vi.fn(async () => undefined);
    const env = createMockEnv({
      R2_ARTIFACTS: {
        get: vi.fn(async () => ({ text: async () => 'not-an-svg' })),
        put,
      } as never,
    });
    const result = await getMatchThumbnailSvg(env, 'm-w26-ga-1v2');
    expect(result?.svg).toContain('Mexico');
    expect(put).toHaveBeenCalled();
  });

  it('getMatchThumbnailPng returns null when png render fails', async () => {
    const { renderMatchSvgToPng } = await import('../src/services/matchThumbnailPng');
    vi.mocked(renderMatchSvgToPng).mockResolvedValueOnce(null);
    vi.spyOn(matchRef, 'resolveMatchRef').mockResolvedValueOnce(matchWithNames());
    const env = createMockEnv({
      R2_ARTIFACTS: {
        get: vi.fn(async () => null),
        put: vi.fn(async () => undefined),
      } as never,
    });
    expect(await getMatchThumbnailPng(env, 'm-w26-ga-1v2', { refresh: true })).toBeNull();
  });
});
