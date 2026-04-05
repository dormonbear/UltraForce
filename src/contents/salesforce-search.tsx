import type { PlasmoCSConfig } from 'plasmo'
import UltraForceWindowManager from '~lib/window-manager'
import { validateSalesforceSession, warmupMetadataCache, checkMetadataPermissions } from '~lib/salesforce-api'
import { getSfHost, getSession } from '~lib/auth'
import { logger } from '~lib/logger'
import { useSettingsStore } from '~stores/settings-store'

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
  private keyboardHandler: ((event: KeyboardEvent) => void) | null = null
  private storeUnsub: (() => void) | null = null
  private messageListener: ((request: any, sender: any, sendResponse: any) => void) | null = null
  private isInitialized = false

  constructor() {
    this.initialize()
  }

  private async initialize(): Promise<void> {
    try {
      await this.initializeSession()

      this.windowManager = await UltraForceWindowManager.getInstance({
        debugMode: false,
        useShadowDOM: true
      })

      this.setupKeyboardShortcuts()
      this.setupStoreSubscription()
      this.setupMessageListener()

      this.isInitialized = true
    } catch (error) {
      logger.error('Content script initialization failed:', error)
      this.setupMinimalFallback()
    }
  }

  private getShortcutKey(): string {
    return useSettingsStore.getState().shortcutKey
  }

  private setupKeyboardShortcuts(): void {
    if (this.keyboardHandler) {
      document.removeEventListener('keydown', this.keyboardHandler, true)
    }

    this.keyboardHandler = (event: KeyboardEvent) => {
      const shortcutKey = this.getShortcutKey()

      if (event.key === 'Escape') {
        if (this.windowManager?.isVisible()) {
          event.preventDefault()
          event.stopPropagation()
          this.windowManager?.hide()
          return
        }
        if (shortcutKey.toLowerCase() === 'escape') {
          event.preventDefault()
          event.stopPropagation()
          this.toggleModal()
          return
        }
      }

      if (shortcutKey.startsWith('alt+')) {
        const key = shortcutKey.slice(4)
        if (event.altKey && event.key.toLowerCase() === key) {
          event.preventDefault()
          event.stopPropagation()
          this.toggleModal()
          return
        }
      }

      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === shortcutKey.toLowerCase()
      ) {
        event.preventDefault()
        event.stopPropagation()
        this.toggleModal()
        return
      }
    }

    document.addEventListener('keydown', this.keyboardHandler, { capture: true, passive: false })
  }

  /** Re-register keyboard shortcuts when shortcutKey changes in settings store. */
  private setupStoreSubscription(): void {
    let prevKey = this.getShortcutKey()
    this.storeUnsub = useSettingsStore.subscribe((state) => {
      if (state.shortcutKey !== prevKey) {
        prevKey = state.shortcutKey
        this.setupKeyboardShortcuts()
      }
    })
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

      const isValid = await validateSalesforceSession(sfHost)
      if (isValid) {
        setTimeout(() => {
          warmupMetadataCache(sfHost).catch((error: any) =>
            logger.warn('Cache warmup failed:', error)
          )
        }, 2000)
      } else {
        checkMetadataPermissions(sfHost).catch(() => {})
      }
    } catch (error) {
      logger.error('Failed to initialize session:', error)
    }
  }

  private setupMinimalFallback(): void {
    const fallbackHandler = (event: KeyboardEvent) => {
      const shortcutKey = this.getShortcutKey()
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === shortcutKey.toLowerCase()
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
        document.removeEventListener('keydown', this.keyboardHandler, true)
        this.keyboardHandler = null
      }

      if (this.storeUnsub) {
        this.storeUnsub()
        this.storeUnsub = null
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
      shortcutKey: this.getShortcutKey(),
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
