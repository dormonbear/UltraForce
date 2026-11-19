import type { PlasmoCSConfig } from 'plasmo'
import UltraForceWindowManager from '~lib/window-manager'
import { validateSalesforceSession, warmupMetadataCache, checkMetadataPermissions } from '~lib/salesforce-api'
import { getSfHost, getSession } from '~lib/auth'
import { claimExtensionScript, isExtensionContextValid } from '~lib/extension-context'
import { scheduleExtensionUpdatedNotice } from '~lib/extension-updated-notice'
import { isToggleShortcut } from '~lib/keyboard-interceptor'
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

const SEARCH_START_EVENT = 'ultraforce:search-start'

class UltraForceContentScript {
  private readonly listeners = new AbortController()
  private windowManager: UltraForceWindowManager | null = null
  private initialization?: Promise<void>
  private removeMessageListener?: () => void
  private warmupTimer?: ReturnType<typeof setTimeout>
  private destroyed = false

  constructor(private readonly release: () => void) {
    const { signal } = this.listeners
    window.addEventListener(
      'pagehide',
      (event) => {
        if (!event.persisted) this.destroy()
      },
      { signal }
    )
    window.addEventListener(
      'pageshow',
      (event) => {
        if (event.persisted) this.checkContext()
      },
      { signal }
    )
    window.addEventListener(
      'unhandledrejection',
      (event) => {
        logger.error('Unhandled promise rejection')
        event.preventDefault()
      },
      { signal }
    )
    document.addEventListener(SEARCH_START_EVENT, () => this.checkContext(), { signal })

    const start = () => {
      if (!this.checkContext()) return
      const options = { capture: true, passive: false, signal }
      // Opening at window capture bypasses the old document listener. / 在 window 捕获阶段打开可绕过旧版文档监听器。
      window.addEventListener('keydown', this.handleOpeningShortcut, options)
      document.addEventListener('keydown', this.handleKeydown, options)
      this.initialization = this.initialize()
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once: true, signal })
    } else {
      start()
    }
  }

  private async initialize(): Promise<void> {
    try {
      const manager = await UltraForceWindowManager.getInstance({
        isContextActive: (event) => this.checkContext(event?.type === 'keydown' && this.matchesShortcut(event))
      })
      if (!this.checkContext()) {
        await manager.destroy()
        return
      }
      this.windowManager = manager

      this.setupMessageListener()
      void this.initializeSession()
    } catch (error) {
      logger.error('Content script initialization failed:', error)
    }
  }

  private matchesShortcut(event: KeyboardEvent): boolean {
    return isToggleShortcut(event, useSettingsStore.getState().shortcutKey)
  }

  private readonly handleOpeningShortcut = (event: KeyboardEvent): void => {
    if (!this.windowManager?.isVisible()) this.handleKeydown(event)
  }

  private readonly handleKeydown = (event: KeyboardEvent): void => {
    const close = event.key === 'Escape' && this.windowManager?.isVisible()
    const toggle = this.matchesShortcut(event)
    if ((!close && !toggle) || !this.checkContext(!close)) return

    event.preventDefault()
    event.stopPropagation()
    if (close) void this.windowManager?.hide()
    else void this.toggleModal()
  }

  private checkContext(opening = false): boolean {
    if (this.destroyed) return false
    if (isExtensionContextValid()) return true

    this.destroy()
    if (opening) scheduleExtensionUpdatedNotice()
    return false
  }

  private setupMessageListener(): void {
    const onMessage = chrome.runtime.onMessage
    const listener: Parameters<typeof onMessage.addListener>[0] = (request, _sender, sendResponse) => {
      const action = request?.action
      if (!this.checkContext(action === 'toggleModal' || action === 'toggleSearch')) return

      switch (action) {
        case 'ping':
          sendResponse({ success: true, message: 'Content script is running' })
          break
        case 'toggleModal':
        case 'toggleSearch':
          void this.toggleModal()
          sendResponse({ success: true })
          break
        case 'refreshSession':
          void this.initializeSession()
          sendResponse({ success: true })
          break
        default:
          sendResponse({ success: false, error: 'Unknown action' })
      }
    }
    onMessage.addListener(listener)
    this.removeMessageListener = () => onMessage.removeListener(listener)
  }

  private async toggleModal(): Promise<void> {
    await this.initialization
    if (!this.checkContext(true) || !this.windowManager) return

    try {
      await this.windowManager.toggle()
    } catch (error) {
      logger.error('Failed to toggle modal:', error)
    }
  }

  private async initializeSession(): Promise<void> {
    try {
      const sfHost = await getSfHost(window.location.href)
      if (!sfHost || this.destroyed || !isExtensionContextValid()) return

      const session = await getSession(sfHost)
      if (!session || this.destroyed || !isExtensionContextValid()) return

      const isValid = await validateSalesforceSession(sfHost)
      if (this.destroyed || !isExtensionContextValid()) return
      if (isValid) {
        clearTimeout(this.warmupTimer)
        this.warmupTimer = setTimeout(() => {
          if (isExtensionContextValid()) {
            void warmupMetadataCache(sfHost).catch(() => logger.warn('Cache warmup failed'))
          }
        }, 2000)
      } else {
        void checkMetadataPermissions(sfHost).catch(() => logger.warn('Metadata permission check failed'))
      }
    } catch (error) {
      logger.error('Failed to initialize session:', error)
    }
  }

  private destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.listeners.abort()
    this.release()
    clearTimeout(this.warmupTimer)

    try {
      this.removeMessageListener?.()
    } catch {
      // Chrome can invalidate the event binding. / Chrome 可能已将事件绑定作废。
    }
    void this.windowManager?.destroy()
    this.windowManager = null
  }

  public getDebugInfo(): object {
    return {
      isInitialized: !!this.windowManager,
      shortcutKey: useSettingsStore.getState().shortcutKey,
      hasWindowManager: !!this.windowManager,
      windowManagerDebug: this.windowManager?.getDebugInfo()
    }
  }
}

document.dispatchEvent(new Event(SEARCH_START_EVENT))
const release = claimExtensionScript('search')
if (release) {
  const debugWindow = window as Window & { ultraForceDebug?: () => object }
  const contentScript = new UltraForceContentScript(() => {
    release()
    delete debugWindow.ultraForceDebug
  })
  debugWindow.ultraForceDebug = () => contentScript.getDebugInfo()
}

const UltraForceCSUI = () => null
export default UltraForceCSUI
