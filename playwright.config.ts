import { defineConfig } from '@playwright/test'

// E2E_VISIBLE=1 launches the headed (on-screen) Chromium for debugging a
// failing spec by watching it. Default: headless new-mode Chromium - the
// extension still loads (channel: 'chromium', see fixtures/extension.ts) but
// no window appears on the user's screen.
const E2E_VISIBLE = process.env.E2E_VISIBLE === '1'

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
    headless: !E2E_VISIBLE,
    trace: 'on-first-retry',
    video: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium'
    }
  ]
})
