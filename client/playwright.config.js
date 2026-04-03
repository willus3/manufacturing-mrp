// Playwright config for UAT end-to-end tests.
// Assumes backend running on port 3000 and frontend on port 5173.
// Tests run serially because later tests depend on data created by earlier tests.

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Serial — tests depend on prior test data
  forbidOnly: !!process.env.CI,
  retries: 0, // No retries — we want to see real failures
  workers: 1, // Single worker — serial execution
  reporter: 'html',
  timeout: 30_000, // 30s per test

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],

  // Do NOT start servers — they must be running before tests start.
  // Run: cd server && npx prisma db seed && node src/index.js
  // Run: cd client && npx vite
});
