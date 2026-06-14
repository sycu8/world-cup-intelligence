import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

const STYLESHEET_LINK =
  /<link\s+rel="stylesheet"[^>]*href="(\/assets\/[^"]+\.css)"[^>]*>\s*/i;

/** Inline extracted app CSS into index.html to avoid render-blocking stylesheet requests. */
export function inlineAppCss(clientOutDir = 'dist/client'): Plugin {
  return {
    name: 'inline-app-css',
    apply: 'build',
    closeBundle: {
      order: 'post',
      handler() {
        const indexPath = path.resolve(clientOutDir, 'index.html');
        if (!fs.existsSync(indexPath)) return;

        const html = fs.readFileSync(indexPath, 'utf8');
        const match = html.match(STYLESHEET_LINK);
        if (!match) return;

        const cssRel = match[1].replace(/^\//, '');
        const cssPath = path.resolve(clientOutDir, cssRel);
        if (!fs.existsSync(cssPath)) return;

        const css = fs.readFileSync(cssPath, 'utf8');
        let out = html.replace(
          match[0],
          `<style id="app-css">${css}</style>\n`,
        );
        // Keep the extracted .css file — lazy chunks still preload it via Vite's CSS map.

        const jsMatch = out.match(
          /<script type="module" crossorigin src="(\/assets\/[^"]+\.js)"><\/script>/,
        );
        if (jsMatch && !out.includes('rel="modulepreload"')) {
          const preload = `<link rel="modulepreload" crossorigin href="${jsMatch[1]}">\n    `;
          out = out.replace(jsMatch[0], `${preload}${jsMatch[0]}`);
        }

        if (!out.includes('rel="preload" href="/api/home"')) {
          out = out.replace(
            '</head>',
            '    <link rel="preload" href="/api/home" as="fetch" crossorigin>\n  </head>',
          );
        }

        fs.writeFileSync(indexPath, out);
      },
    },
  };
}
