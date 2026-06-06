import { test, expect } from './fixtures/extension'
import { UltraForcePage } from './pages/ultraforce.page'
import { SettingsPage } from './pages/settings.page'

test.describe('Custom SOQL Commands', () => {
  let uf: UltraForcePage
  let settings: SettingsPage

  test.beforeAll(async ({ extensionPage, extensionContext, baseUrl }) => {
    uf = new UltraForcePage(extensionPage, extensionContext, baseUrl)
    settings = new SettingsPage(extensionContext)
  })

  test.afterAll(async () => {
    await settings.resetToDefaults()
  })

  test('a seeded custom command executes and navigates to an Apex class result', async () => {
    await settings.setCustomCommands({
      ac: {
        key: 'ac',
        description: 'Apex by name',
        soql: "SELECT Id, Name FROM ApexClass WHERE Name LIKE '%{query}%'",
        useToolingApi: true,
        isBuiltin: false,
        nameField: 'Name'
      }
    })

    // Reload the page so the content script re-injects and the settings store
    // re-hydrates with the seeded custom command from chrome.storage.local.
    await uf.goHome()

    await uf.openModal()
    await uf.closeModal()
    await uf.wait(500)

    const nav = await uf.searchAndNavigateNewTab(':ac Weather', 3000)
    expect(nav.opened).toBe(true)
    await uf.closeModal()
  })
})
