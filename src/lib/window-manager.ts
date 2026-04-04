import React from 'react'
import { createRoot } from 'react-dom/client'
import SearchModal from '~components/search/SearchModal'
import ErrorBoundary from '~components/ErrorBoundary'
import { searchSalesforceMetadata, executeCustomCommand, type CustomCommandOptions } from '~lib/salesforce-api'
import { getSfHost, getSession } from '~lib/auth'
import { logger } from '~lib/logger'
import { STORAGE_KEYS, storageGet, onStorageChanged, offStorageChanged, type SearchSettings } from '~lib/storage-service'
import { createKeyboardInterceptor } from '~lib/keyboard-interceptor'
import { TypedEventEmitter } from '~lib/typed-event-emitter'
import {
  getSetupHost,
  buildSetupUrl,
  resolveSetupShortcutPath,
  getCurrentRecordFromUrl,
  shouldUseLightning
} from '~lib/url-builder'
import { SETUP_SHORTCUTS } from '~lib/setup-shortcuts'
import { buildNavigationUrl, buildIdNavigationUrl, buildActionUrl } from '~lib/navigation'
import type { NavigationContext } from '~lib/navigation'
import {
  fetchRecordTypeId as fetchRecordTypeIdFn,
  resolveObjectApiNameFromRecord as resolveObjectApiNameFromRecordFn,
  getCurrentRecordLayoutInfo as getCurrentRecordLayoutInfoFn,
  getCurrentUserProfileId as getCurrentUserProfileIdFn,
  getUserLightningPreference as getUserLightningPreferenceFn,
  getLayoutAssignment as getLayoutAssignmentFn,
  handleFieldsNavigation as handleFieldsNavigationFn,
  handleRecordTypeNavigation as handleRecordTypeNavigationFn
} from '~lib/record-context'
import type { SearchResult, NavigationMode, RecordContext } from '~types'
import type { ObjectAction } from '~components/search/ResultItem'

// Facade re-exports: keep all external importers unchanged
export { getSetupHost, buildSetupUrl, resolveSetupShortcutPath, getCurrentRecordFromUrl, shouldUseLightning } from '~lib/url-builder'
export { SETUP_SHORTCUTS } from '~lib/setup-shortcuts'
export type { SetupShortcut } from '~lib/setup-shortcuts'
export { buildNavigationUrl, buildIdNavigationUrl, buildActionUrl, KEY_PREFIX_MAP } from '~lib/navigation'
export type { NavigationContext } from '~lib/navigation'
export {
  fetchRecordTypeId,
  getCurrentRecordLayoutInfo,
  resolveObjectApiNameFromRecord,
  getCurrentUserId,
  getCurrentUserProfileId,
  getUserLightningPreference,
  getLayoutAssignment
} from '~lib/record-context'

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
  searchError: string | null
  userLightningPreference: boolean | null
  recordContext: RecordContext | null
}

interface WindowManagerOptions {
  containerId?: string
  useShadowDOM?: boolean
  debugMode?: boolean
}

const CONTAINER_PREFIX = 'ultraforce-modal'
const CLEANUP_DELAY = 100
const MAX_CLEANUP_ATTEMPTS = 3

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
    fuzzySearch: true,
    searchError: null,
    userLightningPreference: null,
    recordContext: null
  }

  private options: Required<WindowManagerOptions> = {
    containerId: `${CONTAINER_PREFIX}-${Date.now()}`,
    useShadowDOM: true,
    debugMode: false
  }

  private eventEmitter = new TypedEventEmitter<Record<string, any>>()
  private keyboardInterceptor: ((e: KeyboardEvent) => void) | null = null

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
      } catch {
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

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes[STORAGE_KEYS.SEARCH_SETTINGS]) {
        const newSettings = changes[STORAGE_KEYS.SEARCH_SETTINGS].newValue as SearchSettings | undefined
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

    onStorageChanged(handleStorageChange)
    this.cleanupFunctions.push(() => {
      offStorageChanged(handleStorageChange)
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

        // Fetch user Lightning preference in background (non-blocking)
        if (this.state.hasSession) {
          this.getUserLightningPreference().catch(() => {})
        }
      }

      const settings = await storageGet<SearchSettings>(STORAGE_KEYS.SEARCH_SETTINGS)
      if (settings?.closeOnNavigate !== undefined) {
        this.state.closeOnNavigate = settings.closeOnNavigate
      }
      if (settings?.navigationMode) {
        this.state.navigationMode = settings.navigationMode
      }
      if (settings?.fuzzySearch !== undefined) {
        this.state.fuzzySearch = settings.fuzzySearch
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

    await this.loadState()

    // Detect record context
    const { objectApiName: urlObjectApiName, recordId } = getCurrentRecordFromUrl()
    if (recordId) {
      // For Classic URLs, objectApiName is null - resolve it from record ID
      let objectApiName = urlObjectApiName
      if (!objectApiName) {
        objectApiName = await this.resolveObjectApiNameFromRecord(recordId)
        this.log('Resolved objectApiName from recordId:', objectApiName)
      }
      this.state.recordContext = { objectApiName, recordId }
      // Fetch RecordTypeId in background (don't block show)
      if (objectApiName) {
        this.fetchRecordTypeId(objectApiName, recordId)
      }
      this.log('Record context detected:', this.state.recordContext)
    } else {
      this.state.recordContext = null
    }

    this.state.isVisible = true
    this.log('Showing modal')

    // Signal to the main-world keyboard-shield script that the modal is open.
    // keyboard-shield.ts monkey-patches addEventListener so that ALL page-level
    // keyboard listeners (including Salesforce's) are suppressed when this
    // attribute is present. This works because the shield runs at document_start
    // in the MAIN world, wrapping listeners before Salesforce registers them.
    document.documentElement.setAttribute('data-ultraforce-modal-open', '')
    logger.debug('keyboard:shield activated')

    // Capture-phase keyboard interceptor handles input for Shadow DOM
    // and manually applies edits to our Shadow DOM input
    this.keyboardInterceptor = createKeyboardInterceptor(
      () => this.shadowRoot?.querySelector('[data-ultraforce-input]') as HTMLInputElement | null,
      () => this.shadowRoot?.querySelector('[data-ultraforce-modal]') as HTMLElement | null
    )

    // Add to window level to intercept before document level handlers
    window.addEventListener('keydown', this.keyboardInterceptor, true)
    window.addEventListener('keyup', this.keyboardInterceptor, true)
    window.addEventListener('keypress', this.keyboardInterceptor, true)
    logger.debug('keyboard:interceptor added')

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

    // Remove keyboard interceptor
    if (this.keyboardInterceptor) {
      window.removeEventListener('keydown', this.keyboardInterceptor, true)
      window.removeEventListener('keyup', this.keyboardInterceptor, true)
      window.removeEventListener('keypress', this.keyboardInterceptor, true)
      this.keyboardInterceptor = null
    }

    // Tell the main-world keyboard-shield to stop suppressing page shortcuts
    document.documentElement.removeAttribute('data-ultraforce-modal-open')
    logger.debug('keyboard:shield deactivated')

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
          onCustomSearch: this.handleCustomSearch.bind(this),
          onSetupSearch: this.handleSetupShortcutSearch.bind(this),
          onResultClick: this.handleResultClick.bind(this),
          onIdNavigate: this.handleIdNavigate.bind(this),
          onActionClick: this.handleActionClick.bind(this),
          onClearResults: this.handleClearResults.bind(this),
          searchResults: this.state.searchResults,
          isLoading: this.state.isLoading,
          sfHost: this.state.sfHost,
          hasSession: this.state.hasSession,
          navigationMode: this.state.navigationMode,
          onNavigationModeChange: this.handleNavigationModeChange.bind(this),
          fuzzySearch: this.state.fuzzySearch,
          onFuzzySearchChange: this.handleFuzzySearchChange.bind(this),
          searchError: this.state.searchError,
          recordContext: this.state.recordContext,
          onPageLayoutClick: this.handlePageLayoutNavigation.bind(this),
          onRecordTypeClick: this.handleRecordTypeNavigation.bind(this),
          onFieldsClick: this.handleFieldsNavigation.bind(this)
        })
      )
    )

    this.log('React component rendered with error boundary')
  }

  private async handleSearch(query: string, selectedTypes: string[], useFuzzy: boolean, hideManagedPkg: boolean): Promise<void> {
    this.log(`Search requested: "${query}" for types: ${selectedTypes.join(', ')}, fuzzy: ${useFuzzy}, hideManagedPkg: ${hideManagedPkg}`)

    if (!this.state.sfHost) {
      logger.error('No SF host available for search')
      return
    }

    const currentNonce = ++this.searchNonce
    this.state.isLoading = true
    this.state.searchError = null
    this.emit('searchStart', { query, selectedTypes })

    // Render loading state immediately
    await this.renderComponent()

    try {
      const results = await searchSalesforceMetadata(query, selectedTypes, this.state.sfHost, { useFuzzy, hideManagedPackage: hideManagedPkg })

      if (currentNonce !== this.searchNonce) {
        this.log(`Discarding stale search results (nonce ${currentNonce} vs ${this.searchNonce})`)
        return
      }

      this.state.searchResults = results
      this.emit('searchSuccess', results)
    } catch (error: any) {
      if (currentNonce !== this.searchNonce) {
        return
      }
      logger.error('Search failed:', error)
      this.state.searchError = error.message || 'Search failed'
      this.emit('searchError', error)
    } finally {
      if (currentNonce === this.searchNonce) {
        this.state.isLoading = false
        this.emit('searchEnd')
        await this.renderComponent()
      }
    }
  }

  private async handleCustomSearch(soqlTemplate: string, query: string, useToolingApi: boolean, nameField: string, descriptionFields?: string[]): Promise<void> {
    this.log(`Custom search requested: "${query}" with template, tooling: ${useToolingApi}`)

    if (!this.state.sfHost) {
      logger.error('No SF host available for custom search')
      return
    }

    const currentNonce = ++this.searchNonce
    this.state.isLoading = true
    this.state.searchError = null
    this.emit('searchStart', { query, customCommand: true })

    await this.renderComponent()

    try {
      const options: CustomCommandOptions = {
        soqlTemplate,
        searchQuery: query,
        useToolingApi,
        nameField,
        descriptionFields
      }
      const results = await executeCustomCommand(options, this.state.sfHost)

      if (currentNonce !== this.searchNonce) {
        this.log(`Discarding stale custom search results (nonce ${currentNonce} vs ${this.searchNonce})`)
        return
      }

      this.state.searchResults = { CustomQuery: results }
      this.emit('searchSuccess', this.state.searchResults)
    } catch (error: any) {
      if (currentNonce !== this.searchNonce) {
        return
      }
      logger.error('Custom search failed:', error)
      this.state.searchError = error.message || 'Custom search failed'
      this.state.searchResults = {}
      this.emit('searchError', error)
    } finally {
      if (currentNonce === this.searchNonce) {
        this.state.isLoading = false
        this.emit('searchEnd')
        await this.renderComponent()
      }
    }
  }

  private async handleSetupShortcutSearch(query: string): Promise<void> {
    const normalized = query.trim().toLowerCase()
    const searchTerms = normalized.split(/\s+/).filter(Boolean)

    const matchesAllTerms = (text: string): boolean => {
      if (searchTerms.length === 0) {
        return true
      }
      const lowerText = text.toLowerCase()
      return searchTerms.every((term) => lowerText.includes(term))
    }

    if (!buildSetupUrl(this.state.sfHost, '')) {
      this.state.searchResults = { SetupShortcut: [] }
      this.state.searchError = 'Open a Salesforce tab to use setup shortcuts.'
      this.state.isLoading = false
      await this.renderComponent()
      return
    }

    const results: SearchResult[] = []

    const currentLayout = await this.getCurrentRecordLayoutUrl()
    if (currentLayout) {
      const name = `${currentLayout.objectApiName} Page Layout`
      const desc = 'Open page layout used by current record'
      const combinedText = `${name} ${desc} current`
      if (matchesAllTerms(combinedText)) {
        results.push({
          id: 'current-record-layout',
          name,
          type: 'SetupShortcut',
          description: desc,
          url: currentLayout.url
        })
      }
    }

    const shortcuts = [...SETUP_SHORTCUTS]

    const useLightning = shouldUseLightning(this.state.navigationMode, this.state.userLightningPreference)

    const listResults = shortcuts
      .filter((shortcut) => {
        const combinedText = `${shortcut.name} ${shortcut.description}`
        return matchesAllTerms(combinedText)
      })
      .map((shortcut) => {
        let url: string | null = null

        if (useLightning) {
          const resolvedPath = resolveSetupShortcutPath(shortcut, this.state.sfHost)
          url = buildSetupUrl(this.state.sfHost, resolvedPath)
        } else if (shortcut.classicPath && this.state.sfHost) {
          url = `https://${this.state.sfHost}${shortcut.classicPath}`
        } else {
          const resolvedPath = resolveSetupShortcutPath(shortcut, this.state.sfHost)
          url = buildSetupUrl(this.state.sfHost, resolvedPath)
        }

        return {
          id: shortcut.id,
          name: shortcut.name,
          type: 'SetupShortcut',
          description: shortcut.description,
          url: url || undefined
        } as SearchResult
      })

    this.state.searchResults = { SetupShortcut: [...results, ...listResults] }
    this.state.searchError = null
    this.state.isLoading = false
    await this.renderComponent()
  }

  private async fetchRecordTypeId(objectApiName: string | null, recordId: string): Promise<void> {
    if (!this.state.sfHost || !objectApiName) return
    const recordTypeId = await fetchRecordTypeIdFn(this.state.sfHost, objectApiName, recordId)
    if (recordTypeId && this.state.recordContext) {
      this.state.recordContext.recordTypeId = recordTypeId
      await this.renderComponent()
    }
  }

  private async handleFieldsNavigation(): Promise<void> {
    if (!this.state.recordContext?.objectApiName) {
      this.state.searchError = 'No object found for this record.'
      await this.renderComponent()
      return
    }
    this.state.isLoading = true
    await this.renderComponent()
    try {
      const url = await handleFieldsNavigationFn(
        this.state.sfHost!,
        this.state.recordContext.objectApiName,
        this.state.navigationMode,
        this.state.userLightningPreference
      )
      if (url) {
        this.state.isLoading = false
        window.open(url, '_blank')
        if (this.state.closeOnNavigate) {
          this.hide()
        } else {
          await this.renderComponent()
        }
        return
      }
      this.state.searchError = 'Could not determine Fields URL.'
      this.state.isLoading = false
      await this.renderComponent()
    } catch (error) {
      logger.error('Failed to navigate to Fields:', error)
      this.state.searchError = 'Failed to load Fields information.'
      this.state.isLoading = false
      await this.renderComponent()
    }
  }

  private async handleRecordTypeNavigation(): Promise<void> {
    if (!this.state.recordContext?.recordTypeId || !this.state.recordContext?.objectApiName) {
      this.state.searchError = 'No RecordType found for this record.'
      await this.renderComponent()
      return
    }
    this.state.isLoading = true
    await this.renderComponent()
    try {
      const url = await handleRecordTypeNavigationFn(
        this.state.sfHost!,
        this.state.recordContext.objectApiName,
        this.state.recordContext.recordTypeId,
        this.state.navigationMode,
        this.state.userLightningPreference
      )
      if (url) {
        this.state.isLoading = false
        window.open(url, '_blank')
        if (this.state.closeOnNavigate) {
          this.hide()
        } else {
          await this.renderComponent()
        }
        return
      }
      this.state.searchError = 'Could not determine RecordType URL.'
      this.state.isLoading = false
      await this.renderComponent()
    } catch (error) {
      logger.error('Failed to navigate to RecordType:', error)
      this.state.searchError = 'Failed to load RecordType information.'
      this.state.isLoading = false
      await this.renderComponent()
    }
  }

  private async handlePageLayoutNavigation(): Promise<void> {
    this.state.isLoading = true
    await this.renderComponent()
    try {
      const result = await this.getCurrentRecordLayoutUrl()
      if (result) {
        this.state.isLoading = false
        window.open(result.url, '_blank')
        if (this.state.closeOnNavigate) {
          this.hide()
        } else {
          await this.renderComponent()
        }
        return
      }
      this.state.searchError = 'Could not determine page layout for this record.'
      this.state.isLoading = false
      await this.renderComponent()
    } catch (error) {
      logger.error('Failed to navigate to page layout:', error)
      this.state.searchError = 'Failed to load page layout information.'
      this.state.isLoading = false
      await this.renderComponent()
    }
  }

  private async getCurrentRecordLayoutUrl(): Promise<{ objectApiName: string; url: string } | null> {
    const { objectApiName: fromUrlObject, recordId } = getCurrentRecordFromUrl()
    const objectApiName = fromUrlObject || (recordId && this.state.sfHost ? await resolveObjectApiNameFromRecordFn(this.state.sfHost, recordId) : null)
    if (!this.state.sfHost || !objectApiName || !recordId) return null
    const layoutInfo = await getCurrentRecordLayoutInfoFn(this.state.sfHost, objectApiName, recordId)
    if (!layoutInfo) return null
    const useLightning = shouldUseLightning(this.state.navigationMode, this.state.userLightningPreference)
    const url = useLightning
      ? buildSetupUrl(this.state.sfHost, `/lightning/setup/ObjectManager/${layoutInfo.objectDurableId}/PageLayouts/${layoutInfo.layoutId}/view`)
      : `https://${this.state.sfHost}/layouteditor/layoutEditor.apexp?type=${layoutInfo.objectApiName}&lid=${layoutInfo.layoutId}&retURL=%2F${layoutInfo.recordId}`
    if (!url) return null
    return { objectApiName: layoutInfo.objectApiName, url }
  }

  private async resolveObjectApiNameFromRecord(recordId: string): Promise<string | null> {
    if (!this.state.sfHost) return null
    return resolveObjectApiNameFromRecordFn(this.state.sfHost, recordId)
  }

  private async getUserLightningPreference(): Promise<boolean | null> {
    if (!this.state.sfHost) return null
    const pref = await getUserLightningPreferenceFn(this.state.sfHost)
    if (pref !== null) {
      this.state.userLightningPreference = pref
    }
    return pref
  }

  private handleNavigationModeChange(mode: NavigationMode): void {
    this.state.navigationMode = mode
    this.log(`Navigation mode changed to: ${mode}`)
  }

  private handleFuzzySearchChange(value: boolean): void {
    this.state.fuzzySearch = value
    this.log(`Fuzzy search changed to: ${value}`)
  }

  private async handleClearResults(): Promise<void> {
    this.state.searchResults = {}
    this.state.searchError = null
    await this.renderComponent()
  }

  private handleResultClick(result: SearchResult): void {
    this.log(`Result clicked: ${result.name} (${result.type})`)
    this.emit('resultClick', result)

    const navContext: NavigationContext = {
      sfHost: this.state.sfHost,
      navigationMode: this.state.navigationMode,
      userLightningPreference: this.state.userLightningPreference
    }
    const targetUrl = buildNavigationUrl(result, navContext)
    if (targetUrl) {
      window.open(targetUrl, '_blank')
    }
    if (this.state.closeOnNavigate) {
      this.hide()
    }
  }

  private handleIdNavigate(id: string): void {
    this.log(`Direct ID navigation: ${id}`)
    const navContext: NavigationContext = {
      sfHost: this.state.sfHost,
      navigationMode: this.state.navigationMode,
      userLightningPreference: this.state.userLightningPreference
    }
    const targetUrl = buildIdNavigationUrl(id, navContext)
    if (targetUrl) {
      window.open(targetUrl, '_blank')
    }
    if (this.state.closeOnNavigate) {
      this.hide()
    }
  }

  private handleActionClick(result: SearchResult, action: ObjectAction): void {
    this.log(`Action clicked: ${action} for ${result.name}`)
    this.emit('actionClick', { result, action })

    const navContext: NavigationContext = {
      sfHost: this.state.sfHost,
      navigationMode: this.state.navigationMode,
      userLightningPreference: this.state.userLightningPreference
    }
    const targetUrl = buildActionUrl(result, action, navContext)
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

  public on(event: string, handler: (data: any) => void): void {
    this.eventEmitter.on(event, handler)
  }

  public off(event: string, handler: (data: any) => void): void {
    this.eventEmitter.off(event, handler)
  }

  private emit(event: string, data?: any): void {
    this.eventEmitter.emit(event, data)
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

      this.eventEmitter.clearAll()

      this.state = {
        isVisible: false,
        isInitialized: false,
        sfHost: null,
        searchResults: {},
        isLoading: false,
        hasSession: false,
        closeOnNavigate: true,
        navigationMode: 'auto',
        fuzzySearch: true,
        searchError: null,
        userLightningPreference: null,
        recordContext: null
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
      eventEmitter: 'TypedEventEmitter',
      cleanupFunctions: this.cleanupFunctions.length
    }
  }
}

export default UltraForceWindowManager
export type { WindowManagerState, WindowManagerOptions }
