import { test, expect } from './fixtures/extension'
import { UltraForcePage } from './pages/ultraforce.page'
import { SettingsPage } from './pages/settings.page'

test.describe('Navigation - Setup Shortcuts', () => {
  let uf: UltraForcePage

  test.beforeAll(async ({ extensionPage, extensionContext, baseUrl }) => {
    uf = new UltraForcePage(extensionPage, extensionContext, baseUrl)
  })

  test(':g users', async () => {
    const result = await uf.navigateSetupShortcut('users')
    expect(result.opened).toBe(true)
    expect(result.url).toMatch(/lightning\/setup\/ManageUsers/)
  })

  test(':g apex class', async () => {
    const result = await uf.navigateSetupShortcut('apex class')
    expect(result.opened).toBe(true)
    expect(result.url).toMatch(/lightning\/setup\/ApexClasses/)
  })

  test(':g debug', async () => {
    const result = await uf.navigateSetupShortcut('debug')
    expect(result.opened).toBe(true)
    expect(result.url).toMatch(/lightning\/setup\/ApexDebugLogs/)
  })

  test(':g permission set', async () => {
    const result = await uf.navigateSetupShortcut('permission set')
    expect(result.opened).toBe(true)
    expect(result.url).toMatch(/lightning\/setup\/PermSets/)
  })
})

test.describe('Navigation - Lightning Mode', () => {
  let uf: UltraForcePage

  test.beforeAll(async ({ extensionPage, extensionContext, baseUrl }) => {
    uf = new UltraForcePage(extensionPage, extensionContext, baseUrl)
  })

  test('ASR_Hotel object list view', async () => {
    const result = await uf.searchAndNavigateNewTab(':o ASR_Hotel')
    expect(result.opened).toBe(true)
    expect(result.url).toMatch(/lightning\/o\/.*ASR.*\/list/i)
  })

  test('Dormon user setup page', async () => {
    const result = await uf.searchAndNavigateNewTab(':u Dormon')
    expect(result.opened).toBe(true)
    expect(result.url).toMatch(/lightning\/setup\/ManageUsers\/page\?address/)
  })

  test('WeatherService apex class', async () => {
    const result = await uf.searchAndNavigateNewTab(':c Weather')
    expect(result.opened).toBe(true)
    expect(result.url).toMatch(/lightning\/setup\/ApexClasses\/page\?address/)
  })

  test('CreateCase flow builder', async () => {
    const result = await uf.searchAndNavigateNewTab(':f Create')
    expect(result.opened).toBe(true)
    expect(result.url).toMatch(/flowBuilder\.app\?flowId/)
  })

  test('System Administrator profile', async () => {
    const result = await uf.searchAndNavigateNewTab(':p System Administrator')
    expect(result.opened).toBe(true)
    expect(result.url).toMatch(/lightning\/setup\/EnhancedProfiles\/page\?address/)
  })
})

test.describe('Navigation - Classic Mode', () => {
  let uf: UltraForcePage
  let settings: SettingsPage

  test.beforeAll(async ({ extensionPage, extensionContext, baseUrl }) => {
    uf = new UltraForcePage(extensionPage, extensionContext, baseUrl)
    settings = new SettingsPage(extensionContext)
    // Switch to classic mode
    await settings.setNavigationMode('classic')
    // Reopen modal to pick up setting change
    await uf.openModal()
    await uf.closeModal()
    await uf.wait(500)
  })

  test.afterAll(async ({ extensionContext }) => {
    // Restore default navigation mode
    const settings = new SettingsPage(extensionContext)
    await settings.setNavigationMode('auto')
  })

  test('ASR_Hotel object in classic mode', async () => {
    const result = await uf.searchAndNavigateNewTab(':o ASR_Hotel')
    expect(result.opened).toBe(true)
    // Classic: custom object uses DurableId (01I...) for setup page
    expect(result.url).toMatch(/01I[a-zA-Z0-9]+/)
  })

  test('Dormon user in classic mode', async () => {
    const result = await uf.searchAndNavigateNewTab(':u Dormon')
    expect(result.opened).toBe(true)
    // Classic: /{userId} or /lightning/_classic/%2F005xxx
    expect(result.url).toMatch(/005[a-zA-Z0-9]+/)
  })

  test('WeatherService apex class in classic mode', async () => {
    const result = await uf.searchAndNavigateNewTab(':c Weather')
    expect(result.opened).toBe(true)
    // Classic: /{apexClassId} or /lightning/_classic/%2F01pxxx
    expect(result.url).toMatch(/01p[a-zA-Z0-9]+/)
  })

  test('CreateCase flow in classic mode', async () => {
    const result = await uf.searchAndNavigateNewTab(':f Create')
    expect(result.opened).toBe(true)
    // Flow URL is the same in both modes
    expect(result.url).toMatch(/flowBuilder\.app\?flowId/)
  })

  test('System Administrator profile in classic mode', async () => {
    const result = await uf.searchAndNavigateNewTab(':p System Administrator')
    expect(result.opened).toBe(true)
    // Classic: /{profileId} or /lightning/_classic/%2F00exxx
    expect(result.url).toMatch(/00e[a-zA-Z0-9]+/)
  })
})
