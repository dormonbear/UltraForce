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
    const pagesBefore = this.context.pages().length
    await this.openModal()
    await this.clearAndType(command)
    await this.page.waitForTimeout(waitMs)

    // First result is already selected (selectedIndex=0), just press Enter
    await this.page.keyboard.press('Enter')
    await this.page.waitForTimeout(3000)

    const pagesAfter = this.context.pages().length
    if (pagesAfter > pagesBefore) {
      const newPage = this.context.pages()[pagesAfter - 1]
      const url = newPage.url()
      await newPage.close()
      return { opened: true, url }
    }
    return { opened: false, url: '' }
  }

  /**
   * Navigate to a setup shortcut and return the new tab URL.
   */
  async navigateSetupShortcut(shortcutName: string): Promise<{ opened: boolean; url: string }> {
    return this.searchAndNavigateNewTab(`:g ${shortcutName}`)
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
    const pagesBefore = this.context.pages().length
    await this.page.keyboard.press('Tab')
    await this.page.waitForTimeout(waitAfterTab)
    await this.page.keyboard.press('Enter')
    await this.page.waitForTimeout(3000)

    const pagesAfter = this.context.pages().length
    if (pagesAfter > pagesBefore) {
      const newPage = this.context.pages()[pagesAfter - 1]
      const url = newPage.url()
      await newPage.close()
      return { opened: true, url }
    }
    return { opened: false, url: '' }
  }
}
