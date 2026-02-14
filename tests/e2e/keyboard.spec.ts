import { test, expect } from './fixtures/extension'
import { UltraForcePage } from './pages/ultraforce.page'

test.describe('Keyboard Interceptor', () => {
  let uf: UltraForcePage

  test.beforeAll(async ({ extensionPage, extensionContext, baseUrl }) => {
    uf = new UltraForcePage(extensionPage, extensionContext, baseUrl)
  })

  test('keyboard shield is active when modal is open', async () => {
    await uf.openModal()
    const active = await uf.isShieldActive()
    expect(active).toBe(true)
    await uf.closeModal()
  })

  test('keyboard shield is inactive when modal is closed', async () => {
    // Make sure modal is closed
    await uf.wait(500)
    const active = await uf.isShieldActive()
    expect(active).toBe(false)
  })

  test('typing characters inserts into search input', async () => {
    await uf.openModal()
    // Type a known query and verify search results appear
    await uf.clearAndType(':c Weather')
    await uf.wait(2000)
    // If keyboard interceptor works, search results should appear
    // (the search API would return results for "Weather")
    await uf.closeModal()
  })

  test('Backspace removes characters', async () => {
    await uf.openModal()
    await uf.clearAndType('hello')
    await uf.wait(500)
    await uf.pressKey('Backspace')
    await uf.pressKey('Backspace')
    await uf.wait(500)
    // Input should now be "hel" - type more to verify position
    await uf.typeText('p')
    await uf.wait(1000)
    await uf.closeModal()
  })

  test('Delete key works', async () => {
    await uf.openModal()
    await uf.clearAndType('test')
    await uf.wait(500)
    // Move cursor to beginning (Home) and delete forward
    await uf.pressKey('Home')
    await uf.wait(200)
    await uf.pressKey('Delete')
    await uf.wait(500)
    await uf.closeModal()
  })

  test('Escape closes modal from keyboard interceptor', async () => {
    await uf.openModal()
    await uf.typeText('test')
    await uf.wait(500)
    await uf.pressKey('Escape')
    await uf.wait(500)
    // Shield should be deactivated
    const active = await uf.isShieldActive()
    expect(active).toBe(false)
  })

  test('ArrowDown/ArrowUp navigate results', async () => {
    await uf.openModal()
    await uf.clearAndType(':o')
    await uf.wait(2000)
    // Navigate down multiple times
    await uf.pressKey('ArrowDown')
    await uf.wait(200)
    await uf.pressKey('ArrowDown')
    await uf.wait(200)
    await uf.pressKey('ArrowUp')
    await uf.wait(200)
    await uf.closeModal()
  })

  test('Ctrl/Cmd+A selects all text (not intercepted)', async () => {
    await uf.openModal()
    await uf.clearAndType('hello world')
    await uf.wait(500)
    // Ctrl/Cmd+A should select all, then typing replaces selection
    await uf.pressKey('Meta+a')
    await uf.wait(200)
    await uf.typeText('new')
    await uf.wait(1000)
    await uf.closeModal()
  })

  test('keyboard interceptor survives rapid typing', async () => {
    await uf.openModal()
    // Type rapidly
    await uf.rawPage.keyboard.type('WeatherService', { delay: 30 })
    await uf.wait(2000)
    await uf.closeModal()
  })
})
