import { test, expect } from './fixtures/extension'
import { UltraForcePage } from './pages/ultraforce.page'
import { SettingsPage } from './pages/settings.page'

// Settings UI custom-command CRUD E2E: drives the real SettingsPanel form via
// clicks (Add -> fill -> Save -> Delete), rather than seeding chrome.storage.
//
// Requires an open-shadow build (PLASMO_PUBLIC_E2E=true, `pnpm build:e2e`) so
// Playwright locators can pierce the modal's shadow root.

test.describe('Settings UI custom command CRUD', () => {
  let uf: UltraForcePage
  let settings: SettingsPage

  test.beforeAll(async ({ extensionPage, extensionContext, baseUrl }) => {
    uf = new UltraForcePage(extensionPage, extensionContext, baseUrl)
    settings = new SettingsPage(extensionContext)
  })

  test.afterEach(async () => {
    await uf.ensureModalClosed()
    await uf.closeExtraTabs()
  })

  test.afterAll(async () => {
    // Clean up persisted custom commands so other E2E runs are not polluted.
    await settings.resetToDefaults()
  })

  test('add, then delete a custom command through the Settings UI', async () => {
    await uf.openModal()
    await uf.openSettings()

    // 1. Add a command through the form.
    await uf.clickAddCommand()
    await uf.fillCommandForm('zz', 'E2E Cmd', "SELECT Id, Name FROM Account WHERE Name LIKE '%{query}%'")

    expect(await uf.customCommandDescriptions()).toContain('E2E Cmd')

    // 2. Delete it (accepting the window.confirm dialog) and assert it is gone.
    uf.rawPage.once('dialog', (d) => d.accept())
    await uf.deleteCommandByDescription('E2E Cmd')

    expect(await uf.customCommandDescriptions()).not.toContain('E2E Cmd')
  })

  test('rejects a SOQL query missing the {query} placeholder', async () => {
    await uf.openModal()
    await uf.openSettings()

    await uf.clickAddCommand()
    await uf.fillCommandForm('yy', 'No Placeholder', 'SELECT Id, Name FROM Account')

    const panel = uf.settingsPanel()
    await expect(panel.locator('.command-form-error')).toHaveText('SOQL must contain {query} placeholder')
    expect(await uf.customCommandDescriptions()).not.toContain('No Placeholder')
  })
})
