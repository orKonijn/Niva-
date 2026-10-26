import { defineConfig } from '@playwright/test';
export default defineConfig({
  outputDir: '.test-data/staging42/playwright-results',
  testDir: './tests/staging',
  testMatch: '*.journey.ts',
  workers: 1,
  retries: 0,
  timeout: 120000,
  use: {
    baseURL: 'http://127.0.0.1:4310',
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'off',
  },
  reporter: [['list'], ['json', { outputFile: '.test-data/repair42/staging-browser.json' }]],
});
