import { test, expect } from './fixtures/extension'
import { execSync } from 'child_process'
import { UltraForcePage } from './pages/ultraforce.page'

function firstApexClassId(): string {
  const out = execSync(
    "sf data query --query \"SELECT Id FROM ApexClass WHERE Name = 'WeatherService' LIMIT 1\" --target-org ultraforce --json",
    { encoding: 'utf-8', env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' } }
  )
  const json = JSON.parse(out)
  return json.result.records[0].Id as string
}

test.describe('ID Navigation', () => {
  let uf: UltraForcePage
  let recordId: string

  test.beforeAll(async ({ extensionPage, extensionContext, baseUrl }) => {
    uf = new UltraForcePage(extensionPage, extensionContext, baseUrl)
    recordId = firstApexClassId()
  })

  test.afterEach(async () => {
    await uf.ensureModalClosed()
    await uf.closeExtraTabs()
  })

  test('pasting a record id navigates to it on Enter', async () => {
    await uf.openModal()
    await uf.clearAndType(recordId)
    await uf.wait(2500)
    const nav = await uf.pressEnterAndWaitForNewTab()
    expect(nav.opened).toBe(true)
    expect(nav.url).toContain(recordId.substring(0, 15))
  })
})
