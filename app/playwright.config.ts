import { defineConfig, devices } from '@playwright/test';

// The port can be changed with E2E_PORT when 4173 is taken by something else.
const port = Number(process.env.E2E_PORT ?? 4173);

// Serves the production build (`vite preview`) so e2e exercises the real bundle, worker and .wasm.
export default defineConfig({
  testDir: './tests/e2e',
  // Software WebGL in headless Chromium is slow when several workers draw at once.
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://localhost:${port}`, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npm run preview -- --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
