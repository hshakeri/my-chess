import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false,
  forbidOnly: isCI,
  retries: 0,
  workers: 1,
  // In CI, failures are also annotated on the workflow run
  reporter: isCI ? [['list'], ['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173/my-chess/',
    // With no retries, keep the trace of every failed test in CI (it ends up in the uploaded report)
    trace: isCI ? 'retain-on-failure' : 'on-first-retry',
    viewport: { width: 1280, height: 800 },
    // A Chromium installed outside Playwright's cache (a sandbox, a distro package) can be used instead
    launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {},
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev -- --port 5173 --host',
    url: 'http://localhost:5173/my-chess/',
    reuseExistingServer: !isCI,
    timeout: 120000,
  },
});
