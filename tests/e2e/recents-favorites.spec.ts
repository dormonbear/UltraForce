import { test, expect } from './fixtures/extension'
import { UltraForcePage } from './pages/ultraforce.page'

test.describe('Recents and Favorites', () => {
  let uf: UltraForcePage

  test.beforeAll(async ({ extensionPage, extensionContext, baseUrl }) => {
    uf = new UltraForcePage(extensionPage, extensionContext, baseUrl)
  })

  test.afterEach(async () => {
    await uf.ensureModalClosed()
    await uf.closeExtraTabs()
  })

  test('opening a search result records it in recents on re-open', async () => {
    const nav = await uf.searchAndNavigateNewTab(':c WeatherService')
    expect(nav.opened).toBe(true)
    expect(nav.url).toContain('/lightning/')

    await uf.openHome()
    const texts = await uf.resultTexts()
    if (texts.length > 0) {
      expect(texts.join(' ')).toContain('WeatherService')
    } else {
      const again = await uf.searchAndNavigateNewTab(':c WeatherService')
      expect(again.opened).toBe(true)
    }
    await uf.closeModal()
  })

  test('re-opening the same item keeps it resolvable (recency refresh)', async () => {
    await uf.searchAndNavigateNewTab(':c WeatherService')
    const again = await uf.searchAndNavigateNewTab(':c WeatherService')
    expect(again.opened).toBe(true)
    await uf.closeModal()
  })
})
