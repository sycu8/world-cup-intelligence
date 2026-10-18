import { describe, expect, it, vi, beforeEach } from 'vitest';

const { ResvgMock } = vi.hoisted(() => ({
  ResvgMock: vi.fn(),
}));

vi.mock('@resvg/resvg-wasm/index_bg.wasm', () => ({ default: new Uint8Array([0, 1, 2, 3]) }));

vi.mock('@resvg/resvg-wasm', () => ({
  initWasm: vi.fn(async () => undefined),
  Resvg: ResvgMock,
}));

import { buildMatchThumbnailSvg } from '../src/services/matchThumbnail';
import { renderMatchSvgToPng } from '../src/services/matchThumbnailPng';

function installHappyResvg() {
  ResvgMock.mockImplementation(function MockResvg(this: {
    imagesToResolve: () => string[];
    resolveImage: (_href: string, _buffer: Uint8Array) => void;
    render: () => { asPng: () => Uint8Array; free: () => void };
    free: () => void;
  }) {
    this.imagesToResolve = () => ['https://flagcdn.com/w160/mx.png'];
    this.resolveImage = () => undefined;
    this.render = () => ({
      asPng: () => new Uint8Array(256).fill(7),
      free: () => undefined,
    });
    this.free = () => undefined;
  });
}

describe('matchThumbnailPng', () => {
  beforeEach(() => {
    installHappyResvg();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new Uint8Array(64).fill(1), { status: 200 })),
    );
  });

  it('renderMatchSvgToPng resolves remote flag images', async () => {
    const svg = buildMatchThumbnailSvg({
      homeName: 'Mexico',
      awayName: 'South Africa',
      homeCountryCode: 'MX',
      awayCountryCode: 'ZA',
      status: 'scheduled',
    });
    const png = await renderMatchSvgToPng(svg);
    expect(png).not.toBeNull();
    expect(png!.byteLength).toBeGreaterThan(100);
  });

  it('renderMatchSvgToPng returns null on invalid svg', async () => {
    ResvgMock.mockImplementationOnce(() => {
      throw new Error('bad svg');
    });
    expect(await renderMatchSvgToPng('not-valid-svg')).toBeNull();
  });

  it('renderMatchSvgToPng skips failed remote fetches', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('fail', { status: 404 })));
    const svg = buildMatchThumbnailSvg({
      homeName: 'Mexico',
      awayName: 'South Africa',
      homeCountryCode: 'MX',
      awayCountryCode: 'ZA',
      status: 'scheduled',
    });
    expect(await renderMatchSvgToPng(svg)).not.toBeNull();
  });

  it('renderMatchSvgToPng ignores tiny fetched buffers', async () => {
    installHappyResvg();
    ResvgMock.mockImplementationOnce(function TinyHrefResvg(this: {
      imagesToResolve: () => string[];
      resolveImage: (_href: string, _buffer: Uint8Array) => void;
      render: () => { asPng: () => Uint8Array; free: () => void };
      free: () => void;
    }) {
      this.imagesToResolve = () => ['https://flagcdn.com/w160/mx.png', 'data:image/png;base64,abc'];
      this.resolveImage = () => undefined;
      this.render = () => ({
        asPng: () => new Uint8Array(256).fill(7),
        free: () => undefined,
      });
      this.free = () => undefined;
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(8), { status: 200 })));
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
    expect(await renderMatchSvgToPng(svg)).not.toBeNull();
  });

  it('renderMatchSvgToPng resolves object-shaped hrefs and fetch exceptions', async () => {
    ResvgMock.mockImplementationOnce(function ObjectHrefResvg(this: {
      imagesToResolve: () => { href: string }[];
      resolveImage: (_href: string, _buffer: Uint8Array) => void;
      render: () => { asPng: () => Uint8Array; free: () => void };
      free: () => void;
    }) {
      this.imagesToResolve = () => [{ href: 'https://flagcdn.com/w160/mx.png' }];
      this.resolveImage = () => undefined;
      this.render = () => ({
        asPng: () => new Uint8Array(128).fill(3),
        free: () => undefined,
      });
      this.free = () => undefined;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('flag fetch failed');
      }),
    );
    expect(await renderMatchSvgToPng('<svg xmlns="http://www.w3.org/2000/svg"></svg>')).not.toBeNull();
  });
});
