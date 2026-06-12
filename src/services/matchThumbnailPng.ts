import { initWasm, Resvg } from '@resvg/resvg-wasm';
import wasmModule from '@resvg/resvg-wasm/index_bg.wasm';
import { logError } from '../utils/logger';
import { MATCH_THUMB_WIDTH } from './matchThumbnail';

let wasmReady: Promise<void> | null = null;

function ensureResvgWasm(): Promise<void> {
  if (!wasmReady) {
    wasmReady = initWasm(wasmModule);
  }
  return wasmReady;
}

type ResvgImageRef = {
  href: string;
};

/** Rasterize match SVG (with remote flag URLs) to PNG for social crawlers. */
export async function renderMatchSvgToPng(svg: string): Promise<ArrayBuffer | null> {
  try {
    await ensureResvgWasm();
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: MATCH_THUMB_WIDTH },
      font: { loadSystemFonts: false },
    });

    const images = resvg.imagesToResolve() as unknown[];
    await Promise.all(
      images.map(async (img) => {
        const href = typeof img === 'string' ? img : (img as ResvgImageRef | undefined)?.href;
        if (typeof href !== 'string' || !href.startsWith('http')) return;
        try {
          const res = await fetch(href, {
            headers: { Accept: 'image/*' },
            signal: AbortSignal.timeout(10_000),
            cf: { cacheTtl: 86_400 },
          } as RequestInit);
          if (!res.ok) return;
          const buffer = new Uint8Array(await res.arrayBuffer());
          if (buffer.byteLength < 32) return;
          resvg.resolveImage(href, buffer);
        } catch {
          /* flag optional */
        }
      }),
    );

    const rendered = resvg.render();
    const png = rendered.asPng();
    rendered.free();
    resvg.free();
    return png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) as ArrayBuffer;
  } catch (e) {
    logError('match thumbnail png render failed', { error: String(e) });
    return null;
  }
}
