import { defineConfig } from '@playwright/test';

/**
 * Chromium launch flags that load the built MV3 extension. Extensions
 * require a persistent context, so the E2E fixture in
 * tests/e2e/fill.spec.ts passes these to `launchPersistentContext`.
 */
export const EXTENSION_LAUNCH_ARGS = [
  '--disable-extensions-except=./dist',
  '--load-extension=./dist',
];

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    // Applied to browsers launched through the default fixture. The
    // extension tests use a persistent context with the same flags.
    launchOptions: { args: EXTENSION_LAUNCH_ARGS },
  },
  webServer: {
    command: 'node scripts/e2e-server.mjs',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
});
