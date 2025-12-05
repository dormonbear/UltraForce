import React from 'react'
import { createRoot } from 'react-dom/client'
import SearchModal from '~components/search/SearchModal'
import ErrorBoundary from '~components/ErrorBoundary'
import { searchSalesforceMetadata } from '~lib/salesforce-api'
import { getSfHost, getSession } from '~lib/auth'
import { logger } from '~lib/logger'
import type { SearchResult } from '~types'
import type { ObjectAction } from '~components/search/ResultItem'

type NavigationMode = 'auto' | 'lightning' | 'classic'

interface WindowManagerState {
  isVisible: boolean
  isInitialized: boolean
  sfHost: string | null
  searchResults: Record<string, SearchResult[]>
  isLoading: boolean
  hasSession: boolean
  closeOnNavigate: boolean
  navigationMode: NavigationMode
  fuzzySearch: boolean
}

interface WindowManagerOptions {
  containerId?: string
  useShadowDOM?: boolean
  debugMode?: boolean
}

const CONTAINER_PREFIX = 'ultraforce-modal'
const CLEANUP_DELAY = 100
const MAX_CLEANUP_ATTEMPTS = 3

/**
 * Detect if should use Lightning URLs based on mode setting
 */
function shouldUseLightning(mode: NavigationMode): boolean {
  // If explicit mode is set, use it
  if (mode === 'lightning') return true
  if (mode === 'classic') return false

  // Auto mode: detect from current page
  const url = window.location.href
  const hostname = window.location.hostname
  const pathname = window.location.pathname

  // Explicit Classic mode in URL
  if (url.includes('lex=off')) {
    return false
  }

  // Lightning URL patterns - definitive Lightning indicators
  if (url.includes('/lightning/') || url.includes('/one/one.app')) {
    return true
  }

  // Lightning-specific domains (always Lightning)
  if (hostname.includes('.lightning.force.com') ||
      hostname.includes('.salesforce-setup.com') ||
      hostname.includes('.setup.sfcrmproducts.cn') ||
      hostname.includes('.setup.sfcrmapps.cn')) {
    return true
  }

  // Classic URL patterns - check these BEFORE defaulting to Lightning
  const classicPatterns = [
    '/home/home.jsp',
    '/setup/forcecomHomepage.apexp',
    '/ui/setup/',
    '/p/setup/',
    '/apexpages/',
    '/_ui/',
    '/servlet/'
  ]

  if (classicPatterns.some(pattern => pathname.includes(pattern))) {
    return false
  }

  // Check if it's a Classic record page (15 or 18 char ID directly in path)
  // Classic URLs: /001xxx... or /a0Bxxx...
  // Lightning URLs: /lightning/r/Object/001xxx.../view
  const classicRecordPattern = /^\/[a-zA-Z0-9]{15,18}(\/|$|\?)/
  if (classicRecordPattern.test(pathname) && !pathname.includes('/lightning/')) {
    return false
  }

  // Default to Lightning for modern Salesforce domains
  return true
}

/**
 * UltraForce Window Manager - Singleton pattern
 * Manages modal window lifecycle with cookie-based auth
 */
class UltraForceWindowManager {
  private static instance: UltraForceWindowManager | null = null
  private static initializationPromise: Promise<UltraForceWindowManager> | null = null

  private reactRoot: any = null
  private containerElement: HTMLElement | null = null
  private shadowRoot: ShadowRoot | null = null
  private cleanupFunctions: (() => void)[] = []
  private searchNonce = 0

  private state: WindowManagerState = {
    isVisible: false,
    isInitialized: false,
    sfHost: null,
    searchResults: {},
    isLoading: false,
    hasSession: false,
    closeOnNavigate: true,
    navigationMode: 'auto',
    fuzzySearch: true
  }

  private options: Required<WindowManagerOptions> = {
    containerId: `${CONTAINER_PREFIX}-${Date.now()}`,
    useShadowDOM: true,
    debugMode: false
  }

  private eventHandlers = new Map<string, Set<Function>>()

  private constructor(options: WindowManagerOptions = {}) {
    this.options = { ...this.options, ...options }
    this.log('WindowManager constructor called')

    this.toggle = this.toggle.bind(this)
    this.show = this.show.bind(this)
    this.hide = this.hide.bind(this)
    this.destroy = this.destroy.bind(this)
  }

  public static async getInstance(options?: WindowManagerOptions): Promise<UltraForceWindowManager> {
    if (UltraForceWindowManager.instance) {
      return UltraForceWindowManager.instance
    }

    if (UltraForceWindowManager.initializationPromise) {
      return UltraForceWindowManager.initializationPromise
    }

    UltraForceWindowManager.initializationPromise = UltraForceWindowManager.createInstance(options)
    return UltraForceWindowManager.initializationPromise
  }

  private static async createInstance(
    options?: WindowManagerOptions
  ): Promise<UltraForceWindowManager> {
    await UltraForceWindowManager.cleanup()

    const instance = new UltraForceWindowManager(options)
    await instance.initialize()

    UltraForceWindowManager.instance = instance
    UltraForceWindowManager.initializationPromise = null

    return instance
  }

  private static async cleanup(): Promise<void> {
    logger.debug('Cleaning up existing UltraForce instances...')

    if (UltraForceWindowManager.instance) {
      await UltraForceWindowManager.instance.destroy()
      UltraForceWindowManager.instance = null
    }

    let attempt = 0
    while (attempt < MAX_CLEANUP_ATTEMPTS) {
      const existingContainers = document.querySelectorAll(`[id^="${CONTAINER_PREFIX}"]`)
      if (existingContainers.length === 0) break

      existingContainers.forEach((container) => {
        try {
          container.remove()
        } catch (error) {
          logger.warn('Failed to remove container:', error)
        }
      })

      attempt++
      if (attempt < MAX_CLEANUP_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, CLEANUP_DELAY))
      }
    }
  }

  private async initialize(): Promise<void> {
    try {
      this.log('Initializing WindowManager...')

      await this.createContainer()
      this.setupEventListeners()
      await this.loadState()

      this.state.isInitialized = true
      this.log('WindowManager initialized successfully')

      this.emit('initialized', this.state)
    } catch (error) {
      logger.error('WindowManager initialization failed:', error)
      throw error
    }
  }

  private async createContainer(): Promise<void> {
    this.containerElement = document.createElement('div')
    this.containerElement.id = this.options.containerId
    this.containerElement.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 2147483647;
    `

    if (this.options.useShadowDOM) {
      try {
        this.shadowRoot = this.containerElement.attachShadow({ mode: 'closed' })
        this.log('Shadow DOM created for style isolation')
      } catch (error) {
        logger.warn('Shadow DOM not supported, falling back to regular DOM')
        this.options.useShadowDOM = false
      }
    }

    document.body.appendChild(this.containerElement)
    this.log(`Container created: ${this.options.containerId}`)
  }

  private setupEventListeners(): void {
    const handleBeforeUnload = () => {
      this.destroy()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    this.cleanupFunctions.push(() => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    })

    const handleVisibilityChange = () => {
      if (document.hidden && this.state.isVisible) {
        this.log('Page hidden, keeping modal state')
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    this.cleanupFunctions.push(() => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    })

    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName !== 'local') return
      if (changes.ultraforce_search_settings) {
        const newSettings = changes.ultraforce_search_settings.newValue
        if (newSettings?.closeOnNavigate !== undefined) {
          this.state.closeOnNavigate = newSettings.closeOnNavigate
          this.log('closeOnNavigate updated:', this.state.closeOnNavigate)
        }
        if (newSettings?.navigationMode) {
          this.state.navigationMode = newSettings.navigationMode
          this.log('navigationMode updated:', this.state.navigationMode)
        }
        if (newSettings?.fuzzySearch !== undefined) {
          this.state.fuzzySearch = newSettings.fuzzySearch
          this.log('fuzzySearch updated:', this.state.fuzzySearch)
        }
      }
    }

    chrome.storage.onChanged.addListener(handleStorageChange)
    this.cleanupFunctions.push(() => {
      chrome.storage.onChanged.removeListener(handleStorageChange)
    })
  }

  private async loadState(): Promise<void> {
    try {
      // Get SF host from current page URL
      const sfHost = await getSfHost(window.location.href)
      if (sfHost) {
        this.state.sfHost = sfHost
        this.log('SF Host detected:', sfHost)

        // Check if we have a valid session
        const session = await getSession(sfHost)
        this.state.hasSession = session !== null
        this.log('Session status:', this.state.hasSession ? 'Active' : 'None')
      }

      // Load settings
      const result = await chrome.storage.local.get(['ultraforce_search_settings'])
      if (result.ultraforce_search_settings?.closeOnNavigate !== undefined) {
        this.state.closeOnNavigate = result.ultraforce_search_settings.closeOnNavigate
      }
      if (result.ultraforce_search_settings?.navigationMode) {
        this.state.navigationMode = result.ultraforce_search_settings.navigationMode
      }
      if (result.ultraforce_search_settings?.fuzzySearch !== undefined) {
        this.state.fuzzySearch = result.ultraforce_search_settings.fuzzySearch
      }
    } catch (error) {
      logger.warn('Failed to load state:', error)
    }
  }

  public async toggle(): Promise<void> {
    if (this.state.isVisible) {
      await this.hide()
    } else {
      await this.show()
    }
  }

  public async show(): Promise<void> {
    if (!this.state.isInitialized) {
      throw new Error('WindowManager not initialized')
    }

    if (this.state.isVisible) {
      this.log('Modal already visible')
      return
    }

    // Refresh session state before showing
    await this.loadState()

    this.state.isVisible = true
    this.log('Showing modal')

    await this.renderComponent()
    this.emit('show', this.state)
  }

  public async hide(): Promise<void> {
    if (!this.state.isVisible) {
      this.log('Modal already hidden')
      return
    }

    this.state.isVisible = false
    this.log('Hiding modal')

    if (this.reactRoot) {
      this.reactRoot.unmount()
      this.reactRoot = null
    }

    this.emit('hide', this.state)
  }

  private async renderComponent(): Promise<void> {
    if (!this.containerElement) {
      throw new Error('Container element not available')
    }

    const mountPoint = this.shadowRoot || this.containerElement
    if (!this.reactRoot) {
      this.reactRoot = createRoot(mountPoint)
    }

    this.reactRoot.render(
      React.createElement(
        ErrorBoundary,
        {
          onError: (error: Error, errorInfo: any) => {
            this.log('React error caught by ErrorBoundary:', error)
            this.emit('error', { error, errorInfo })
          }
        },
        React.createElement(SearchModal, {
          isVisible: this.state.isVisible,
          onClose: this.hide,
          onSearch: this.handleSearch.bind(this),
          onResultClick: this.handleResultClick.bind(this),
          onActionClick: this.handleActionClick.bind(this),
          searchResults: this.state.searchResults,
          isLoading: this.state.isLoading,
          sfHost: this.state.sfHost,
          hasSession: this.state.hasSession,
          navigationMode: this.state.navigationMode,
          onNavigationModeChange: this.handleNavigationModeChange.bind(this),
          fuzzySearch: this.state.fuzzySearch,
          onFuzzySearchChange: this.handleFuzzySearchChange.bind(this)
        })
      )
    )

    this.log('React component rendered with error boundary')
  }

  private async handleSearch(query: string, selectedTypes: string[], useFuzzy: boolean): Promise<void> {
    this.log(`Search requested: "${query}" for types: ${selectedTypes.join(', ')}, fuzzy: ${useFuzzy}`)

    if (!this.state.sfHost) {
      logger.error('No SF host available for search')
      return
    }

    const currentNonce = ++this.searchNonce
    this.state.isLoading = true
    this.emit('searchStart', { query, selectedTypes })

    try {
      const results = await searchSalesforceMetadata(query, selectedTypes, this.state.sfHost, { useFuzzy })

      if (currentNonce !== this.searchNonce) {
        this.log(`Discarding stale search results (nonce ${currentNonce} vs ${this.searchNonce})`)
        return
      }

      this.state.searchResults = results
      this.emit('searchSuccess', results)
    } catch (error) {
      if (currentNonce !== this.searchNonce) {
        return
      }
      logger.error('Search failed:', error)
      this.emit('searchError', error)
    } finally {
      if (currentNonce === this.searchNonce) {
        this.state.isLoading = false
        this.emit('searchEnd')
        await this.renderComponent()
      }
    }
  }

  private handleNavigationModeChange(mode: NavigationMode): void {
    this.state.navigationMode = mode
    this.log(`Navigation mode changed to: ${mode}`)
  }

  private handleFuzzySearchChange(value: boolean): void {
    this.state.fuzzySearch = value
    this.log(`Fuzzy search changed to: ${value}`)
  }

  private handleResultClick(result: SearchResult): void {
    this.log(`Result clicked: ${result.name} (${result.type})`)
    this.emit('resultClick', result)

    // Navigate to the result
    if (this.state.sfHost && result.id) {
      const baseUrl = `https://${this.state.sfHost}`
      const useLightning = shouldUseLightning(this.state.navigationMode)
      let targetUrl = ''

      if (useLightning) {
        // Lightning Experience URLs
        switch (result.type) {
          case 'ApexClass':
            targetUrl = `${baseUrl}/lightning/setup/ApexClasses/page?address=%2F${result.id}`
            break
          case 'ApexTrigger':
            targetUrl = `${baseUrl}/lightning/setup/ApexTriggers/page?address=%2F${result.id}`
            break
          case 'Flow':
            targetUrl = `${baseUrl}/builder_platform_interaction/flowBuilder.app?flowId=${result.id}`
            break
          case 'User':
            targetUrl = `${baseUrl}/lightning/r/User/${result.id}/view`
            break
          case 'CustomObject':
            targetUrl = `${baseUrl}/lightning/o/${result.metadata?.QualifiedApiName}/list`
            break
          case 'CustomField': {
            const objectName = result.metadata?.ObjectApiName || result.metadata?.EntityDefinition?.QualifiedApiName
            // DurableId format: "Account.00N5j000002uztP" - extract the ID after the dot
            const durableId = result.metadata?.DurableId || ''
            const fieldId = durableId.includes('.') ? durableId.split('.')[1] : durableId
            if (objectName && fieldId) {
              const setupHost = this.state.sfHost?.replace('.my.salesforce.com', '.my.salesforce-setup.com')
                                                  ?.replace('.lightning.force.com', '.my.salesforce-setup.com')
              targetUrl = `https://${setupHost}/lightning/setup/ObjectManager/${objectName}/FieldsAndRelationships/${fieldId}/view`
            }
            break
          }
          case 'PermissionSet':
            targetUrl = `${baseUrl}/lightning/setup/PermSets/page?address=%2F${result.id}`
            break
          case 'Profile':
            targetUrl = `${baseUrl}/lightning/setup/EnhancedProfiles/page?address=%2F${result.id}`
            break
          default:
            targetUrl = `${baseUrl}/lightning/r/${result.type}/${result.id}/view`
        }
      } else {
        // Classic URLs
        switch (result.type) {
          case 'ApexClass':
          case 'ApexTrigger':
          case 'User':
          case 'PermissionSet':
          case 'Profile':
            targetUrl = `${baseUrl}/${result.id}`
            break
          case 'Flow':
            targetUrl = `${baseUrl}/builder_platform_interaction/flowBuilder.app?flowId=${result.id}`
            break
          case 'CustomObject': {
            const keyPrefix = result.metadata?.KeyPrefix
            if (keyPrefix) {
              targetUrl = `${baseUrl}/${keyPrefix}/o`
            } else {
              targetUrl = `${baseUrl}/p/setup/layout/LayoutFieldList?type=${result.metadata?.QualifiedApiName}`
            }
            break
          }
          case 'CustomField': {
            const durableId = result.metadata?.DurableId || ''
            const fieldId = durableId.includes('.') ? durableId.split('.')[1] : durableId
            if (fieldId) {
              targetUrl = `${baseUrl}/${fieldId}`
            }
            break
          }
          default:
            targetUrl = `${baseUrl}/${result.id}`
        }
      }

      window.open(targetUrl, '_blank')
    }

    if (this.state.closeOnNavigate) {
      this.hide()
    }
  }

  private handleActionClick(result: SearchResult, action: ObjectAction): void {
    this.log(`Action clicked: ${action} for ${result.name}`)
    this.emit('actionClick', { result, action })

    if (!this.state.sfHost || !result.metadata?.DurableId) {
      this.log('Missing sfHost or DurableId for action navigation')
      return
    }

    const baseUrl = `https://${this.state.sfHost}`
    const objectId = result.metadata.DurableId
    const objectApiName = result.metadata.QualifiedApiName
    const useLightning = shouldUseLightning(this.state.navigationMode)
    let targetUrl = ''

    if (useLightning) {
      // Lightning Experience URLs
      switch (action) {
        case 'list':
          targetUrl = `${baseUrl}/lightning/o/${objectApiName}/list`
          break
        case 'fields':
          targetUrl = `${baseUrl}/lightning/setup/ObjectManager/${objectId}/FieldsAndRelationships/view`
          break
        case 'layouts':
          targetUrl = `${baseUrl}/lightning/setup/ObjectManager/${objectId}/PageLayouts/view`
          break
        case 'details':
          targetUrl = `${baseUrl}/lightning/setup/ObjectManager/${objectId}/Details/view`
          break
      }
    } else {
      // Classic URLs
      switch (action) {
        case 'list':
          const keyPrefix = result.metadata?.KeyPrefix
          targetUrl = keyPrefix ? `${baseUrl}/${keyPrefix}/o` : `${baseUrl}/p/setup/layout/LayoutFieldList?type=${objectApiName}`
          break
        case 'fields':
          targetUrl = `${baseUrl}/p/setup/layout/LayoutFieldList?type=${objectApiName}`
          break
        case 'layouts':
          targetUrl = `${baseUrl}/ui/setup/layout/PageLayouts?type=${objectApiName}`
          break
        case 'details':
          targetUrl = `${baseUrl}/${objectId}`
          break
      }
    }

    if (targetUrl) {
      window.open(targetUrl, '_blank')
      if (this.state.closeOnNavigate) {
        this.hide()
      }
    }
  }

  public updateState(updates: Partial<WindowManagerState>): void {
    const oldState = { ...this.state }
    this.state = { ...this.state, ...updates }
    this.log('State updated', updates)
    this.emit('stateChange', { oldState, newState: this.state, updates })
  }

  public getState(): Readonly<WindowManagerState> {
    return { ...this.state }
  }

  public isVisible(): boolean {
    return this.state.isVisible
  }

  public isInitialized(): boolean {
    return this.state.isInitialized
  }

  public on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    this.eventHandlers.get(event)!.add(handler)
  }

  public off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.delete(handler)
    }
  }

  private emit(event: string, data?: any): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data)
        } catch (error) {
          logger.error(`Event handler error for ${event}:`, error)
        }
      })
    }
  }

  public async destroy(): Promise<void> {
    this.log('Destroying WindowManager...')

    try {
      if (this.state.isVisible) {
        await this.hide()
      }

      if (this.reactRoot) {
        this.reactRoot.unmount()
        this.reactRoot = null
      }

      if (this.containerElement) {
        this.containerElement.remove()
        this.containerElement = null
      }

      this.cleanupFunctions.forEach((cleanup) => {
        try {
          cleanup()
        } catch (error) {
          logger.warn('Cleanup function failed:', error)
        }
      })
      this.cleanupFunctions = []

      this.eventHandlers.clear()

      this.state = {
        isVisible: false,
        isInitialized: false,
        sfHost: null,
        searchResults: {},
        isLoading: false,
        hasSession: false,
        closeOnNavigate: true,
        navigationMode: 'auto',
        fuzzySearch: true
      }

      this.log('WindowManager destroyed successfully')
    } catch (error) {
      logger.error('Error during WindowManager destruction:', error)
    }
  }

  private log(message: string, ...args: any[]): void {
    if (this.options.debugMode) {
      logger.debug(`[WindowManager] ${message}`, ...args)
    }
  }

  public getDebugInfo(): object {
    return {
      containerId: this.options.containerId,
      useShadowDOM: this.options.useShadowDOM,
      state: this.state,
      hasContainer: !!this.containerElement,
      hasReactRoot: !!this.reactRoot,
      eventHandlers: Array.from(this.eventHandlers.keys()),
      cleanupFunctions: this.cleanupFunctions.length
    }
  }
}

export default UltraForceWindowManager
export type { WindowManagerState, WindowManagerOptions }
