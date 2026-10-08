import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const r = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

/**
 * Main build: extension pages (popup, side panel, options) and the
 * background service worker. The content script is built separately
 * (vite.content.config.ts) because MV3 content scripts must be plain
 * (non-module) scripts.
 */
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': r('./src/'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV !== 'production',
    rollupOptions: {
      input: {
        popup: r('./src/popup/index.html'),
        sidepanel: r('./src/sidepanel/index.html'),
        options: r('./src/options/index.html'),
        background: r('./src/background/index.ts'),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
