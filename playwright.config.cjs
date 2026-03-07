const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/smoke',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.VITE_BASE_URL || 'http://localhost:5177',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    // Desktop Chrome
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Mobile Android
    {
      name: 'Android Chrome',
      use: { 
        ...devices['Pixel 5'],
        viewport: { width: 412, height: 915 },
      },
    },
    // Mobile iPhone
    {
      name: 'iPhone 14 Pro',
      use: { 
        ...devices['iPhone 14 Pro'],
        viewport: { width: 393, height: 852 },
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: process.env.VITE_BASE_URL || 'http://localhost:5177',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
