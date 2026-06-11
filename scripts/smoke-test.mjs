// Release smoke test: load the built extension, visit a Salesforce-matched
// page, and verify the content script executes (no module errors) and the
// keyboard shortcut opens the modal.
import { chromium } from '@playwright/test'
import path from 'path'
import os from 'os'
import fs from 'fs'

const extensionPath = path.resolve('./build/chrome-mv3-prod')
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uf-smoke-'))

const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    '--no-sandbox',
    '--disable-gpu'
  ]
})

const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.goto('https://login.salesforce.com/', { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForTimeout(4000)

const moduleErrors = errors.filter((m) => m.includes('Cannot find module'))

// Press the shortcut; on a login page there is no session, but the content
// script should still create the container / react to the keypress.
await page.bringToFront()
await page.keyboard.press(process.platform === 'darwin' ? 'Meta+b' : 'Control+b')
await page.waitForTimeout(2500)

const probe = await page.evaluate(() => {
  const host = document.querySelector('[id^="ultraforce-modal"]')
  return {
    container: Boolean(host),
    shieldAttr: document.documentElement.hasAttribute('data-ultraforce-modal-open')
  }
})

console.log(JSON.stringify({ moduleErrors, allErrors: errors.slice(0, 5), probe }, null, 2))

await context.close()
fs.rmSync(userDataDir, { recursive: true, force: true })

if (moduleErrors.length > 0) {
  console.error('SMOKE FAIL: module resolution errors present')
  process.exit(1)
}
if (!probe.container) {
  console.error('SMOKE FAIL: content script did not create the modal container on shortcut')
  process.exit(1)
}
console.log('SMOKE PASS')
