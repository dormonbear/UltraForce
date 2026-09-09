import { test, expect } from './fixtures/extension'
import { UltraForcePage } from './pages/ultraforce.page'

// The host page can steal focus after the modal opened (late-mounting component,
// iframe finishing its load). Typing must still land in the search input and the
// caret must come back without a mouse click.
test.describe('Focus reclaim', () => {
  let uf: UltraForcePage

  test.beforeAll(async ({ extensionPage, extensionContext, baseUrl }) => {
    uf = new UltraForcePage(extensionPage, extensionContext, baseUrl)
  })

  test.afterEach(async ({ extensionPage }) => {
    await extensionPage.evaluate(() => document.querySelectorAll('[data-e2e-stealer]').forEach((el) => el.remove()))
  })

  const activeHostId = (page: import('@playwright/test').Page) =>
    page.evaluate(() => document.activeElement?.id ?? document.activeElement?.tagName ?? 'null')

  test('reclaims focus stolen by a host page input', async ({ extensionPage: page }) => {
    await uf.openModal()
    await page.evaluate(() => {
      const stealer = document.createElement('input')
      stealer.setAttribute('data-e2e-stealer', '')
      document.body.appendChild(stealer)
      stealer.focus()
    })
    await expect.poll(() => activeHostId(page)).toContain('ultraforce-modal')

    await uf.clearAndType('weather')
    await expect(page.locator('[data-ultraforce-input]')).toHaveValue('weather')
    await uf.closeModal()
  })

  test('reclaims focus stolen by an iframe', async ({ extensionPage: page }) => {
    await uf.openModal()
    await page.evaluate(() => {
      const frame = document.createElement('iframe')
      frame.setAttribute('data-e2e-stealer', '')
      document.body.appendChild(frame)
      frame.contentWindow?.focus()
    })
    await expect.poll(() => activeHostId(page)).toContain('ultraforce-modal')

    await uf.clearAndType('weather')
    await expect(page.locator('[data-ultraforce-input]')).toHaveValue('weather')
    await uf.closeModal()
  })
})
