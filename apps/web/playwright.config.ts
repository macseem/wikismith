import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../../.env') });

const PORT = 3099;
const useProdServer = process.env['PLAYWRIGHT_USE_PROD_SERVER'] !== '0';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: 1,
  reporter: process.env['CI'] ? 'github' : 'html',
  timeout: 5 * 60 * 1000,
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
    command: useProdServer
      ? `pnpm next build && pnpm next start --port ${PORT}`
      : `pnpm next dev --port ${PORT}`,
    port: PORT,
    timeout: useProdServer ? 300_000 : 60_000,
    reuseExistingServer: !process.env['CI'],
    env: {
      NODE_ENV: useProdServer ? 'production' : 'development',
      OPENAI_API_KEY: process.env['OPENAI_API_KEY'] ?? '',
      DATABASE_URL: process.env['DATABASE_URL'] ?? '',
      E2E_BYPASS_AUTH: '1',
      PLAYWRIGHT_E2E: '1',
      E2E_WORKOS_ID: 'e2e_workos_user',
      E2E_USER_EMAIL: 'e2e@wikismith.local',
    },
  },
});
