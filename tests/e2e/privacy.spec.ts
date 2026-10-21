import { test, expect, chromium, type BrowserContext } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const baseUrl = 'https://privacy.my.salesforce.com'
const legacyKeys = ['ultraforce_error_logs', 'ultraforce_api_stats']

// An isolated, synthetic organization: every HTTPS request is intercepted.
// The built extension, cookie bridge, storage, search and logger run unchanged.
test('built extension removes legacy diagnostics and never records request activity', async () => {
  test.setTimeout(45000)
  const profile = mkdtempSync(path.join(tmpdir(), 'ultraforce-privacy-'))
  const extensionPath = path.resolve('build/chrome-mv3-prod')
  const launch = () =>
    chromium.launchPersistentContext(profile, {
      headless: false,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
    })
  const context: BrowserContext = await launch()
  try {
    const worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'))
    await worker.evaluate(async () => {
      await chrome.storage.local.set({
        ultraforce_error_logs: [{ message: 'synthetic legacy error' }],
        ultraforce_api_stats: { totalRequests: 9, requestLog: [123] },
        ultraforce_favorites__fixture: [{ id: 'keep-favorite' }],
        ultraforce_history__fixture: [{ id: 'keep-history' }],
        metadata_fixture_ApexClass: { data: ['keep-cache'] },
        ultraforce_search_settings: {
          customCommands: {
            private: {
              key: 'private',
              description: 'Privacy fixture',
              soql: "SELECT Id, Name FROM PrivacyFixture__c WHERE Name LIKE '%{query}%'",
              useToolingApi: false,
              isBuiltin: false,
              nameField: 'Name'
            }
          }
        }
      })
    })
    // Re-execute the packaged worker entry point to exercise its activation
    // migration after seeding an old profile. Chrome's browser-restart worker
    // debugger context can be suspended indefinitely in this test harness.
    await worker.evaluate(() => {
      // Discard the bundler module cache so the entry executes as on activation.
      for (const key of Object.keys(globalThis)) {
        if (/^parcelRequire/.test(key)) delete (globalThis as unknown as Record<string, unknown>)[key]
      }
      ;(globalThis as unknown as { importScripts: (url: string) => void }).importScripts(
        chrome.runtime.getURL('static/background/index.js')
      )
    })
    await expect
      .poll(() =>
        worker.evaluate(async (keys) => {
          return Object.keys(await chrome.storage.local.get(keys))
        }, legacyKeys)
      )
      .toEqual([])
    const preserved = await worker.evaluate(() =>
      chrome.storage.local.get([
        'ultraforce_favorites__fixture',
        'ultraforce_history__fixture',
        'metadata_fixture_ApexClass',
        'ultraforce_search_settings'
      ])
    )
    expect(preserved.ultraforce_favorites__fixture).toEqual([{ id: 'keep-favorite' }])
    expect(preserved.ultraforce_history__fixture).toEqual([{ id: 'keep-history' }])
    expect(preserved.metadata_fixture_ApexClass).toEqual({ data: ['keep-cache'] })
    expect(preserved.ultraforce_search_settings.customCommands.private.key).toBe('private')

    const network: string[] = []
    const diagnosticWrites: string[] = []
    await worker.evaluate((keys) => {
      const writes: string[] = []
      ;(globalThis as unknown as { diagnosticWrites: string[] }).diagnosticWrites = writes
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local')
          for (const key of keys) {
            if (changes[key]?.newValue !== undefined) writes.push(key)
          }
      })
    }, legacyKeys)
    await context.addCookies([{ name: 'sid', value: 'synthetic-private-session', url: baseUrl }])
    await context.route('https://**/*', async (route) => {
      const url = new URL(route.request().url())
      network.push(url.origin)
      if (url.origin !== baseUrl) return route.abort()
      if (url.pathname.startsWith('/lightning/')) {
        return route.fulfill({ contentType: 'text/html', body: '<html><body>Privacy fixture</body></html>' })
      }
      const query = url.searchParams.get('q') || ''
      if (query.includes('PrivacyFixture__c')) {
        if (query.includes('fail')) return route.fulfill({ status: 400, json: [{ message: 'PRIVATE-RESPONSE' }] })
        return route.fulfill({
          json: {
            records: [{ Id: 'a00000000000001AAA', Name: 'Synthetic privacy result' }],
            totalSize: 1,
            done: true
          }
        })
      }
      return route.fulfill({ json: { records: [], totalSize: 0, done: true } })
    })
    const page = await context.newPage()
    const consoleMessages: string[] = []
    page.on('console', (message) => consoleMessages.push(message.text()))
    await page.goto(`${baseUrl}/lightning/page/home?private=PRIVATE-PAGE`)
    await expect(page.locator('[id^="ultraforce-modal"]')).toBeAttached()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+b' : 'Control+b')
    const input = page.locator('[data-ultraforce-input]')
    await expect(input).toBeVisible()
    await input.fill(':private success')
    await expect(page.locator('[data-ultraforce-result-item] .result-name')).toHaveText(['Synthetic privacy result'])
    await input.fill(':private fail')
    await expect(page.getByText(/PRIVATE-RESPONSE/)).toBeVisible()
    await page.locator('[data-ultraforce-settings-button]').click()
    await expect(page.getByText('API Statistics', { exact: true })).toHaveCount(0)
    expect(await worker.evaluate((keys) => chrome.storage.local.get(keys), legacyKeys)).toEqual({})
    diagnosticWrites.push(
      ...(await worker.evaluate(() => (globalThis as unknown as { diagnosticWrites: string[] }).diagnosticWrites))
    )
    expect(diagnosticWrites).toEqual([])
    expect(network.length).toBeGreaterThan(1)
    expect([...new Set(network)]).toEqual([baseUrl])
    expect(consoleMessages.join('\n')).not.toMatch(
      /synthetic-private-session|PRIVATE-RESPONSE|PRIVATE-PAGE|PrivacyFixture__c/
    )
    expect(consoleMessages).toContain('[UltraForce] An operation failed.')
  } finally {
    await context.close()
    rmSync(profile, { recursive: true, force: true })
  }
})
