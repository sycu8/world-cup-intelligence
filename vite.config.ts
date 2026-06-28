import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';
import path from 'node:path';
import { injectApiBase } from './vite-plugin-inject-api-base';
import { inlineAppCss } from './vite-plugin-inline-app-css';

export default defineConfig({
  plugins: [react(), cloudflare(), injectApiBase(), inlineAppCss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@app': path.resolve(__dirname, 'app'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
