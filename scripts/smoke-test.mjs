import { chromium, expect } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

// Inspect the unmodified production artifact through CDP. / 通过 CDP 检查未经修改的正式产物。
async function run(locale) {
  const profile = mkdtempSync(path.join(tmpdir(), 'uf-production-'))
  const extension = path.resolve(process.env.EXTENSION_PATH || './build/chrome-mv3-prod')
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    locale,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
  })
  try {
    const base = 'https://locale.my.salesforce.com'
    await context.addCookies([{ name: 'sid', value: 'synthetic-locale-session', url: base }])
    await context.route('https://**/*', (route) => {
      if (route.request().url().startsWith(`${base}/lightning/`))
        return route.fulfill({ contentType: 'text/html', body: '<meta charset="utf-8"><body>Fixture / 夹具</body>' })
      if (route.request().url().startsWith(`${base}/services/data/`))
        return route.fulfill({ json: { records: [], totalSize: 0, done: true } })
      return route.abort()
    })
    const worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'))
    const page = await context.newPage()
    await page.goto(`${base}/lightning/page/home`)
    await expect
      .poll(() =>
        worker.evaluate(async (url) => {
          const [tab] = await chrome.tabs.query({ url })
          if (tab?.id === undefined) return false
          try {
            return (await chrome.tabs.sendMessage(tab.id, { action: 'ping' }))?.success === true
          } catch {
            return false
          }
        }, page.url())
      )
      .toBe(true)
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+b' : 'Control+b')
    const cdp = await context.newCDPSession(page)
    const find = (node) => {
      if (node.shadowRootType === 'closed' && node.children?.some((child) => child.nodeName !== 'STYLE')) return node
      for (const child of [...(node.children || []), ...(node.shadowRoots || [])]) {
        const found = find(child)
        if (found) return found
      }
    }
    let objectId
    await expect
      .poll(async () => {
        const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true })
        const shadow = find(root)
        if (!shadow) return false
        objectId = (await cdp.send('DOM.resolveNode', { backendNodeId: shadow.backendNodeId })).object.objectId
        return true
      })
      .toBe(true)
    const inspect = async (expression) => {
      const result = await cdp.send('Runtime.callFunctionOn', {
        objectId,
        functionDeclaration: `function() { ${expression} }`,
        returnByValue: true
      })
      if (result.exceptionDetails) throw new Error('CDP inspection failed / CDP 检查失败')
      return result.result.value
    }
    const chinese = locale === 'zh-CN'
    await expect
      .poll(() => inspect('return this.querySelector("[role=dialog]")?.getAttribute("lang")'))
      .toBe(chinese ? 'zh-CN' : 'en')
    expect(await inspect('return this.querySelector("[role=dialog]").getBoundingClientRect().width > 0')).toBe(true)
    expect(await inspect('return this.querySelector("[data-ultraforce-input]")?.getAttribute("placeholder")')).toBe(
      chinese ? '搜索 locale 元数据…' : 'Search locale metadata...'
    )
    const settings = chinese ? '设置' : 'Settings'
    expect(
      await inspect(
        `const button = [...this.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === ${JSON.stringify(settings)}); button?.click(); return !!button`
      )
    ).toBe(true)
    await expect.poll(() => inspect('return this.querySelector("h2")?.textContent')).toBe(settings)
    expect(
      await inspect(
        `return [...this.querySelectorAll('a')].some(a => a.textContent.trim() === ${JSON.stringify(chinese ? '隐私' : 'Privacy')})`
      )
    ).toBe(true)
    expect(await page.locator('[id^="ultraforce-modal"]').evaluate((element) => element.shadowRoot)).toBe(null)
    console.log(
      `PASS ${locale}: production search, settings, privacy link, closed isolation / 正式产物搜索、设置、隐私链接及封闭隔离通过`
    )
  } finally {
    await context.close()
    rmSync(profile, { recursive: true, force: true })
  }
}
await run('en-US')
await run('zh-CN')
