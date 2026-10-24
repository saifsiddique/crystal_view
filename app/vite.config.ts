import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

// `base: './'` keeps asset, worker and .wasm URLs relative so the build works from any sub-path
// (GitHub Pages project sites, a local `vite preview`, or a file server).
export default defineConfig({
  base: './',
  plugins: [svelte()],
  worker: { format: 'es' },
  // three.js alone is ~500 kB minified; it loads with the viewer, not with the first paint.
  build: { target: 'es2023', chunkSizeWarningLimit: 900 },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
});
