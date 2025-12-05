import type { PlasmoCSConfig } from 'plasmo'
import UltraForceWindowManager from '~lib/window-manager'
import { validateSalesforceSession, warmupMetadataCache } from '~lib/salesforce-api'
import { getSfHost, getSession } from '~lib/auth'
import { logger } from '~lib/logger'

export const config: PlasmoCSConfig = {
  matches: [
    'https://*.salesforce.com/*',
    'https://*.visual.force.com/*',
    'https://*.visualforce.com/*',
    'https://*.lightning.force.com/*',
    'https://*.my.salesforce.com/*',
    'https://*.salesforce-setup.com/*',
    'https://*.force.com/*',
    'https://*.my.salesforce-sites.com/*',
    'https://*.salesforce-communities.com/*',
    'https://*.sandbox.my.salesforce.com/*',
    'https://*.scratch.my.salesforce.com/*',
    'https://*.sfcrmapps.cn/*',
    'https://*.lightning.sfcrmapps.cn/*',
    'https://*.visual.sfcrmapps.cn/*',
    'https://*.my.sfcrmapps.cn/*',
    'https://*.sandbox.my.sfcrmapps.cn/*',
    'https://*.sfcrmproducts.cn/*',
    'https://*.lightning.sfcrmproducts.cn/*',
    'https://*.visual.sfcrmproducts.cn/*',
    'https://*.my.sfcrmproducts.cn/*',
    'https://*.sandbox.my.sfcrmproducts.cn/*',
    'https://*.setup.sfcrmproducts.cn/*',
    'https://*.setup.sfcrmapps.cn/*'
  ]
}

/**
 * UltraForce Content Script
 * Cookie-based authentication (like Salesforce-Inspector-reloaded)
 */
class UltraForceContentScript {
  private windowManager: UltraForceWindowManager | null = null
  private shortcutKey: string = 'b'
  private keyboardHandler: ((event: KeyboardEvent) => void) | null = null
  private storageListener: ((changes: any) => void) | null = null
  private messageListener: ((request: any, sender: any, sendResponse: any) => void) | null = null
  private isInitialized = false

  constructor() {
    this.initialize()
  }

  private async initialize(): Promise<void> {
    try {
      // Initialize WindowManager
      this.windowManager = await UltraForceWindowManager.getInstance({
        debugMode: false,
        useShadowDOM: true
      })

      // Load shortcut key settings
      await this.loadShortcutSettings()

      // Set up event listeners
      this.setupKeyboardShortcuts()
      this.setupStorageListener()
      this.setupMessageListener()

      // Check session and warmup cache
      await this.initializeSession()

      this.isInitialized = true
    } catch (error) {
      logger.error('Content script initialization failed:', error)
      this.setupMinimalFallback()
    }
  }

  private async loadShortcutSettings(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['ultraforce_search_settings'])
      if (result.ultraforce_search_settings?.shortcutKey) {
        this.shortcutKey = result.ultraforce_search_settings.shortcutKey
      }
    } catch (error) {
      logger.error('Failed to load shortcut settings:', error)
    }
  }

  private setupKeyboardShortcuts(): void {
    if (this.keyboardHandler) {
      document.removeEventListener('keydown', this.keyboardHandler, { capture: true })
    }

    this.keyboardHandler = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === this.shortcutKey.toLowerCase()
      ) {
        event.preventDefault()
        event.stopPropagation()
        this.toggleModal()
        return
      }

      if (event.key === 'Escape' && this.windowManager?.isVisible()) {
        event.preventDefault()
        event.stopPropagation()
        this.windowManager?.hide()
        return
      }
    }

    document.addEventListener('keydown', this.keyboardHandler, { capture: true, passive: false })
  }

  private setupStorageListener(): void {
    this.storageListener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.ultraforce_search_settings?.newValue) {
        const newSettings = changes.ultraforce_search_settings.newValue
        if (newSettings.shortcutKey && newSettings.shortcutKey !== this.shortcutKey) {
          this.shortcutKey = newSettings.shortcutKey
          this.setupKeyboardShortcuts()
        }
      }
    }

    chrome.storage.onChanged.addListener(this.storageListener)
  }

  private setupMessageListener(): void {
    this.messageListener = (
      request: any,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response?: any) => void
    ) => {
      try {
        switch (request.action) {
          case 'ping':
            sendResponse({ success: true, message: 'Content script is running' })
            break

          case 'toggleModal':
          case 'toggleSearch':
            this.toggleModal()
            sendResponse({ success: true })
            break

          case 'refreshSession':
            this.initializeSession()
            sendResponse({ success: true })
            break

          default:
            sendResponse({ success: false, error: 'Unknown action' })
        }
      } catch (error: any) {
        sendResponse({ success: false, error: error.message })
      }

      return true
    }

    chrome.runtime.onMessage.addListener(this.messageListener)
  }

  private async toggleModal(): Promise<void> {
    if (!this.windowManager) {
      return
    }

    try {
      await this.windowManager.toggle()
    } catch (error) {
      logger.error('Failed to toggle modal:', error)
    }
  }

  private async initializeSession(): Promise<void> {
    try {
      const sfHost = await getSfHost(window.location.href)
      if (!sfHost) {
        return
      }

      const session = await getSession(sfHost)
      if (!session) {
        return
      }

      // Validate session and warmup cache
      const isValid = await validateSalesforceSession(sfHost)
      if (isValid) {
        setTimeout(() => {
          warmupMetadataCache(sfHost).catch((error: any) =>
            logger.warn('Cache warmup failed:', error)
          )
        }, 2000)
      }
    } catch (error) {
      logger.error('Failed to initialize session:', error)
    }
  }

  private setupMinimalFallback(): void {
    const fallbackHandler = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === this.shortcutKey.toLowerCase()
      ) {
        event.preventDefault()
        logger.warn('WindowManager not available, please reload the page')
      }
    }

    document.addEventListener('keydown', fallbackHandler, { capture: true, passive: false })
  }

  public async destroy(): Promise<void> {
    try {
      if (this.keyboardHandler) {
        document.removeEventListener('keydown', this.keyboardHandler, { capture: true })
        this.keyboardHandler = null
      }

      if (this.storageListener) {
        chrome.storage.onChanged.removeListener(this.storageListener)
        this.storageListener = null
      }

      if (this.messageListener) {
        chrome.runtime.onMessage.removeListener(this.messageListener)
        this.messageListener = null
      }

      if (this.windowManager) {
        await this.windowManager.destroy()
        this.windowManager = null
      }

      this.isInitialized = false
    } catch (error) {
      logger.error('Error during content script destruction:', error)
    }
  }

  public getDebugInfo(): object {
    return {
      isInitialized: this.isInitialized,
      shortcutKey: this.shortcutKey,
      hasWindowManager: !!this.windowManager,
      windowManagerDebug: this.windowManager?.getDebugInfo()
    }
  }
}

// Global instance management
let globalContentScript: UltraForceContentScript | null = null

function initializeContentScript(): void {
  if (globalContentScript) {
    return
  }

  globalContentScript = new UltraForceContentScript()
}

window.addEventListener('beforeunload', async () => {
  if (globalContentScript) {
    await globalContentScript.destroy()
    globalContentScript = null
  }
})

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeContentScript)
} else {
  setTimeout(initializeContentScript, 100)
}

;(window as any).ultraForceDebug = () => {
  return globalContentScript?.getDebugInfo()
}

const UltraForceCSUI = () => null
export default UltraForceCSUI
