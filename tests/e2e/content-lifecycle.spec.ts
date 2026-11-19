import { chromium, expect, test as base, type Page } from '@playwright/test'
import path from 'node:path'
import { waitForContentScript } from './helpers/content-script'

const origin = 'https://lifecycle.my.salesforce.com'

const test = base.extend<{ salesforcePage: Page }>({
  salesforcePage: async ({}, use) => {
    const extensionPath = path.resolve('build/chrome-mv3-prod')
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: true,
      locale: 'en-US',
      ignoreDefaultArgs: ['--disable-back-forward-cache'],
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
    })
    try {
      await context.route('**/*', async (route) => {
        const url = new URL(route.request().url())
        if (url.origin === origin && url.pathname.startsWith('/services/data/')) {
          await route.fulfill({ json: { records: [], totalSize: 0, done: true } })
        } else if (url.origin === origin && url.pathname === '/lightning/page/home') {
          await route.fulfill({
            contentType: 'text/html; charset=utf-8',
            body: '<a href="/leave">Leave page / 离开页面</a>'
          })
        } else if (url.origin === origin && url.pathname === '/leave') {
          await route.fulfill({ contentType: 'text/html; charset=utf-8', body: 'Second page / 第二页' })
        } else {
          await route.abort()
        }
      })
      const page = await context.newPage()
      await use(page)
    } finally {
      await context.close()
    }
  }
})

test('search opens after canceling the leave prompt / 取消离开提示后仍可打开搜索', async ({ salesforcePage: page }) => {
  await page.goto(`${origin}/lightning/page/home`)
  await waitForContentScript(page.context(), page)
  await page.evaluate(() => {
    window.addEventListener('beforeunload', (event) => {
      event.preventDefault()
      event.returnValue = true
    })
  })

  const dismissed: string[] = []
  page.once('dialog', async (dialog) => {
    await dialog.dismiss()
    dismissed.push(dialog.type())
  })
  await page.getByRole('link', { name: 'Leave page / 离开页面' }).click()
  await expect.poll(() => dismissed).toEqual(['beforeunload'])
  await expect(page).toHaveURL(`${origin}/lightning/page/home`)

  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+b' : 'Control+b')
  await expect(page.getByRole('dialog', { name: 'UltraForce search' })).toBeVisible()
})

test('search survives a browser back-forward cache round trip / 搜索在往返缓存恢复后仍可用', async ({
  salesforcePage: page
}) => {
  await page.goto(`${origin}/lightning/page/home`)
  await waitForContentScript(page.context(), page)
  await page.evaluate(() => {
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) document.body.setAttribute('data-restored-from-cache', '')
    })
  })

  await page.getByRole('link', { name: 'Leave page / 离开页面' }).click()
  await expect(page).toHaveURL(`${origin}/leave`)
  await page.goBack({ waitUntil: 'commit' })
  await expect(page.locator('body')).toHaveAttribute('data-restored-from-cache', '')

  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+b' : 'Control+b')
  await expect(page.getByRole('dialog', { name: 'UltraForce search' })).toBeVisible()
  await expect(page.locator('[id^="ultraforce-modal"]')).toHaveCount(1)
})
