import { expect, type BrowserContext, type Page } from '@playwright/test'

// The container is created before keyboard registration; ping is registered after it.
// 容器先于键盘处理器创建；ping 监听器在键盘处理器之后注册。
export async function waitForContentScript(context: BrowserContext, page: Page): Promise<void> {
  const worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'))
  await expect
    .poll(() =>
      worker.evaluate(async (url) => {
        const [tab] = await chrome.tabs.query({ url })
        if (tab?.id === undefined) return false
        try {
          const response = await chrome.tabs.sendMessage(tab.id, { action: 'ping' })
          return response?.success === true
        } catch {
          return false
        }
      }, page.url())
    )
    .toBe(true)
}
