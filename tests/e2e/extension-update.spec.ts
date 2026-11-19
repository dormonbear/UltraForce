import { chromium, expect, test } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { waitForContentScript } from './helpers/content-script'

test('search reattaches after two extension reloads / 扩展重载两次后搜索仍能接管已打开页面', async () => {
  const profile = mkdtempSync(path.join(tmpdir(), 'ultraforce-update-'))
  const extensionPath = path.resolve('build/chrome-mv3-prod')
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    locale: 'en-US',
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
  })
  const baseUrl = 'https://update.my.salesforce.com'
  const homeUrl = `${baseUrl}/lightning/page/home`
  try {
    await context.addCookies([{ name: 'sid', value: 'synthetic-update-session', url: baseUrl }])
    await context.route('https://**/*', async (route) => {
      const url = route.request().url()
      if (url === homeUrl) {
        await route.fulfill({
          contentType: 'text/html',
          body: '<html><head><meta charset="utf-8"></head><body>Update fixture / 更新夹具</body></html>'
        })
      } else if (url.startsWith(`${baseUrl}/services/data/`)) {
        await route.fulfill({ json: { records: [], totalSize: 0, done: true } })
      } else {
        await route.abort()
      }
    })

    const worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'))
    const page = await context.newPage()
    await page.goto(homeUrl)
    await waitForContentScript(context, page)
    const containers = page.locator('[id^="ultraforce-modal"]')
    await page.evaluate(() => document.body.setAttribute('data-original-document', ''))
    const shortcut = process.platform === 'darwin' ? 'Meta+b' : 'Control+b'
    const dialog = page.getByRole('dialog', { name: 'UltraForce search' })
    await page.keyboard.press(shortcut)
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()

    const input = page.getByRole('combobox', { name: 'Search Salesforce metadata' })
    const notice = page.getByText('UltraForce was updated')
    const extensionId = new URL(worker.url()).hostname
    const extensionsPage = await context.newPage()
    await extensionsPage.goto('chrome://extensions')
    await extensionsPage.locator('#devMode').click()
    const extensionCard = extensionsPage.locator(`extensions-item[id="${extensionId}"]`)
    const reload = extensionCard.getByRole('button', { name: /reload/i })
    for (const query of ['account', 'contact']) {
      await containers.evaluate((container) => container.setAttribute('data-original-instance', ''))
      await reload.click()
      await page.bringToFront()
      await expect(page.locator('[data-original-instance]')).toHaveCount(0)
      await waitForContentScript(context, page)
      await page.keyboard.press(shortcut)
      await expect(dialog).toBeVisible()
      await expect(input).toBeVisible()
      await page.keyboard.type(query)
      await expect(input).toHaveValue(query)
      await expect(notice).toBeHidden()
      await expect(page.getByText('UltraForce encountered an error')).toBeHidden()
      await expect(page.locator('body')).toHaveAttribute('data-original-document', '')
      await expect(containers).toHaveCount(1)
      await page.keyboard.press('Escape')
      await expect(dialog).toBeHidden()
    }
  } finally {
    await context.close()
    rmSync(profile, { recursive: true, force: true })
  }
})
