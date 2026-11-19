import { chromium, expect, test } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { waitForContentScript } from './helpers/content-script'

test('chooses Flows from the Tab scope picker / 从 Tab 搜索范围面板选择流程', async () => {
  const profile = mkdtempSync(path.join(tmpdir(), 'ultraforce-command-panel-'))
  const extensionPath = path.resolve('build/chrome-mv3-prod')
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    locale: 'en-US',
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
  })
  const baseUrl = 'https://scopes.my.salesforce.com'
  try {
    await context.addCookies([{ name: 'sid', value: 'synthetic-scopes-session', url: baseUrl }])
    await context.route('https://**/*', async (route) => {
      const url = route.request().url()
      if (url === `${baseUrl}/lightning/page/home`) {
        await route.fulfill({
          contentType: 'text/html',
          body: '<html><body>Scope fixture / 搜索范围夹具</body></html>'
        })
      } else if (url.startsWith(`${baseUrl}/services/data/`)) {
        await route.fulfill({ json: { records: [], totalSize: 0, done: true } })
      } else {
        await route.abort()
      }
    })

    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'))
    await worker.evaluate(() => chrome.storage.local.set({ ultraforce_search_settings: { shortcutKey: 'AlT+K' } }))

    const page = await context.newPage()
    await page.goto(`${baseUrl}/lightning/page/home`)
    await expect(page.locator('[id^="ultraforce-modal"]')).toBeAttached()
    await waitForContentScript(context, page)
    await page.keyboard.press('Alt+k')

    const dialog = page.getByRole('dialog', { name: 'UltraForce search' })
    const input = dialog.getByRole('combobox')
    await expect(input).toBeFocused()
    await input.press('Tab')
    const heading = dialog.getByRole('heading', { name: 'Choose a scope' })
    await expect(heading).toBeVisible()
    await input.pressSequentially('flo')
    const options = dialog.getByRole('listbox').getByRole('option')
    await expect(options).toHaveCount(1)
    await expect(options).toHaveAccessibleName('Flows :f')
    await input.press('Enter')
    await expect(heading).toBeHidden()
    await expect(dialog.getByTitle('Flows', { exact: true })).toBeVisible()
    await expect(input).toHaveValue('')
    await expect(input).toBeFocused()
    await input.press('Backspace')
    await input.pressSequentially('account')
    await input.evaluate((element: HTMLInputElement) => element.setSelectionRange(0, 0))
    await input.pressSequentially(':f ')
    await expect(dialog.getByTitle('Flows', { exact: true })).toBeVisible()
    await expect(input).toHaveValue('account')
    await expect(input).toHaveJSProperty('selectionStart', 0)

    await input.press('Alt+k')
    await expect(dialog).toHaveCount(0)

    await worker.evaluate(() => chrome.storage.local.set({ ultraforce_search_settings: { shortcutKey: 'escape' } }))
    await page.reload()
    await waitForContentScript(context, page)
    await page.keyboard.press('Escape')
    await expect(input).toBeFocused()

    await dialog.getByRole('button', { name: 'Settings', exact: true }).click()
    const settings = dialog.getByRole('heading', { name: 'Settings', exact: true })
    await expect(settings).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(settings).toBeHidden()
    await expect(input).toBeFocused()

    await input.press('Tab')
    await expect(heading).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(heading).toBeHidden()
    await expect(input).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  } finally {
    await context.close()
    rmSync(profile, { recursive: true, force: true })
  }
})
