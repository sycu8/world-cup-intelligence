import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { injectApiBase } from './vite-plugin-inject-api-base';
import { inlineAppCss } from './vite-plugin-inline-app-css';

const PRODUCTION_ORIGIN = 'https://wcstat.orangecloud.vn';

/** Capacitor bundle — static SPA + remote production API. */
export default defineConfig({
  plugins: [
    react(),
    injectApiBase(),
    inlineAppCss('mobile/www', { apiOrigin: PRODUCTION_ORIGIN }),
  ],
  define: {
    'import.meta.env.VITE_API_ORIGIN': JSON.stringify(PRODUCTION_ORIGIN),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@app': path.resolve(__dirname, 'app'),
    },
  },
  build: {
    outDir: 'mobile/www',
    emptyOutDir: true,
  },
  base: './',
});
