import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../../.env') });

const PORT = 3099;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  workers: 1,
  reporter: 'html',
  timeout: 5 * 60 * 1000, // 5 min per test — generation calls OpenAI
  expect: {
    timeout: 30_000,
  },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `pnpm next dev --turbopack --port ${PORT}`,
    port: PORT,
    timeout: 60_000,
    reuseExistingServer: !process.env['CI'],
    env: {
      NODE_ENV: 'development',
      OPENAI_API_KEY: process.env['OPENAI_API_KEY'] ?? '',
      DATABASE_URL: process.env['DATABASE_URL'] ?? '',
    },
  },
});
