import { test, expect } from './fixtures/extension'
import { UltraForcePage } from './pages/ultraforce.page'

// ResultItem inline-action navigation E2E (CustomObject action buttons).
//
// For a CustomObject result, ResultItem renders inline action buttons
// (Fields / Page Layouts / Record Types / Validation Rules / Object Settings).
// Clicking one calls onActionClick(result, action), which the window-manager
// turns into a Setup navigation in a NEW TAB. This verifies a couple of these
// open the correct Setup URL.
//
// Default navigation mode is 'auto' -> Lightning, so buildLightningActionUrl
// (src/lib/navigation.ts) produces ObjectManager URLs keyed by the object's
// DurableId (e.g. 01Ifj...), not the API name:
//   Fields       -> /lightning/setup/ObjectManager/<DurableId>/FieldsAndRelationships/view
//   Page Layouts -> /lightning/setup/ObjectManager/<DurableId>/PageLayouts/view
//   Record Types -> /lightning/setup/ObjectManager/<DurableId>/RecordTypes/view
//
// Requires an open-shadow build (PLASMO_PUBLIC_E2E=true, `pnpm build:e2e`) so
// Playwright locators can pierce the modal's shadow root.

test.describe('Result inline actions - CustomObject', () => {
  let uf: UltraForcePage

  test.beforeAll(async ({ extensionPage, extensionContext, baseUrl }) => {
    uf = new UltraForcePage(extensionPage, extensionContext, baseUrl)
  })

  test.afterEach(async () => {
    await uf.ensureModalClosed()
    await uf.closeExtraTabs()
  })

  test('Fields action opens FieldsAndRelationships setup page', async () => {
    await uf.openModal()
    await uf.clearAndType(':o ASR_Hotel')
    await uf.wait(2000)

    // The row name renders the object label ("Hotel"); the API name ASR_Hotel
    // appears elsewhere in the row, so match the row by its full text content.
    await expect(uf.rowByText('ASR_Hotel')).toBeVisible()

    const result = await uf.clickActionOnRow('ASR_Hotel', 'Fields')
    expect(result.opened).toBe(true)
    // Lightning ObjectManager URL keyed by the object's DurableId (01I...).
    expect(result.url).toMatch(/lightning\/setup\/ObjectManager\/01I[a-zA-Z0-9]+\/FieldsAndRelationships/)
  })

  test('Page Layouts action opens PageLayouts setup page', async () => {
    await uf.openModal()
    await uf.clearAndType(':o ASR_Hotel')
    await uf.wait(2000)

    const result = await uf.clickActionOnRow('ASR_Hotel', 'Page Layouts')
    expect(result.opened).toBe(true)
    expect(result.url).toMatch(/lightning\/setup\/ObjectManager\/01I[a-zA-Z0-9]+\/PageLayouts/)
  })

  test('Record Types action opens RecordTypes setup page', async () => {
    await uf.openModal()
    await uf.clearAndType(':o ASR_Hotel')
    await uf.wait(2000)

    const result = await uf.clickActionOnRow('ASR_Hotel', 'Record Types')
    expect(result.opened).toBe(true)
    expect(result.url).toMatch(/lightning\/setup\/ObjectManager\/01I[a-zA-Z0-9]+\/RecordTypes/)
  })
})
