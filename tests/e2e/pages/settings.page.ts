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

  async setCustomCommands(commands: Record<string, unknown>) {
    const sw = await this.getServiceWorker()
    await sw.evaluate(async (cmds) => {
      const stored = await chrome.storage.local.get('ultraforce_search_settings')
      const settings = stored.ultraforce_search_settings || {}
      settings.customCommands = cmds
      await chrome.storage.local.set({ ultraforce_search_settings: settings })
    }, commands)
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

  /**
   * Seed the version-check state so the extension believes it was just updated.
   * Writes { lastVersion, hasShownNotification: false } to ultraforce_version_check.
   * Setting lastVersion to a value different from the current manifest version (and
   * not empty) makes checkForUpdate() report hasUpdate === true on next modal open.
   */
  async seedLastVersion(version: string) {
    const sw = await this.getServiceWorker()
    await sw.evaluate(async (v) => {
      await chrome.storage.local.set({
        ultraforce_version_check: { lastVersion: v, hasShownNotification: false }
      })
    }, version)
  }

  /** Read the current version-check state from storage. */
  async getVersionCheckState(): Promise<{ lastVersion: string; hasShownNotification: boolean } | undefined> {
    const sw = await this.getServiceWorker()
    return sw.evaluate(async () => {
      const stored = await chrome.storage.local.get('ultraforce_version_check')
      return stored.ultraforce_version_check
    })
  }

  /** Read the extension's current manifest version. */
  async getManifestVersion(): Promise<string> {
    const sw = await this.getServiceWorker()
    return sw.evaluate(() => chrome.runtime.getManifest().version)
  }

  /** Clear the version-check state from storage. */
  async clearVersionCheck() {
    const sw = await this.getServiceWorker()
    await sw.evaluate(async () => {
      await chrome.storage.local.remove('ultraforce_version_check')
    })
  }
}
