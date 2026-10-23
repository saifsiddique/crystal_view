import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

// `base: './'` keeps asset, worker and .wasm URLs relative so the build works from any sub-path
// (GitHub Pages project sites, a local `vite preview`, or a file server).
export default defineConfig({
  base: './',
  plugins: [svelte()],
  worker: { format: 'es' },
  build: { target: 'es2023' },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
});
