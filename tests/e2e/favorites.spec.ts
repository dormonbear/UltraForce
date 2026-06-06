import { test, expect } from './fixtures/extension'
import { UltraForcePage } from './pages/ultraforce.page'

// Favorites E2E: pin a search result, verify it persists onto the home-screen
// Favorites section after reopening the modal, then unpin it from the home screen.
//
// Requires an open-shadow build (PLASMO_PUBLIC_E2E=true, `pnpm build:e2e`) so
// Playwright locators can pierce the modal's shadow root.

test.describe('Favorites', () => {
  let uf: UltraForcePage

  test.beforeAll(async ({ extensionPage, extensionContext, baseUrl }) => {
    uf = new UltraForcePage(extensionPage, extensionContext, baseUrl)
  })

  test.afterEach(async () => {
    await uf.ensureModalClosed()
    await uf.closeExtraTabs()
  })

  test('pin a result, persist on home screen, then unpin', async () => {
    // 1. Open modal, search for WeatherService and ensure it is unpinned to start.
    await uf.openModal()
    await uf.clearAndType(':c WeatherService')
    await uf.wait(1500)

    const names = await uf.resultNames()
    expect(names).toContain('WeatherService')

    // Reset to a known unpinned state if a previous run left it pinned.
    if ((await uf.pinTitleOnRow('WeatherService')) === 'Remove from favorites') {
      await uf.togglePinOnRow('WeatherService')
    }
    expect(await uf.pinTitleOnRow('WeatherService')).toBe('Pin to favorites')

    // 1a. Pin the WeatherService row; the button should toggle to "Remove from favorites".
    await uf.togglePinOnRow('WeatherService')
    expect(await uf.pinTitleOnRow('WeatherService')).toBe('Remove from favorites')

    // 2. Reopen the modal on the empty/home state and assert the favorite shows
    //    in the home-screen Favorites section.
    await uf.closeModal()
    await uf.openModal()
    await uf.wait(1000)

    expect(await uf.rawPage.locator('.home-screen').count()).toBe(1)
    const favHeaders = await uf.rawPage.locator('.home-section-header').allTextContents()
    expect(favHeaders).toContain('Favorites')
    expect(await uf.homeFavoriteNames()).toContain('WeatherService')
    expect(await uf.rawPage.getByTitle('Unpin').count()).toBeGreaterThan(0)

    // 3. Unpin from the home screen and assert it is removed from Favorites.
    await uf.unpinFromHome('WeatherService')
    expect(await uf.homeFavoriteNames()).not.toContain('WeatherService')
    expect(await uf.rawPage.getByTitle('Unpin').count()).toBe(0)

    await uf.closeModal()
  })
})
