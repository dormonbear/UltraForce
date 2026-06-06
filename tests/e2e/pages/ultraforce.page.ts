import { type Page, type BrowserContext } from '@playwright/test'

export class UltraForcePage {
  constructor(
    private page: Page,
    private context: BrowserContext,
    private baseUrl: string
  ) {}

  async openModal() {
    await this.page.keyboard.press('Meta+b')
    await this.page.waitForTimeout(1000)
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
    await this.page.waitForTimeout(1500)
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

  /**
   * Search, select result, and navigate in a new tab.
   * Returns the new tab URL and closes the new tab.
   */
  async searchAndNavigateNewTab(
    command: string,
    waitMs: number = 3000
  ): Promise<{ opened: boolean; url: string }> {
    await this.openModal()
    await this.clearAndType(command)
    await this.page.waitForTimeout(waitMs)

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
   */
  async navigateSetupShortcut(
    shortcutName: string,
    waitMs: number = 3000
  ): Promise<{ opened: boolean; url: string }> {
    return this.searchAndNavigateNewTab(`:g ${shortcutName}`, waitMs)
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
   * Tab on the currently selected result, then press Enter to navigate.
   * Returns the new tab URL (if opened) for assertion.
   */
  async tabThenNavigateNewTab(
    waitAfterTab: number = 3000
  ): Promise<{ opened: boolean; url: string }> {
    await this.page.keyboard.press('Tab')
    await this.page.waitForTimeout(waitAfterTab)
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
    await this.wait(400)
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
    await this.wait(400)
  }
}
