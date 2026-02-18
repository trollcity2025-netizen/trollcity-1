import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';

export default defineConfig({
  testDir: 'tests/smoke',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
    launchOptions: {
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    },
  },
  projects: [
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'], permissions: ['camera', 'microphone'] },
    },
    { name: 'iPhone 14', use: { ...devices['iPhone 14'] } },
    {
      name: 'Pixel 7',
      use: { ...devices['Pixel 7'], permissions: ['camera', 'microphone'] },
    },
    { name: 'iPad Mini', use: { ...devices['iPad Mini'] } },
  ],
  webServer: {
    command: 'npm run dev -- --host --port 5173',
    url: baseURL,
    timeout: 120 * 1000,
    reuseExistingServer: false,
    env: {
      NODE_ENV: 'test',
      VITE_ENV: 'test',
    },
  },
});
