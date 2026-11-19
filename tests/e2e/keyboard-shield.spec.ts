import { chromium, expect, test } from '@playwright/test'
import { resolve } from 'node:path'

test('shields host keyboard listeners and preserves their lifecycle / 屏蔽宿主页键盘监听器并保留其生命周期', async () => {
  const extensionPath = resolve('build/chrome-mv3-prod')
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
  })
  const url = 'https://keyboard-shield.my.salesforce.com/lightning/page/home'
  try {
    await context.route('https://**/*', (route) =>
      route.request().url() === url
        ? route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' })
        : route.abort()
    )
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'))
    await expect
      .poll(() =>
        worker.evaluate(async () => {
          const scripts = await chrome.scripting.getRegisteredContentScripts()
          return scripts.some(
            (script) => script.world === 'MAIN' && script.js?.some((file) => file.startsWith('keyboard-shield.'))
          )
        })
      )
      .toBe(true)

    const page = await context.newPage()
    await page.goto(url)

    const calls = await page.evaluate(() => {
      const first = new EventTarget()
      const second = new EventTarget()
      const counts = { first: 0, second: 0, object: 0 }
      function listener(this: EventTarget) {
        if (this === first) counts.first++
        if (this === second) counts.second++
      }
      const object = {
        handleEvent() {
          if (this === object) counts.object++
        }
      }
      const dispatch = () => {
        first.dispatchEvent(new KeyboardEvent('keydown'))
        second.dispatchEvent(new KeyboardEvent('keydown'))
      }
      first.addEventListener('keydown', listener)
      first.addEventListener('keydown', listener)
      first.addEventListener('keydown', object)
      second.addEventListener('keydown', listener)

      document.documentElement.setAttribute('data-ultraforce-modal-open', '')
      dispatch()
      const open = { ...counts }
      document.documentElement.removeAttribute('data-ultraforce-modal-open')
      dispatch()
      const closed = { ...counts }

      first.removeEventListener('keydown', listener)
      first.removeEventListener('keydown', object)
      dispatch()
      const firstRemoved = { ...counts }
      second.removeEventListener('keydown', listener)
      dispatch()
      return { open, closed, firstRemoved, allRemoved: counts }
    })

    expect(calls).toEqual({
      open: { first: 0, second: 0, object: 0 },
      closed: { first: 1, second: 1, object: 1 },
      firstRemoved: { first: 1, second: 2, object: 1 },
      allRemoved: { first: 1, second: 2, object: 1 }
    })
  } finally {
    await context.close()
  }
})
