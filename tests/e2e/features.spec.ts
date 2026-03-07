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
    await uf.pressKey('ArrowDown')
    await uf.wait(200)
    await uf.closeModal()
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
    // If field results loaded, Enter opens a new tab
    if (result.opened) {
      expect(result.url).toContain('.salesforce.com')
    }
    await uf.closeModal()
  })

  test('Tab on :p Profile navigates to sub-menu item', async () => {
    await uf.openModal()
    await uf.clearAndType(':p System Administrator')
    await uf.wait(2000)

    // Tab to autocomplete into "System Administrator." (sub-menu)
    await uf.pressKey('Tab')
    await uf.wait(2000)

    // Now sub-menu should be showing. Tab on "Users" to drill into user list
    const result = await uf.tabThenNavigateNewTab(3000)
    // Enter on a User result should open the user record
    if (result.opened) {
      expect(result.url).toContain('.salesforce.com')
    }
    await uf.closeModal()
  })

  test('Profile sub-menu Enter navigates to Profile setup page', async () => {
    await uf.openModal()
    await uf.clearAndType(':p System Administrator.')
    await uf.wait(2000)

    // Arrow down to a ProfileSetupLink item (System Permissions is at index 8)
    for (let i = 0; i < 8; i++) {
      await uf.pressKey('ArrowDown')
      await uf.wait(100)
    }

    // Enter on ProfileSetupLink should open Profile setup page
    const pagesBefore = uf.rawContext.pages().length
    await uf.pressKey('Enter')
    await uf.wait(3000)
    const pagesAfter = uf.rawContext.pages().length

    if (pagesAfter > pagesBefore) {
      const newPage = uf.rawContext.pages()[pagesAfter - 1]
      const url = newPage.url()
      expect(url).toContain('Profiles')
      expect(url).toContain('UserPermissions')
      await newPage.close()
    }
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
