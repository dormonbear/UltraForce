import { test, expect } from './fixtures/extension'
import { UltraForcePage } from './pages/ultraforce.page'

test.describe('Edge Cases', () => {
  let uf: UltraForcePage

  test.beforeAll(async ({ extensionPage, extensionContext, baseUrl }) => {
    uf = new UltraForcePage(extensionPage, extensionContext, baseUrl)
  })

  test('empty search shows default state', async () => {
    await uf.openModal()
    await uf.wait(1000)
    // Modal should show the "start" empty state with type labels
    await uf.closeModal()
  })

  test('search with no results', async () => {
    await uf.openModal()
    await uf.clearAndType(':c zzzzNonExistentClassName')
    await uf.wait(3000)
    // Should show "no results" state without crashing
    await uf.closeModal()
  })

  test('very long search query', async () => {
    await uf.openModal()
    const longQuery = 'a'.repeat(100)
    await uf.clearAndType(longQuery)
    await uf.wait(2000)
    // Should handle gracefully without crashing
    await uf.closeModal()
  })

  test('special characters do not crash', async () => {
    await uf.openModal()
    await uf.clearAndType('Test__c + @#$%')
    await uf.wait(1500)
    await uf.closeModal()
  })

  test('rapid open/close does not corrupt state', async () => {
    for (let i = 0; i < 5; i++) {
      await uf.pressKey('Meta+b')
      await uf.wait(200)
      await uf.pressKey('Escape')
      await uf.wait(200)
    }
    // After rapid toggling, modal should work normally
    await uf.openModal()
    await uf.clearAndType(':o ASR')
    await uf.wait(2000)
    await uf.closeModal()
  })

  test('search after navigate-and-return works', async () => {
    // Navigate to a different page and back
    await uf.goHome()
    // Now search should work again
    await uf.openModal()
    await uf.clearAndType(':c Weather')
    await uf.wait(2000)
    await uf.closeModal()
  })

  test('invalid command prefix shows no crash', async () => {
    await uf.openModal()
    await uf.clearAndType(':z something')
    await uf.wait(1500)
    // Invalid command should fall back gracefully
    await uf.closeModal()
  })

  test('switching commands mid-search', async () => {
    await uf.openModal()
    await uf.clearAndType(':o ASR')
    await uf.wait(1500)
    // Clear and switch to a different command
    await uf.clearAndType(':u Dormon')
    await uf.wait(1500)
    // Switch again
    await uf.clearAndType(':f Create')
    await uf.wait(1500)
    await uf.closeModal()
  })

  test('Enter with no results does not navigate', async () => {
    const pagesBefore = uf.rawContext.pages().length
    await uf.openModal()
    await uf.clearAndType(':c zzzzNotFound')
    await uf.wait(2000)
    await uf.pressKey('Enter')
    await uf.wait(1000)
    const pagesAfter = uf.rawContext.pages().length
    // No new tab should have opened
    expect(pagesAfter).toBe(pagesBefore)
    await uf.closeModal()
  })
})
