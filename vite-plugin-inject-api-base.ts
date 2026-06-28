import type { Plugin } from 'vite';

/** Replaces <!--VITE_API_BASE--> in index.html (empty on web, production origin on mobile). */
export function injectApiBase(): Plugin {
  return {
    name: 'inject-api-base',
    transformIndexHtml(html) {
      const base = process.env.VITE_API_ORIGIN?.replace(/\/$/, '') ?? '';
      return html.replace('<!--VITE_API_BASE-->', base);
    },
  };
}
