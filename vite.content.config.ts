import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';

const r = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

/**
 * Content script build. MV3 content scripts cannot be ES modules, so the
 * content script is bundled as a single IIFE file (dist/content.js).
 */
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: process.env.NODE_ENV !== 'production',
    lib: {
      entry: r('./src/content/index.ts'),
      name: 'profilepackContent',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
  },
});
