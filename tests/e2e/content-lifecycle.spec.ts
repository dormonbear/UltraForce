import { chromium, expect, test as base, type Page } from '@playwright/test'
import path from 'node:path'
import { waitForContentScript } from './helpers/content-script'

const origin = 'https://lifecycle.my.salesforce.com'
const setupPath = '/lightning/setup/ObjectManager/Account/'
const fieldsPath = `${setupPath}FieldsAndRelationships/view`
const detailsPath = `${setupPath}Details/view`
const setupFixture = `
  <button type="button">Back to fields / 返回字段列表</button>
  <p role="status">Fields / 字段</p>
  <div class="viewport scroller" role="region" aria-label="Fields / 字段" style="height:100px;overflow:auto">
    <div style="height:1000px"></div>
  </div>
  <script>
    const fields = document.querySelector('[role="region"]')
    const status = document.querySelector('[role="status"]')
    function interruptOnScroll() {
      if (fields.scrollTop === 0) return
      fields.removeEventListener('scroll', interruptOnScroll)
      history.pushState(null, '', '${detailsPath}')
      fields.scrollTop = 0
      status.textContent = 'Details / 详细信息'
    }
    fields.addEventListener('scroll', interruptOnScroll)
    document.querySelector('button').addEventListener('click', () => history.back())
    window.addEventListener('popstate', () => {
      status.textContent = 'Fields / 字段'
    })
  </script>
`

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
        } else if (url.origin === origin && url.pathname === fieldsPath) {
          await route.fulfill({ contentType: 'text/html; charset=utf-8', body: setupFixture })
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

for (const { invalidate, title } of [
  { invalidate: false, title: 'search survives a browser back-forward cache round trip / 搜索在往返缓存恢复后仍可用' },
  {
    invalidate: true,
    title: 'a restored orphan reports the extension update on the shortcut / 恢复的孤立脚本在按快捷键时提示扩展更新'
  }
]) {
  test(title, async ({ salesforcePage: page }) => {
    await page.goto(`${origin}/lightning/page/home`)
    const context = page.context()
    await waitForContentScript(context, page)
    await page.evaluate(() => {
      window.addEventListener('pageshow', (event) => {
        if (event.persisted) document.body.setAttribute('data-restored-from-cache', '')
      })
    })
    if (invalidate) {
      // Simulate invalidation in the isolated world while preserving the cached document.
      // 在隔离环境中模拟扩展上下文失效，同时保留缓存文档。
      const invalidated = await context.serviceWorkers()[0].evaluate(async (url) => {
        const [tab] = await chrome.tabs.query({ url })
        const [injection] = await chrome.scripting.executeScript({
          target: { tabId: tab.id! },
          func: () => {
            Object.defineProperty(chrome, 'runtime', { value: undefined })
            return !chrome.runtime
          }
        })
        return injection.result
      }, page.url())
      expect(invalidated).toBe(true)
    }

    await page.getByRole('link', { name: 'Leave page / 离开页面' }).click()
    await expect(page).toHaveURL(`${origin}/leave`)
    await page.goBack({ waitUntil: 'commit' })
    await expect(page.locator('body')).toHaveAttribute('data-restored-from-cache', '')

    const shortcut = process.platform === 'darwin' ? 'Meta+b' : 'Control+b'
    const containers = page.locator('[id^="ultraforce-modal"]')
    if (invalidate) {
      await expect(containers).toHaveCount(0)
      await page.keyboard.press(shortcut)
      await expect(page.getByText('UltraForce was updated')).toBeVisible()
      await page.getByRole('button', { name: 'Dismiss', exact: true }).click()
      await expect(containers).toHaveCount(0)
    } else {
      await page.keyboard.press(shortcut)
      await expect(page.getByRole('dialog', { name: 'UltraForce search' })).toBeVisible()
      await expect(containers).toHaveCount(1)
    }
  })
}

test('Setup retries scrolling after navigation interrupts a run / 导航中断后设置页会重试滚动', async ({
  salesforcePage: page
}) => {
  await page.goto(`${origin}${fieldsPath}`)
  const status = page.getByRole('status')
  await expect(status).toHaveText('Details / 详细信息')
  await expect(page).toHaveURL(`${origin}${detailsPath}`)

  await page.getByRole('button', { name: 'Back to fields / 返回字段列表' }).click()
  await expect(page).toHaveURL(`${origin}${fieldsPath}`)
  await expect(status).toHaveText('Fields / 字段')
  const fields = page.getByRole('region', { name: 'Fields / 字段' })
  await expect.poll(() => fields.evaluate((element) => element.scrollTop), { timeout: 7000 }).toBeGreaterThan(0)
})
