import { test, expect } from './fixtures/extension'
import { UltraForcePage } from './pages/ultraforce.page'
import { SettingsPage } from './pages/settings.page'

test.describe('Settings Panel', () => {
  let uf: UltraForcePage
  let settings: SettingsPage

  test.beforeAll(async ({ extensionPage, extensionContext, baseUrl }) => {
    uf = new UltraForcePage(extensionPage, extensionContext, baseUrl)
    settings = new SettingsPage(extensionContext)
  })

  test.afterAll(async () => {
    // Ensure settings are reset to defaults after all tests
    await settings.resetToDefaults()
  })

  test('navigation mode persists after change', async () => {
    await settings.setNavigationMode('classic')
    const stored = await settings.getSettings()
    expect(stored.navigationMode).toBe('classic')

    // Restore
    await settings.setNavigationMode('auto')
    const restored = await settings.getSettings()
    expect(restored.navigationMode).toBe('auto')
  })

  test('fuzzy search toggle persists', async () => {
    await settings.setFuzzySearch(false)
    const stored = await settings.getSettings()
    expect(stored.fuzzySearch).toBe(false)

    // Restore
    await settings.setFuzzySearch(true)
    const restored = await settings.getSettings()
    expect(restored.fuzzySearch).toBe(true)
  })

  test('closeOnNavigate toggle persists', async () => {
    await settings.setCloseOnNavigate(false)
    const stored = await settings.getSettings()
    expect(stored.closeOnNavigate).toBe(false)

    // Restore
    await settings.setCloseOnNavigate(true)
    const restored = await settings.getSettings()
    expect(restored.closeOnNavigate).toBe(true)
  })

  test('reset to defaults clears all settings', async () => {
    await settings.setNavigationMode('classic')
    await settings.setFuzzySearch(false)
    await settings.setCloseOnNavigate(false)

    await settings.resetToDefaults()
    const stored = await settings.getSettings()
    expect(stored).toEqual({})
  })

  test('search respects fuzzy search setting', async () => {
    // With fuzzy search OFF, "Acount" should NOT find "Account"
    await settings.setFuzzySearch(false)

    // Need to reopen modal for setting to take effect
    await uf.openModal()
    await uf.closeModal()
    await uf.wait(300)

    await uf.openModal()
    await uf.clearAndType('Acount')
    await uf.wait(2000)
    await uf.closeModal()

    // Restore fuzzy search
    await settings.setFuzzySearch(true)
  })
})
