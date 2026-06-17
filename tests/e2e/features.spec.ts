import { test, expect } from './fixtures/extension'
import { UltraForcePage } from './pages/ultraforce.page'

test.describe('Features', () => {
  let uf: UltraForcePage

  test.beforeAll(async ({ extensionPage, extensionContext, baseUrl }) => {
    uf = new UltraForcePage(extensionPage, extensionContext, baseUrl)
  })

  test('extension container should be loaded', async () => {
    await uf.openModal()
    await uf.wait(500)
    const info = await uf.getContainerInfo()
    await uf.closeModal()
    expect(info.hasContainer).toBe(true)
    expect(info.containerId).toContain('ultraforce-modal')
  })

  test('open modal with Meta+b shortcut', async () => {
    await uf.openModal()
    await uf.typeText('test')
    await uf.wait(500)
    await uf.closeModal()
  })

  test('search fields with dot notation', async () => {
    await uf.openModal()
    await uf.clearAndType('ASR_Hotel__c.')
    await uf.wait(2000)
    const names = await uf.resultNames()
    await uf.closeModal()
    // Regression: escapeSoql over-escaped '_' in the '=' field query, so fields
    // for underscore-named objects (ASR_*, IC_*) never loaded. Assert real fields show.
    expect(names).toContain('City')
    expect(names).toContain('Location')
  })

  test('autocomplete with Tab key', async () => {
    await uf.openModal()
    await uf.clearAndType(':o ASR')
    await uf.wait(1500)
    await uf.pressKey('ArrowDown')
    await uf.wait(200)
    await uf.pressKey('Tab')
    await uf.wait(500)
    await uf.closeModal()
  })

  test('Tab on :o result triggers dot-notation field search and navigates', async () => {
    await uf.openModal()
    await uf.clearAndType(':o ASR')
    await uf.wait(1500)
    await uf.pressKey('ArrowDown')
    await uf.wait(200)

    // Tab to autocomplete into "ASR_xxx__c." (field search)
    // Then navigate a field result to verify fields loaded
    const result = await uf.tabThenNavigateNewTab(3000)
    expect(result.opened).toBe(true)
    expect(result.url).toMatch(/\.(salesforce|force)\.com/)
    await uf.closeModal()
  })

  test('Tab on :p Profile triggers sub-menu autocomplete', async () => {
    await uf.openModal()
    await uf.clearAndType(':p System Administrator')
    await uf.wait(3000)

    // Tab should autocomplete to "System Administrator." and trigger sub-menu
    await uf.pressKey('Tab')
    await uf.wait(2000)

    // Verify the modal is still open (Tab should not close it)
    const isOpen = await uf.isShieldActive()
    expect(isOpen).toBe(true)
    await uf.closeModal()
  })

  test('Profile sub-menu Enter navigates to Profile setup page', async () => {
    await uf.openModal()
    await uf.clearAndType(':p System Administrator.')
    await uf.wait(2000)

    // Arrow down to a navigable ProfileSetupLink item
    for (let i = 0; i < 8; i++) {
      await uf.pressKey('ArrowDown')
      await uf.wait(100)
    }

    const result = await uf.pressEnterAndWaitForNewTab()
    expect(result.opened).toBe(true)
    expect(result.url).toMatch(/Profiles|EnhancedProfiles/)
    await uf.closeModal()
  })

  test('navigate results with arrow keys', async () => {
    await uf.openModal()
    await uf.clearAndType(':o')
    await uf.wait(2000)
    await uf.pressKey('ArrowDown')
    await uf.wait(200)
    await uf.pressKey('ArrowDown')
    await uf.wait(200)
    await uf.pressKey('ArrowUp')
    await uf.wait(200)
    await uf.closeModal()
  })

  test('close modal with Escape', async () => {
    await uf.openModal()
    await uf.typeText('test')
    await uf.wait(500)
    await uf.pressKey('Escape')
    await uf.wait(500)
  })

  test('handle empty search query', async () => {
    await uf.openModal()
    await uf.wait(1000)
    await uf.closeModal()
  })

  test('show command hints when typing colon', async () => {
    await uf.openModal()
    await uf.clearAndType(':')
    await uf.wait(1000)
    await uf.closeModal()
  })

  test('fuzzy search matches misspelled query', async () => {
    await uf.openModal()
    await uf.clearAndType('Acount')
    await uf.wait(2000)
    await uf.closeModal()
  })

  test('handle special characters in search', async () => {
    await uf.openModal()
    await uf.clearAndType('Test__c')
    await uf.wait(1500)
    await uf.closeModal()
  })

  test('handle rapid open/close', async () => {
    for (let i = 0; i < 3; i++) {
      await uf.pressKey('Meta+b')
      await uf.wait(300)
      await uf.pressKey('Escape')
      await uf.wait(300)
    }
  })

  test('handle multiple search queries in sequence', async () => {
    await uf.openModal()
    await uf.clearAndType(':o ASR_Hotel')
    await uf.wait(1500)
    await uf.clearAndType(':u Dormon')
    await uf.wait(1500)
    await uf.clearAndType(':c Weather')
    await uf.wait(1500)
    await uf.closeModal()
  })
})
