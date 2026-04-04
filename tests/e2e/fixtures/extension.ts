import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test'
import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import os from 'os'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export interface OrgInfo {
  accessToken: string
  instanceUrl: string
  username: string
}

function stripAnsi(str: string): string {
  return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
}

export function getOrgInfo(targetOrg: string): OrgInfo {
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

export function getFrontdoorUrl(orgInfo: OrgInfo): string {
  const encodedToken = encodeURIComponent(orgInfo.accessToken)
  return `${orgInfo.instanceUrl}/secur/frontdoor.jsp?sid=${encodedToken}`
}

// Shared state across all tests in a worker
let sharedContext: BrowserContext | null = null
let sharedPage: Page | null = null
let sharedBaseUrl: string = ''
let sharedOrgInfo: OrgInfo | null = null
let sharedUserDataDir: string = ''

async function ensureContext() {
  if (sharedContext) return { context: sharedContext, page: sharedPage!, baseUrl: sharedBaseUrl, orgInfo: sharedOrgInfo! }

  sharedOrgInfo = getOrgInfo('ultraforce')
  const extensionPath = path.resolve(__dirname, '../../../build/chrome-mv3-prod')
  sharedUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ultraforce-test-'))

  sharedContext = await chromium.launchPersistentContext(sharedUserDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox',
      '--disable-gpu'
    ]
  })

  sharedPage = await sharedContext.newPage()

  // Login to Salesforce
  const frontdoorUrl = getFrontdoorUrl(sharedOrgInfo)
  await sharedPage.goto(frontdoorUrl)
  // Wait for redirect to complete - URL may already contain salesforce
  await sharedPage.waitForURL(/.*salesforce/, { timeout: 30000 }).catch(() => {})
  await sharedPage.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {})

  // Navigate to home page
  const currentUrl = sharedPage.url()
  const match = currentUrl.match(/https:\/\/([^/]+)/)
  if (match) {
    const domain = match[1].replace('salesforce-setup.com', 'lightning.force.com')
    sharedBaseUrl = `https://${domain}`
    const homeUrl = `${sharedBaseUrl}/lightning/page/home`
    await sharedPage.goto(homeUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
  }

  await sharedPage.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
  await sharedPage.waitForTimeout(5000)

  return { context: sharedContext, page: sharedPage, baseUrl: sharedBaseUrl, orgInfo: sharedOrgInfo }
}

export type TestFixtures = {
  extensionPage: Page
  extensionContext: BrowserContext
  baseUrl: string
  orgInfo: OrgInfo
}

export const test = base.extend<TestFixtures>({
  extensionContext: async ({}, use) => {
    const { context } = await ensureContext()
    await use(context)
  },
  extensionPage: async ({}, use) => {
    const { page } = await ensureContext()
    await use(page)
  },
  baseUrl: async ({}, use) => {
    const { baseUrl } = await ensureContext()
    await use(baseUrl)
  },
  orgInfo: async ({}, use) => {
    const { orgInfo } = await ensureContext()
    await use(orgInfo)
  }
})

export { expect } from '@playwright/test'

// Cleanup hook - called when the worker is done
test.afterAll(async () => {
  if (sharedContext) {
    await sharedContext.close()
    sharedContext = null
    sharedPage = null
  }
  if (sharedUserDataDir) {
    try {
      fs.rmSync(sharedUserDataDir, { recursive: true, force: true })
    } catch {}
  }
})
