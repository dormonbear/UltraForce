import { type BrowserContext } from '@playwright/test'

export type NavigationMode = 'auto' | 'lightning' | 'classic'

export class SettingsPage {
  constructor(private context: BrowserContext) {}

  /** Get the extension's service worker to access chrome.storage */
  private async getServiceWorker() {
    const workers = this.context.serviceWorkers()
    if (workers.length > 0) return workers[0]
    // Wait for service worker to be available
    return this.context.waitForEvent('serviceworker', { timeout: 5000 })
  }

  async setNavigationMode(mode: NavigationMode) {
    const sw = await this.getServiceWorker()
    await sw.evaluate(async (navMode) => {
      const stored = await chrome.storage.local.get('ultraforce_search_settings')
      const settings = stored.ultraforce_search_settings || {}
      settings.navigationMode = navMode
      await chrome.storage.local.set({ ultraforce_search_settings: settings })
    }, mode)
  }

  async setFuzzySearch(enabled: boolean) {
    const sw = await this.getServiceWorker()
    await sw.evaluate(async (fuzzy) => {
      const stored = await chrome.storage.local.get('ultraforce_search_settings')
      const settings = stored.ultraforce_search_settings || {}
      settings.fuzzySearch = fuzzy
      await chrome.storage.local.set({ ultraforce_search_settings: settings })
    }, enabled)
  }

  async setCloseOnNavigate(enabled: boolean) {
    const sw = await this.getServiceWorker()
    await sw.evaluate(async (close) => {
      const stored = await chrome.storage.local.get('ultraforce_search_settings')
      const settings = stored.ultraforce_search_settings || {}
      settings.closeOnNavigate = close
      await chrome.storage.local.set({ ultraforce_search_settings: settings })
    }, enabled)
  }

  async getSettings(): Promise<Record<string, any>> {
    const sw = await this.getServiceWorker()
    return sw.evaluate(async () => {
      const stored = await chrome.storage.local.get('ultraforce_search_settings')
      return stored.ultraforce_search_settings || {}
    })
  }

  async resetToDefaults() {
    const sw = await this.getServiceWorker()
    await sw.evaluate(async () => {
      await chrome.storage.local.remove('ultraforce_search_settings')
    })
  }
}
