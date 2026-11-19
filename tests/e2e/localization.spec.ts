import { chromium, expect, test } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { waitForContentScript } from './helpers/content-script'

for (const locale of ['en-US', 'zh-CN']) {
  test(`packaged search and settings follow ${locale} / 打包后的搜索及设置跟随 ${locale}`, async () => {
    const profile = mkdtempSync(path.join(tmpdir(), 'ultraforce-locale-'))
    const extensionPath = path.resolve('build/chrome-mv3-prod')
    const context = await chromium.launchPersistentContext(profile, {
      channel: 'chromium',
      headless: true,
      locale,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
    })
    const chinese = locale === 'zh-CN'
    const baseUrl = 'https://locale.my.salesforce.com'
    try {
      await context.addCookies([{ name: 'sid', value: 'synthetic-locale-session', url: baseUrl }])
      await context.route('https://**/*', async (route) => {
        if (route.request().url().startsWith(`${baseUrl}/lightning/`)) {
          await route.fulfill({
            contentType: 'text/html',
            body: '<html><head><meta charset="utf-8"></head><body>Locale fixture / 语言夹具</body></html>'
          })
        } else if (route.request().url().startsWith(`${baseUrl}/services/data/`)) {
          await route.fulfill({ json: { records: [], totalSize: 0, done: true } })
        } else {
          await route.abort()
        }
      })
      const worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'))
      await worker.evaluate(async () => {
        await chrome.storage.local.set({
          ultraforce_search_settings: {
            customCommands: {
              fixture: {
                key: 'fixture',
                description: 'Objects & Fields',
                soql: "SELECT Id FROM Account WHERE Name LIKE '%{query}%'",
                isBuiltin: false,
                useToolingApi: false,
                nameField: 'Name'
              }
            }
          }
        })
      })
      const page = await context.newPage()
      await page.goto(`${baseUrl}/lightning/page/home`)
      await expect(page.locator('[id^="ultraforce-modal"]')).toBeAttached()
      await waitForContentScript(context, page)
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+b' : 'Control+b')
      const dialog = page.getByRole('dialog', { name: chinese ? 'UltraForce 搜索' : 'UltraForce search' })
      await expect(dialog).toBeVisible()
      await expect(dialog).toHaveAttribute('lang', chinese ? 'zh-CN' : 'en')
      const input = page.getByRole('combobox', {
        name: chinese ? '搜索 Salesforce 元数据' : 'Search Salesforce metadata'
      })
      await expect(input).toHaveAttribute('placeholder', chinese ? '搜索 locale 元数据…' : 'Search locale metadata...')
      await input.pressSequentially(':f')
      await expect(input).toHaveValue(':f')
      await expect(dialog.getByRole('heading', { name: chinese ? '命令' : 'Commands' })).toBeVisible()
      await input.press('Space')
      const flowScope = dialog.getByTitle(chinese ? '流程' : 'Flows', { exact: true })
      await expect(flowScope).toBeVisible()
      await expect(input).toHaveValue('')
      await expect(input).toHaveAccessibleDescription(chinese ? '范围：流程' : 'Scope: Flows')
      await dialog.focus()
      await flowScope.click()
      await expect(input).toBeFocused()
      await input.pressSequentially('case')
      await expect(input).toHaveValue('case')
      await expect(dialog.getByText(chinese ? '在 流程 中没有找到 "case"' : 'No Flows found for "case"')).toBeVisible()
      await input.selectText()
      await input.press('Backspace')
      await expect(input).toHaveValue('')
      await expect(flowScope).toBeVisible()
      await input.press('Backspace')
      await expect(flowScope).toHaveCount(0)
      await input.pressSequentially(':fixture acme')
      await expect(dialog.getByTitle('Objects & Fields', { exact: true })).toBeVisible()
      await expect(input).toHaveValue('acme')
      await input.selectText()
      await input.press('Backspace')
      await expect(input).toHaveValue('')
      await input.press('Backspace')
      const settingsButton = dialog.getByRole('button', { name: chinese ? '设置' : 'Settings', exact: true })
      await expect(settingsButton).toBeVisible()
      await settingsButton.evaluate(async (button) => {
        await Promise.all(button.getAnimations().map((animation) => animation.finished))
      })
      const settingsPosition = (await settingsButton.boundingBox())!
      await settingsButton.click()
      await expect(page.getByRole('heading', { name: chinese ? '设置' : 'Settings', exact: true })).toBeVisible()
      await expect(
        page.getByRole('checkbox', { name: chinese ? '对象及字段' : 'Objects & Fields', exact: true })
      ).toBeVisible()
      await expect(page.locator('.command-row:not(.command-row-builtin) .command-desc')).toHaveText('Objects & Fields')
      await expect(page.getByRole('link', { name: chinese ? '隐私' : 'Privacy', exact: true })).toBeVisible()
      const closeSettings = dialog.getByRole('button', { name: chinese ? '关闭设置' : 'Close settings', exact: true })
      await expect(closeSettings).toBeVisible()
      await expect(closeSettings).toHaveAttribute('aria-pressed', 'true')
      await expect
        .poll(async () => {
          const position = (await closeSettings.boundingBox())!
          return Math.hypot(position.x - settingsPosition.x, position.y - settingsPosition.y)
        })
        .toBeLessThan(0.1)
      await expect(dialog.getByRole('button', { name: chinese ? '返回' : 'Back', exact: true })).toHaveCount(0)
      await page.keyboard.press('Shift+Tab')
      await expect(closeSettings).toBeFocused()
      if (chinese) await page.screenshot({ path: '/tmp/ultraforce-i18n-chinese-settings.png' })
      await closeSettings.click()
      await expect(input).toBeFocused()
      await expect(settingsButton).toBeVisible()
    } finally {
      await context.close()
      rmSync(profile, { recursive: true, force: true })
    }
  })
}
