import { test, expect } from './fixtures/extension'
import { execSync } from 'child_process'
import { UltraForcePage } from './pages/ultraforce.page'

function currentUserRecord(): { objectApiName: string; recordId: string } {
  const out = execSync(
    "sf data query --query \"SELECT Id FROM User WHERE Name = 'Dormon Zhou' LIMIT 1\" --target-org ultraforce --json",
    { encoding: 'utf-8', env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' } }
  )
  const json = JSON.parse(out)
  return { objectApiName: 'User', recordId: json.result.records[0].Id as string }
}

test.describe('Record Context', () => {
  let uf: UltraForcePage
  let objectApiName: string
  let recordId: string
  let baseUrl: string

  test.beforeAll(async ({ extensionPage, extensionContext, baseUrl: url }) => {
    uf = new UltraForcePage(extensionPage, extensionContext, url)
    baseUrl = url
    const rec = currentUserRecord()
    objectApiName = rec.objectApiName
    recordId = rec.recordId
  })

  test.afterEach(async () => {
    await uf.ensureModalClosed()
    await uf.closeExtraTabs()
  })

  test('shows Record Actions for the current object when on a record page', async () => {
    // Navigate to the record's Lightning view page
    await uf.rawPage.goto(`${baseUrl}/lightning/r/${objectApiName}/${recordId}/view`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    })
    await uf.wait(5000)

    // Open modal with an empty query so the record-context home screen renders
    await uf.openModal()
    await uf.clearInput()
    await uf.wait(1500)

    // The record-actions block only renders when recordContext is set (record page)
    const recordActions = uf.rawPage.locator('.record-actions')
    await expect(recordActions).toBeVisible({ timeout: 8000 })

    // Header shows the current object api name
    await expect(uf.rawPage.locator('.record-object-name')).toHaveText(objectApiName)

    // At least one record action item is offered
    const items = uf.rawPage.locator('.record-action-item')
    expect(await items.count()).toBeGreaterThan(0)
  })
})
