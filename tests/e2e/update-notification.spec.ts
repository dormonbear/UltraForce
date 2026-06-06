import { test, expect } from './fixtures/extension'
import { UltraForcePage } from './pages/ultraforce.page'
import { SettingsPage } from './pages/settings.page'

// The UpdateNotification banner (.update-celebration) is shown when checkForUpdate()
// reports an update: the stored lastVersion is non-empty AND differs from the current
// manifest version AND hasShownNotification is false. The check runs once per
// SearchModal mount when the modal first becomes visible, so we reload the page after
// seeding to guarantee a fresh content-script + SearchModal mount before opening it.
test.describe('Version Update Notification', () => {
  let uf: UltraForcePage
  let settings: SettingsPage

  test.beforeAll(async ({ extensionPage, extensionContext, baseUrl }) => {
    uf = new UltraForcePage(extensionPage, extensionContext, baseUrl)
    settings = new SettingsPage(extensionContext)
  })

  test.afterAll(async () => {
    await settings.clearVersionCheck()
  })

  test('shows celebration banner after an update and dismisses it', async () => {
    // 1. Seed an older last-seen version so the extension thinks it just updated.
    await settings.seedLastVersion('0.0.1')
    const manifestVersion = await settings.getManifestVersion()

    // 2. Reload so the content script re-evaluates with a fresh SearchModal mount.
    await uf.goHome()
    await uf.openModal()

    // 3. Banner is visible and reflects the real manifest version.
    const banner = uf.rawPage.locator('.update-celebration')
    await expect(banner).toBeVisible({ timeout: 5000 })
    await expect(banner).toContainText('Updated to v')
    await expect(banner).toContainText(`Updated to v${manifestVersion}`)

    // Release Notes link is present.
    await expect(banner.getByRole('link', { name: /Release Notes/ })).toBeVisible()

    // 4. Dismiss -> banner disappears.
    await banner.getByTitle('Dismiss').click()
    await expect(banner).toHaveCount(0, { timeout: 5000 })

    // markNotificationAsShown() should have persisted the current version.
    const state = await settings.getVersionCheckState()
    expect(state?.lastVersion).toBe(manifestVersion)
    expect(state?.hasShownNotification).toBe(true)
  })

  test('does not show again after dismissal', async () => {
    // State now has hasShownNotification: true at the current version, so reopening
    // (even with a fresh mount) must not show the banner again.
    await uf.closeModal()
    await uf.goHome()
    await uf.openModal()

    await expect(uf.rawPage.locator('.update-celebration')).toHaveCount(0)
    await uf.closeModal()
  })
})
