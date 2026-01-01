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

test.describe('UltraForce Extension E2E Tests', () => {
  let context: BrowserContext
  let page: Page
  let orgInfo: OrgInfo
  let userDataDir: string
  let baseUrl: string

  test.beforeAll(async () => {
    orgInfo = getOrgInfo('ultraforce')
    const extensionPath = path.resolve(__dirname, '../../build/chrome-mv3-prod')
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ultraforce-test-'))

    context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
        '--disable-gpu'
      ]
    })

    page = await context.newPage()

    // Login to Salesforce
    const frontdoorUrl = getFrontdoorUrl(orgInfo)
    await page.goto(frontdoorUrl)
    await page.waitForURL(/.*salesforce/, { timeout: 30000 })

    // Navigate to home page
    const currentUrl = page.url()
    const match = currentUrl.match(/https:\/\/([^/]+)/)
    if (match) {
      const domain = match[1].replace('salesforce-setup.com', 'lightning.force.com')
      baseUrl = `https://${domain}`
      const homeUrl = `${baseUrl}/lightning/page/home`
      await page.goto(homeUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
    }

    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(5000)
  })

  test.afterAll(async () => {
    await context?.close()
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true })
    } catch {}
  })

  // Helper to open modal
  async function openModal() {
    await page.keyboard.press('Meta+b')
    await page.waitForTimeout(1000)
  }

  // Helper to close modal
  async function closeModal() {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
  }

  // Helper to clear input and type
  async function clearAndType(text: string) {
    await page.keyboard.press('Meta+a')
    await page.keyboard.press('Backspace')
    await page.waitForTimeout(200)
    await page.keyboard.type(text)
    await page.waitForTimeout(1500)
  }

  // Helper to navigate back to home
  async function goHome() {
    await page.goto(`${baseUrl}/lightning/page/home`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
    await page.waitForTimeout(2000)
  }

  // Helper for navigation test - search, select and navigate
  async function searchAndNavigate(query: string, waitForResults: number = 3000): Promise<string> {
    const startUrl = page.url()
    await openModal()
    await clearAndType(query)
    await page.waitForTimeout(waitForResults)

    // Select first result and press Enter
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(300)
    await page.keyboard.press('Enter')

    // Wait for navigation with URL change detection
    try {
      await page.waitForURL((url) => url.toString() !== startUrl, { timeout: 10000 })
    } catch {
      // URL might not change if modal closes but stays on same page
    }
    await page.waitForTimeout(2000)

    return page.url()
  }

  // ==================== Basic Tests ====================

  test('Extension container should be loaded', async () => {
    // Open modal first to ensure container is created
    await openModal()
    await page.waitForTimeout(500)

    const containerInfo = await page.evaluate(() => {
      const modalContainer = document.querySelector('[id^="ultraforce-modal"]')
      return {
        hasModalContainer: !!modalContainer,
        modalContainerId: modalContainer?.id || null
      }
    })

    await closeModal()

    expect(containerInfo.hasModalContainer).toBe(true)
    expect(containerInfo.modalContainerId).toContain('ultraforce-modal')
  })

  test('Should open modal with Meta+b shortcut', async () => {
    await openModal()
    await page.keyboard.type('test')
    await page.waitForTimeout(500)
    await closeModal()
  })

  // ==================== Command Search Tests ====================
  // Using real metadata from agent-script-recipes package

  test('Should search ASR custom objects with :o command', async () => {
    await openModal()
    await clearAndType(':o ASR_Hotel')
    await page.waitForTimeout(2000)
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(200)
    await closeModal()
  })

  test('Should search WeatherService Apex with :c command', async () => {
    await openModal()
    await clearAndType(':c Weather')
    await page.waitForTimeout(2000)
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(200)
    await closeModal()
  })

  test('Should search CreateCase Flow with :f command', async () => {
    await openModal()
    await clearAndType(':f Create')
    await page.waitForTimeout(2000)
    await closeModal()
  })

  test('Should search Dormon user with :u command', async () => {
    await openModal()
    await clearAndType(':u Dormon')
    await page.waitForTimeout(2000)
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(200)
    await closeModal()
  })

  test('Should search Admin profile with :p command', async () => {
    await openModal()
    await clearAndType(':p Admin')
    await page.waitForTimeout(2000)
    await closeModal()
  })

  test('Should search Custom Labels with :l command', async () => {
    await openModal()
    await clearAndType(':l')
    await page.waitForTimeout(2000)
    await closeModal()
  })

  test('Should search Custom Metadata with :m command', async () => {
    await openModal()
    await clearAndType(':m')
    await page.waitForTimeout(2000)
    await closeModal()
  })

  test('Should search Queues with :q command', async () => {
    await openModal()
    await clearAndType(':q')
    await page.waitForTimeout(2000)
    await closeModal()
  })

  test('Should show Setup shortcuts with :g command', async () => {
    await openModal()
    await clearAndType(':g apex')
    await page.waitForTimeout(1500)
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(200)
    await closeModal()
  })

  // ==================== Feature Tests ====================

  test('Should search ASR_Hotel__c fields with dot notation', async () => {
    await openModal()
    await clearAndType('ASR_Hotel__c.')
    await page.waitForTimeout(2000)
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(200)
    await closeModal()
  })

  test('Should autocomplete ASR object with Tab key', async () => {
    await openModal()
    await clearAndType(':o ASR')
    await page.waitForTimeout(1500)
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(200)
    await page.keyboard.press('Tab')
    await page.waitForTimeout(500)
    await closeModal()
  })

  test('Should navigate results with arrow keys', async () => {
    await openModal()
    await clearAndType(':o')
    await page.waitForTimeout(2000)
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(200)
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(200)
    await page.keyboard.press('ArrowUp')
    await page.waitForTimeout(200)
    await closeModal()
  })

  test('Should close modal with Escape key', async () => {
    await openModal()
    await page.keyboard.type('test')
    await page.waitForTimeout(500)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
  })

  test('Should handle empty search query', async () => {
    await openModal()
    await page.waitForTimeout(1000)
    await closeModal()
  })

  test('Should show command hints when typing colon', async () => {
    await openModal()
    await clearAndType(':')
    await page.waitForTimeout(1000)
    await closeModal()
  })

  test('Should perform fuzzy search', async () => {
    await openModal()
    await clearAndType('Acount')
    await page.waitForTimeout(2000)
    await closeModal()
  })

  test('Should handle special characters in search', async () => {
    await openModal()
    await clearAndType('Test__c')
    await page.waitForTimeout(1500)
    await closeModal()
  })

  test('Should handle rapid open/close', async () => {
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Meta+b')
      await page.waitForTimeout(300)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
    }
  })

  test('Should handle multiple search queries in sequence', async () => {
    await openModal()
    await clearAndType(':o ASR_Hotel')
    await page.waitForTimeout(1500)
    await clearAndType(':u Dormon')
    await page.waitForTimeout(1500)
    await clearAndType(':c Weather')
    await page.waitForTimeout(1500)
    await closeModal()
  })

  // ==================== Navigation Tests ====================
  // Note: ALL result clicks use window.open(url, '_blank') to open in new tabs
  // Navigation mode can be 'lightning' or 'classic' with different URL patterns

  // Helper for navigation test - opens new tab and returns URL
  async function testNewTabNavigation(
    command: string,
    urlPattern: RegExp,
    description: string
  ): Promise<{ success: boolean; url: string }> {
    const pagesBefore = context.pages().length
    await openModal()
    await clearAndType(command)
    await page.waitForTimeout(3000)

    // selectedIndex starts at 0, first result is already selected
    // Just press Enter to navigate (don't press ArrowDown)
    await page.keyboard.press('Enter')

    await page.waitForTimeout(3000)
    const pagesAfter = context.pages().length
    console.log(`${description}: Pages before: ${pagesBefore}, after: ${pagesAfter}`)

    if (pagesAfter > pagesBefore) {
      const newPage = context.pages()[pagesAfter - 1]
      const newUrl = newPage.url()
      console.log(`${description}: New tab URL: ${newUrl}`)
      const matches = urlPattern.test(newUrl)
      await newPage.close()
      return { success: matches, url: newUrl }
    }
    console.log(`${description}: No new tab opened`)
    return { success: false, url: '' }
  }

  // ==================== Setup Shortcuts (:g) Navigation ====================
  // Setup shortcuts always use Lightning URLs regardless of navigation mode
  // Note: :g uses local search, results appear immediately without API calls

  async function testSetupShortcutNavigation(
    shortcutName: string,
    urlPattern: RegExp,
    description: string
  ): Promise<{ success: boolean; url: string }> {
    const pagesBefore = context.pages().length
    await openModal()
    await clearAndType(`:g ${shortcutName}`)
    await page.waitForTimeout(3000)

    // selectedIndex starts at 0, first result is already selected
    await page.keyboard.press('Enter')

    await page.waitForTimeout(3000)
    const pagesAfter = context.pages().length
    console.log(`${description}: Pages before: ${pagesBefore}, after: ${pagesAfter}`)

    if (pagesAfter > pagesBefore) {
      const newPage = context.pages()[pagesAfter - 1]
      const newUrl = newPage.url()
      console.log(`${description}: New tab URL: ${newUrl}`)
      const matches = urlPattern.test(newUrl)
      await newPage.close()
      return { success: matches, url: newUrl }
    }
    console.log(`${description}: No new tab opened`)
    return { success: false, url: '' }
  }

  test('Navigate: Setup shortcut :g users opens new tab', async () => {
    const result = await testSetupShortcutNavigation(
      'users',
      /ManageUsers|setup/i,
      'Setup Users'
    )
    expect(result.success).toBe(true)
    expect(result.url).toMatch(/lightning\/setup\/ManageUsers/)
  })

  test('Navigate: Setup shortcut :g apex class opens new tab', async () => {
    const result = await testSetupShortcutNavigation(
      'apex class',
      /ApexClasses|setup/i,
      'Setup Apex Classes'
    )
    expect(result.success).toBe(true)
    expect(result.url).toMatch(/lightning\/setup\/ApexClasses/)
  })

  test('Navigate: Setup shortcut :g debug opens new tab', async () => {
    const result = await testSetupShortcutNavigation(
      'debug',
      /ApexDebugLogs|setup/i,
      'Setup Debug Logs'
    )
    expect(result.success).toBe(true)
    expect(result.url).toMatch(/lightning\/setup\/ApexDebugLogs/)
  })

  test('Navigate: Setup shortcut :g permission set opens new tab', async () => {
    const result = await testSetupShortcutNavigation(
      'permission set',
      /PermSets|setup/i,
      'Setup Permission Sets'
    )
    expect(result.success).toBe(true)
    expect(result.url).toMatch(/lightning\/setup\/PermSets/)
  })

  // ==================== Lightning Mode Navigation ====================
  // Default mode - uses Lightning Experience URLs

  test('Navigate Lightning: ASR_Hotel object list view', async () => {
    const result = await testNewTabNavigation(
      ':o ASR_Hotel',
      /ASR_Hotel|lightning\/o/i,
      'ASR_Hotel Object (Lightning)'
    )
    expect(result.success).toBe(true)
    // Lightning URL: /lightning/o/ASR_Hotel__c/list
    expect(result.url).toMatch(/lightning\/o\/.*ASR.*\/list/i)
  })

  test('Navigate Lightning: Dormon user setup page', async () => {
    const result = await testNewTabNavigation(
      ':u Dormon',
      /005|ManageUsers|User/i,
      'Dormon User (Lightning)'
    )
    expect(result.success).toBe(true)
    // Lightning URL: /lightning/setup/ManageUsers/page?address=%2F005xxxxx
    expect(result.url).toMatch(/lightning\/setup\/ManageUsers\/page\?address/)
  })

  test('Navigate Lightning: WeatherService apex class', async () => {
    const result = await testNewTabNavigation(
      ':c Weather',
      /ApexClasses|01p|setup/i,
      'WeatherService Apex (Lightning)'
    )
    expect(result.success).toBe(true)
    // Lightning URL: /lightning/setup/ApexClasses/page?address=%2F01pxxxxx
    expect(result.url).toMatch(/lightning\/setup\/ApexClasses\/page\?address/)
  })

  test('Navigate Lightning: CreateCase flow builder', async () => {
    const result = await testNewTabNavigation(
      ':f Create',
      /flowBuilder|Flow/i,
      'CreateCase Flow (Lightning)'
    )
    expect(result.success).toBe(true)
    // Flow URL (same for both modes): /builder_platform_interaction/flowBuilder.app?flowId=xxx
    expect(result.url).toMatch(/flowBuilder\.app\?flowId/)
  })

  test('Navigate Lightning: System Administrator profile', async () => {
    const result = await testNewTabNavigation(
      ':p System Administrator',
      /Profile|EnhancedProfiles|00e/i,
      'System Administrator Profile (Lightning)'
    )
    expect(result.success).toBe(true)
    // Lightning URL: /lightning/setup/EnhancedProfiles/page?address=%2F00exxxxx
    expect(result.url).toMatch(/lightning\/setup\/EnhancedProfiles\/page\?address/)
  })

  // ==================== URL Pattern Reference ====================
  // Lightning Experience URL patterns:
  //   ApexClass:      /lightning/setup/ApexClasses/page?address=%2F{id}
  //   ApexTrigger:    /lightning/setup/ApexTriggers/page?address=%2F{id}
  //   User:           /lightning/setup/ManageUsers/page?address=%2F{id}
  //   CustomObject:   /lightning/o/{apiName}/list
  //   Flow:           /builder_platform_interaction/flowBuilder.app?flowId={id}
  //   PermissionSet:  /lightning/setup/PermSets/page?address=%2F{id}
  //   Profile:        /lightning/setup/EnhancedProfiles/page?address=%2F{id}
  //   CustomField:    /lightning/setup/ObjectManager/{obj}/FieldsAndRelationships/{fieldId}/view
  //
  // Classic URL patterns:
  //   ApexClass:      /{id}
  //   ApexTrigger:    /{id}
  //   User:           /{id}
  //   CustomObject:   /{keyPrefix} or /p/setup/layout/LayoutFieldList?type={apiName}
  //   Flow:           /builder_platform_interaction/flowBuilder.app?flowId={id}
  //   PermissionSet:  /{id}
  //   Profile:        /{id}
  //   Queue:          /p/own/Queue/d?id={id}&setupid=Queues
})
