import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.TA_BASE_URL ?? 'https://ta.muslimgate.org';

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: Number(process.env.TA_WORKERS ?? 2),
  retries: Number(process.env.TA_RETRIES ?? 0),
  outputDir: 'reports/artifacts',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/html', open: 'never' }],
    ['./src/ArabicReporter.ts'],
  ],
  use: {
    baseURL,
    locale: 'ar-EG',
    screenshot: 'only-on-failure',
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      testMatch: /Axe\.spec\.ts/,
    },
  ],
});
