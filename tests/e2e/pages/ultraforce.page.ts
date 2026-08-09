import { expect, type Page, type BrowserContext } from '@playwright/test'

export class UltraForcePage {
  constructor(
    private page: Page,
    private context: BrowserContext,
    private baseUrl: string
  ) {}

  async openModal() {
    await this.page.keyboard.press('Meta+b')
    // The modal is usable only once its input is mounted; typing earlier would
    // be swallowed by the page (the keyboard shield intercepts it). Waiting on
    // the element is the real condition - a fixed sleep would let an open
    // failure surface later, in unrelated assertions.
    await this.page.locator('[data-ultraforce-input]').waitFor({ state: 'visible', timeout: 5000 })
  }

  async closeModal() {
    await this.page.keyboard.press('Escape')
    await this.page.waitForTimeout(500)
  }

  async clearInput() {
    await this.page.keyboard.press('Meta+a')
    await this.page.keyboard.press('Backspace')
    await this.page.waitForTimeout(200)
  }

  async clearAndType(text: string) {
    await this.clearInput()
    await this.page.keyboard.type(text)
    // No settle sleep here on purpose: typing is complete when this returns,
    // and whether the search resolved is a condition callers must wait on
    // explicitly (waitForSelectedResult / locator visibility), not a fixed
    // number of milliseconds.
  }

  async typeText(text: string) {
    await this.page.keyboard.type(text)
  }

  async pressKey(key: string) {
    await this.page.keyboard.press(key)
  }

  async goHome() {
    await this.page.goto(`${this.baseUrl}/lightning/page/home`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    }).catch(() => {})
    await this.page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
    await this.page.waitForTimeout(2000)
  }

  /** Check if the extension container is present in the DOM */
  async getContainerInfo(): Promise<{ hasContainer: boolean; containerId: string | null }> {
    return this.page.evaluate(() => {
      const el = document.querySelector('[id^="ultraforce-modal"]')
      return { hasContainer: !!el, containerId: el?.id || null }
    })
  }

  /** Check if the modal-open attribute is set (keyboard shield active) */
  async isShieldActive(): Promise<boolean> {
    return this.page.evaluate(() => {
      return document.documentElement.hasAttribute('data-ultraforce-modal-open')
    })
  }

  /** Locator for the currently highlighted result row (the row Enter would navigate). */
  private selectedRow() {
    return this.page.locator('[data-ultraforce-result-item][data-selected="true"]').first()
  }

  /** Name text of the highlighted result row, or null when no row is rendered. */
  private async selectedResultName(): Promise<string | null> {
    const row = this.selectedRow()
    if (!(await row.isVisible().catch(() => false))) return null
    return (await row.locator('.result-name').first().textContent().catch(() => null)) ?? null
  }

  /**
   * Waits until the results list has rendered a highlighted row - the real
   * readiness condition for pressing Enter. Bounded by timeoutMs; throws with
   * the locator's own timeout message when the search never resolves.
   */
  async waitForSelectedResult(timeoutMs: number = 5000): Promise<void> {
    await this.selectedRow().waitFor({ state: 'visible', timeout: timeoutMs })
  }

  /**
   * Waits until the highlighted row's name differs from `previousName`. Used
   * after Tab autocomplete rewrote the query: the old result set stays
   * rendered until the new search lands, and Enter must not fire on it.
   */
  async waitForSelectedResultChange(previousName: string | null, timeoutMs: number = 5000): Promise<void> {
    await expect
      .poll(
        async () => {
          const name = await this.selectedResultName()
          return name !== null && name !== previousName
        },
        { timeout: timeoutMs, message: `highlighted result did not change after Tab (was: ${String(previousName)})` }
      )
      .toBe(true)
  }

  /**
   * Search, wait for a highlighted result, then navigate in a new tab.
   * Returns the new tab URL and closes the new tab.
   *
   * timeoutMs bounds the readiness wait for the result list - it is not a
   * sleep. Enter is only pressed once a row is actually highlighted, so a slow
   * org search can never turn Enter into a no-op.
   */
  async searchAndNavigateNewTab(
    command: string,
    timeoutMs: number = 5000
  ): Promise<{ opened: boolean; url: string }> {
    await this.openModal()
    await this.clearAndType(command)
    await this.waitForSelectedResult(timeoutMs)

    // Listen for new page event before pressing Enter
    const newPagePromise = this.context.waitForEvent('page', { timeout: 5000 }).catch(() => null)
    await this.page.keyboard.press('Enter')

    const newPage = await newPagePromise
    if (newPage) {
      await newPage.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {})
      const url = newPage.url()
      await newPage.close()
      return { opened: true, url }
    }
    return { opened: false, url: '' }
  }

  /**
   * Navigate to a setup shortcut and return the new tab URL.
   * timeoutMs bounds the readiness wait (see searchAndNavigateNewTab).
   */
  async navigateSetupShortcut(
    shortcutName: string,
    timeoutMs: number = 5000
  ): Promise<{ opened: boolean; url: string }> {
    return this.searchAndNavigateNewTab(`:g ${shortcutName}`, timeoutMs)
  }

  /** Ensure the modal is closed, regardless of current state */
  async ensureModalClosed() {
    const isOpen = await this.isShieldActive()
    if (isOpen) {
      await this.page.keyboard.press('Escape')
      await this.page.waitForTimeout(500)
    }
  }

  /** Close any extra tabs beyond the main page tab, keeping only the first two (default + main) */
  async closeExtraTabs() {
    const pages = this.context.pages()
    for (let i = pages.length - 1; i >= 2; i--) {
      await pages[i].close()
    }
  }

  /** Wait helper */
  async wait(ms: number) {
    await this.page.waitForTimeout(ms)
  }

  /** Get the underlying page (for advanced assertions) */
  get rawPage(): Page {
    return this.page
  }

  /** Get the underlying context */
  get rawContext(): BrowserContext {
    return this.context
  }

  /**
   * Tab-autocomplete the selected result (dot-notation), then press Enter to
   * navigate the NEW result set. timeoutMs bounds the wait for the new
   * highlighted row; Enter never fires on the stale pre-Tab list.
   */
  async tabThenNavigateNewTab(timeoutMs: number = 5000): Promise<{ opened: boolean; url: string }> {
    const selectedBefore = await this.selectedResultName()
    await this.page.keyboard.press('Tab')
    await this.waitForSelectedResultChange(selectedBefore, timeoutMs)
    return this.pressEnterAndWaitForNewTab()
  }

  /** Press Enter on the currently selected result and wait for a new tab to open */
  async pressEnterAndWaitForNewTab(): Promise<{ opened: boolean; url: string }> {
    const newPagePromise = this.context.waitForEvent('page', { timeout: 5000 }).catch(() => null)
    await this.page.keyboard.press('Enter')

    const newPage = await newPagePromise
    if (newPage) {
      await newPage.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {})
      const url = newPage.url()
      await newPage.close()
      return { opened: true, url }
    }
    return { opened: false, url: '' }
  }

  async openHome(): Promise<void> {
    await this.openModal()
    await this.clearInput()
    await this.wait(800)
  }

  async resultTexts(): Promise<string[]> {
    return this.page.evaluate(() => {
      const host = document.querySelector('[id^="ultraforce-modal"]')
      const root = (host as HTMLElement | null)?.shadowRoot ?? document
      return Array.from(root.querySelectorAll('[data-ultraforce-result-item] .result-name')).map((n) => n.textContent || '')
    })
  }

  // --- Open-shadow helpers (require PLASMO_PUBLIC_E2E build with mode: 'open') ---
  // Playwright locators automatically pierce open shadow roots, so these reach
  // elements inside the modal directly.

  /** Locator for result rows inside the (now open) shadow modal. */
  resultRows() {
    return this.page.locator('[data-ultraforce-result-item]')
  }

  /** Text of all result row names. */
  async resultNames(): Promise<string[]> {
    return this.resultRows().locator('.result-name').allTextContents()
  }

  /** The result row whose name/content contains the given text. */
  rowByText(text: string) {
    return this.resultRows().filter({ hasText: text }).first()
  }

  /** Click the pin/favorite button on the result row containing the given text. */
  async togglePinOnRow(text: string): Promise<void> {
    const row = this.rowByText(text)
    await row.hover()
    await row.getByTitle(/favorites/i).click()
    // No settle sleep: the caller asserts the resulting state with expect.poll.
  }

  /**
   * Hover the result row containing `text`, click the inline action button with
   * `actionTitle`, and capture the new tab the action opens. Closes the new tab.
   */
  async clickActionOnRow(text: string, actionTitle: string): Promise<{ opened: boolean; url: string }> {
    const row = this.rowByText(text)
    await row.hover()
    const newPagePromise = this.context.waitForEvent('page', { timeout: 8000 }).catch(() => null)
    await row.getByTitle(actionTitle, { exact: true }).click()

    const newPage = await newPagePromise
    if (newPage) {
      await newPage.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {})
      const url = newPage.url()
      await newPage.close()
      return { opened: true, url }
    }
    return { opened: false, url: '' }
  }

  /** The current favorite-button title for the result row ("Pin to favorites" | "Remove from favorites"). */
  async pinTitleOnRow(text: string): Promise<string | null> {
    const row = this.rowByText(text)
    await row.hover()
    return row.locator('.favorite-action button').first().getAttribute('title')
  }

  /** Locator for the home-screen Favorites section items (after clearing query / reopening). */
  homeFavoriteItems() {
    return this.page.locator('.home-item')
  }

  /** Names of items in the home-screen Favorites section. */
  async homeFavoriteNames(): Promise<string[]> {
    return this.page.locator('.home-section .home-item-name').allTextContents()
  }

  /** Click the Unpin button on the home-screen favorite row containing the given text. */
  async unpinFromHome(text: string): Promise<void> {
    const item = this.homeFavoriteItems().filter({ hasText: text }).first()
    await item.hover()
    await item.getByTitle('Unpin').click()
    // No settle sleep: the caller asserts the resulting state with expect.poll.
  }

  // --- Settings panel helpers (open-shadow build) ---

  /** Open the Settings panel by clicking the gear button in the modal footer. */
  async openSettings(): Promise<void> {
    await this.page.locator('[data-ultraforce-settings-button]').click()
    await this.page.locator('[data-ultraforce-settings]').waitFor({ state: 'visible', timeout: 5000 })
  }

  /** The Settings panel root locator. */
  settingsPanel() {
    return this.page.locator('[data-ultraforce-settings]')
  }

  /** Custom-command rows in the Custom Commands section (rows with an Edit button). */
  customCommandRows() {
    return this.settingsPanel().locator('.command-row').filter({ has: this.page.getByTitle('Edit', { exact: true }) })
  }

  /** Descriptions of all custom commands currently listed. */
  async customCommandDescriptions(): Promise<string[]> {
    return this.customCommandRows().locator('.command-desc').allTextContents()
  }

  /**
   * Fill and submit the custom-command form. Assumes the form is already shown
   * (after clicking "+ Add Command" or "Edit"). Clicks Save at the end.
   */
  async fillCommandForm(key: string, description: string, soql: string): Promise<void> {
    const form = this.settingsPanel().locator('.command-edit-form')
    await form.getByPlaceholder('e.g. log').fill(key)
    await form.getByPlaceholder('e.g. My Logs').fill(description)
    await form.locator('.command-textarea').fill(soql)
    await form.getByRole('button', { name: 'Save' }).click()
    // No settle sleep: the caller asserts the resulting state with expect.poll.
  }

  /** Click "+ Add Command" to reveal the new-command form. */
  async clickAddCommand(): Promise<void> {
    await this.settingsPanel().getByRole('button', { name: '+ Add Command' }).click()
    // No settle sleep: the subsequent fill() auto-waits for the form to render.
  }

  /** Delete the custom command whose description contains the given text (accepts confirm dialog). */
  async deleteCommandByDescription(description: string): Promise<void> {
    const row = this.customCommandRows().filter({ hasText: description }).first()
    await row.getByTitle('Delete', { exact: true }).click()
    // No settle sleep: the caller asserts the resulting state with expect.poll.
  }
}
