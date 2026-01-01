import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 180000,
  expect: {
    timeout: 10000
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    headless: false,
    trace: 'on-first-retry',
    video: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium'
    }
  ]
})
