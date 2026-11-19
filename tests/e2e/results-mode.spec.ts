import { chromium, expect, test } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { waitForContentScript } from './helpers/content-script'

test('widens the input while hiding the round buttons / 隐藏圆形按钮并加宽输入框', async () => {
  const profile = mkdtempSync(path.join(tmpdir(), 'ultraforce-results-mode-'))
  const extensionPath = path.resolve('build/chrome-mv3-prod')
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    locale: 'en-US',
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
  })
  const baseUrl = 'https://results.my.salesforce.com'
  try {
    await context.addCookies([{ name: 'sid', value: 'synthetic-results-session', url: baseUrl }])
    await context.route('https://**/*', async (route) => {
      const url = route.request().url()
      if (url === `${baseUrl}/lightning/page/home`) {
        await route.fulfill({
          contentType: 'text/html',
          body: '<html><body>Results fixture / 结果夹具</body></html>'
        })
      } else if (url.startsWith(`${baseUrl}/services/data/`)) {
        await route.fulfill({ json: { records: [], totalSize: 0, done: true } })
      } else {
        await route.abort()
      }
    })

    const page = await context.newPage()
    await page.goto(`${baseUrl}/lightning/page/home`)
    await expect(page.locator('[id^="ultraforce-modal"]')).toBeAttached()
    await waitForContentScript(context, page)
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+b' : 'Control+b')

    const dialog = page.getByRole('dialog', { name: 'UltraForce search' })
    const input = dialog.getByRole('combobox')
    await expect(input).toBeFocused()
    const history = dialog.getByRole('button', { name: 'History', exact: true })
    const historyButton = dialog.locator('button[aria-label="History"]')
    await expect(history).toBeVisible()
    await dialog.locator('.search-bar-row').evaluate(async (row) => {
      await Promise.all(row.getAnimations().map((animation) => animation.finished))
    })
    const idleWidth = (await input.boundingBox())!.width

    await input.pressSequentially('acc')
    await expect(history).toHaveCount(0)
    await expect(historyButton).toBeHidden()
    await expect.poll(async () => (await input.boundingBox())?.width ?? 0).toBeGreaterThan(idleWidth)
    await expect(dialog.locator('.search-footer-pill')).toContainText('Open')

    await input.selectText()
    await input.press('Backspace')
    await expect(history).toBeVisible()
    await expect.poll(async () => Math.round((await input.boundingBox())!.width)).toBe(Math.round(idleWidth))

    const backdrop = page.locator('.ultraforce-backdrop')
    await input.press('Escape')
    await expect(backdrop).toHaveAttribute('data-closing', 'true')
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+b' : 'Control+b')
    await expect(backdrop).not.toHaveAttribute('data-closing', 'true')
    await expect(input).toBeFocused()

    await input.press('Escape')
    await expect(backdrop).toHaveAttribute('data-closing', 'true')
    await expect(dialog).toHaveCount(0)

    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+b' : 'Control+b')
    await expect(input).toBeFocused()
    const root = page.locator('html')
    await expect(root).toHaveAttribute('data-ultraforce-modal-open', '')
    await page.locator('[id^="ultraforce-modal"]').evaluate((host) => host.remove())
    await page.keyboard.press('Escape')
    await expect(root).not.toHaveAttribute('data-ultraforce-modal-open', '')
  } finally {
    await context.close()
    rmSync(profile, { recursive: true, force: true })
  }
})
