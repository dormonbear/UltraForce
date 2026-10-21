import { chromium, type Route } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test as extensionTest, expect } from './fixtures/extension'
import { SettingsPage } from './pages/settings.page'
import { waitForContentScript } from './helpers/content-script'

const baseUrl = 'https://race.my.salesforce.com'
const recordPath = '/lightning/r/Account/001000000000001AAA/view'
const apiPattern = '**/services/data/**'

// Reuse the extension fixtures with an isolated synthetic org. No org login or
// Salesforce network access is needed; the real built content scripts still run.
const test = extensionTest.extend({
  extensionContext: async ({}, use) => {
    const profile = mkdtempSync(path.join(tmpdir(), 'ultraforce-race-'))
    const extensionPath = path.resolve('build/chrome-mv3-prod')
    const context = await chromium.launchPersistentContext(profile, {
      headless: false,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
    })
    try {
      await context.addCookies([{ name: 'sid', value: 'synthetic-session', url: baseUrl }])
      await context.route('https://**/*', async (route) => {
        const request = route.request()
        if (request.url().startsWith(`${baseUrl}/lightning/`)) {
          await route.fulfill({ contentType: 'text/html', body: '<html><body>Search race fixture</body></html>' })
        } else if (request.url().includes('/services/data/')) {
          await route.fulfill({ json: { records: [], totalSize: 0, done: true } })
        } else {
          await route.abort()
        }
      })
      await new SettingsPage(context).setCustomCommands({
        race: {
          key: 'race',
          description: 'Race regression',
          soql: "SELECT Id, Name FROM RaceResult__c WHERE Name LIKE '%{query}%'",
          useToolingApi: false,
          isBuiltin: false,
          nameField: 'Name'
        }
      })
      await use(context)
    } finally {
      await context.close()
      rmSync(profile, { recursive: true, force: true })
    }
  },
  extensionPage: async ({ extensionContext }, use) => {
    const page = await extensionContext.newPage()
    await page.goto(`${baseUrl}/lightning/page/home`)
    await expect(page.locator('[id^="ultraforce-modal"]')).toBeAttached()
    await waitForContentScript(extensionContext, page)
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+b' : 'Control+b')
    await expect(page.locator('[data-ultraforce-input]')).toBeVisible()
    await use(page)
  }
})

function gate() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}

async function respondWithResult(route: Route) {
  await route.fulfill({
    json: { records: [{ Id: 'a00000000000001AAA', Name: 'Newest race result' }], totalSize: 1, done: true }
  })
}

test('newer Setup search survives an older custom response', async ({ extensionPage: page }) => {
  const entered = gate()
  const response = gate()
  await page.route(apiPattern, async (route) => {
    if (!decodeURIComponent(route.request().url()).includes('RaceResult__c')) return route.fallback()
    entered.release()
    await response.promise
    await respondWithResult(route)
  })
  try {
    const input = page.locator('[data-ultraforce-input]')
    await input.fill(':race old')
    await entered.promise
    await input.fill(':g debug')
    const names = page.locator('[data-ultraforce-result-item] .result-name')
    await expect(names).toHaveText(['Debug Logs'])

    const finished = page.waitForEvent('requestfinished', (request) =>
      decodeURIComponent(request.url()).includes('RaceResult__c')
    )
    response.release()
    await finished
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    )
    await expect(names).toHaveText(['Debug Logs'])
    await expect(input).toHaveValue(':g debug')
  } finally {
    response.release()
  }
})

test('newer custom search survives an older Setup layout response', async ({ extensionPage: page }) => {
  const entered = gate()
  const response = gate()
  await page.route(apiPattern, async (route) => {
    if (route.request().url().includes('/sobjects/Account/')) {
      entered.release()
      await response.promise
      await route.fulfill({ json: {} })
    } else if (decodeURIComponent(route.request().url()).includes('RaceResult__c')) {
      await respondWithResult(route)
    } else {
      await route.fallback()
    }
  })
  try {
    // Change only the local URL so Setup resolves a layout without navigating or
    // triggering the modal's separate record-context initialization request.
    await page.evaluate((pathname) => history.pushState({}, '', pathname), recordPath)
    const input = page.locator('[data-ultraforce-input]')
    await input.fill(':g debug')
    await entered.promise
    await input.fill(':race new')
    const names = page.locator('[data-ultraforce-result-item] .result-name')
    await expect(names).toHaveText(['Newest race result'])

    const finished = page.waitForEvent('requestfinished', (request) => request.url().includes('executeAnonymous'))
    response.release()
    await finished
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    )
    await expect(names).toHaveText(['Newest race result'])
    await expect(input).toHaveValue(':race new')
  } finally {
    response.release()
  }
})
