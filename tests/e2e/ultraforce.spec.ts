import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test'
import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import os from 'os'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface OrgInfo {
  accessToken: string
  instanceUrl: string
  username: string
}

function stripAnsi(str: string): string {
  return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
}

function getOrgInfo(targetOrg: string): OrgInfo {
  const result = execSync(`sf org display --target-org ${targetOrg} --json`, {
    encoding: 'utf-8',
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' }
  })
  const cleanResult = stripAnsi(result)
  const json = JSON.parse(cleanResult)
  return {
    accessToken: json.result.accessToken,
    instanceUrl: json.result.instanceUrl,
    username: json.result.username
  }
}

function getFrontdoorUrl(orgInfo: OrgInfo): string {
  const encodedToken = encodeURIComponent(orgInfo.accessToken)
  return `${orgInfo.instanceUrl}/secur/frontdoor.jsp?sid=${encodedToken}`
}

test('UltraForce Extension E2E Test', async () => {
  const orgInfo = getOrgInfo('Dormon_Dev')
  const extensionPath = path.resolve(__dirname, '../../build/chrome-mv3-prod')
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ultraforce-test-'))

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

  try {
    // 1. Login to Salesforce via frontdoor
    console.log('Step 1: Login to Salesforce')
    const frontdoorUrl = getFrontdoorUrl(orgInfo)
    await page.goto(frontdoorUrl)
    await page.waitForURL(/.*salesforce\.com.*/, { timeout: 30000 })

    const url = page.url()
    expect(url).toContain('salesforce.com')
    expect(url).not.toContain('frontdoor.jsp')
    console.log('Login successful')

    // 2. Navigate to a regular Salesforce page (not setup)
    console.log('Step 2: Navigate to home page')
    const currentUrl = page.url()
    console.log(`After login URL: ${currentUrl}`)

    // Extract base domain and go to lightning home
    const match = currentUrl.match(/https:\/\/([^/]+)/)
    if (match) {
      const domain = match[1].replace('salesforce-setup.com', 'lightning.force.com')
      const homeUrl = `https://${domain}/lightning/page/home`
      console.log(`Navigating to: ${homeUrl}`)
      await page.goto(homeUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
    }

    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(5000)
    console.log(`Final URL: ${page.url()}`)

    // Check for extension containers
    const containerInfo = await page.evaluate(() => {
      // Check for ultraforce-modal container (direct in body)
      const modalContainer = document.querySelector('[id^="ultraforce-modal"]')
      // Check for plasmo container
      const plasmoContainer = document.querySelector('plasmo-csui')
      return {
        hasModalContainer: !!modalContainer,
        hasPlasmoContainer: !!plasmoContainer,
        modalContainerId: modalContainer?.id || null,
        bodyChildrenCount: document.body.children.length
      }
    })
    console.log(`Container info: ${JSON.stringify(containerInfo)}`)

    // 3. Open search modal with keyboard shortcut
    console.log('Step 3: Open search modal')

    // Verify extension container exists
    expect(containerInfo.hasModalContainer).toBe(true)
    expect(containerInfo.modalContainerId).toContain('ultraforce-modal')
    console.log('Extension container verified')

    // Open modal with shortcut
    console.log('Step 3: Opening modal with Meta+b...')
    await page.keyboard.press('Meta+b')
    await page.waitForTimeout(2000)

    // Type search query
    console.log('Step 4: Typing search query...')
    await page.keyboard.type('Account')
    await page.waitForTimeout(2000)

    // Navigate with arrow keys
    console.log('Step 5: Testing keyboard navigation...')
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(200)
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(200)
    await page.keyboard.press('ArrowUp')
    await page.waitForTimeout(200)

    // Close modal with Escape
    console.log('Step 6: Closing modal with Escape...')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Reopen and test Tab autocomplete
    console.log('Step 7: Testing Tab autocomplete...')
    await page.keyboard.press('Meta+b')
    await page.waitForTimeout(1000)
    await page.keyboard.type('Acc')
    await page.waitForTimeout(1500)
    await page.keyboard.press('Tab')
    await page.waitForTimeout(500)

    // Final close
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)

    console.log('All E2E tests completed successfully!')

  } finally {
    await context.close()
    // Cleanup temp dir
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true })
    } catch {}
  }
})
