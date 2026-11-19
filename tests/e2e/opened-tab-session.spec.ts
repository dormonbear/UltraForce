import { chromium, expect, test } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { waitForContentScript } from './helpers/content-script'

test('keeps the session in a tab opened from Setup search / 从设置搜索打开的标签页保留会话', async () => {
  const profile = mkdtempSync(path.join(tmpdir(), 'ultraforce-opened-tab-'))
  const extensionPath = path.resolve('build/chrome-mv3-prod')
  const baseUrl = 'https://probe--full.sandbox.setup.sfcrmproducts.cn'
  const shortcut = process.platform === 'darwin' ? 'Meta+b' : 'Control+b'
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    locale: 'en-US',
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
  })

  try {
    await context.addCookies([{ name: 'sid', value: '00D000000000001AAA!synthetic', url: baseUrl }])
    await context.route('https://**/*', (route) => {
      const url = route.request().url()
      if (url.startsWith(`${baseUrl}/lightning/`)) {
        return route.fulfill({
          contentType: 'text/html',
          body: '<html><meta charset="utf-8"><body>Setup fixture / 设置测试页面</body></html>'
        })
      }
      if (url.startsWith(`${baseUrl}/services/data/`)) {
        return route.fulfill({ json: { records: [], totalSize: 0, done: true } })
      }
      return route.abort()
    })

    const page = await context.newPage()
    await page.goto(`${baseUrl}/lightning/setup/PermSets/home`)
    await expect(page.locator('[id^="ultraforce-modal"]')).toBeAttached()
    await waitForContentScript(context, page)
    await page.keyboard.press(shortcut)
    const search = page.getByRole('dialog', { name: 'UltraForce search' })
    const [popup] = await Promise.all([page.waitForEvent('popup'), search.getByText('Users', { exact: true }).click()])

    await expect(popup).toHaveURL(`${baseUrl}/lightning/setup/ManageUsers/home`)
    await expect(popup.locator('[id^="ultraforce-modal"]')).toBeAttached()
    await waitForContentScript(context, popup)
    await popup.bringToFront()
    await popup.keyboard.press(shortcut)
    const popupSearch = popup.getByRole('dialog', { name: 'UltraForce search' })
    await expect(popupSearch).toBeVisible()
    await expect(popupSearch.getByText('Not Logged In', { exact: true })).toBeHidden()
    await expect(popupSearch.getByRole('combobox')).toHaveAttribute('placeholder', /probe--full/)
  } finally {
    await context.close()
    rmSync(profile, { recursive: true, force: true })
  }
})
