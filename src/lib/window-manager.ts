import React from 'react'
import { createRoot } from 'react-dom/client'
import SearchModal from '~components/search/SearchModal'
import ErrorBoundary from '~components/ErrorBoundary'
import { searchSalesforceMetadata, executeCustomCommand, isApiAvailable, type CustomCommandOptions } from '~lib/salesforce-api'
import { getSfHost, getSession, sfRest, API_VERSION } from '~lib/auth'
import { logger } from '~lib/logger'
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
import type { SearchResult, NavigationMode, RecordContext } from '~types'
import type { ObjectAction } from '~components/search/ResultItem'

// Facade re-exports: keep all external importers unchanged
export { getSetupHost, buildSetupUrl, resolveSetupShortcutPath, getCurrentRecordFromUrl, shouldUseLightning } from '~lib/url-builder'
export { SETUP_SHORTCUTS } from '~lib/setup-shortcuts'
export type { SetupShortcut } from '~lib/setup-shortcuts'

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
const GLOBAL_DESCRIBE_CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Standard object key prefixes for Classic URL object resolution
const KEY_PREFIX_MAP: Record<string, string> = {
  '001': 'Account',
  '003': 'Contact',
  '005': 'User',
  '006': 'Opportunity',
  '00Q': 'Lead',
  '00T': 'Task',
  '00U': 'Event',
  '00O': 'Report',
  '00a': 'Asset',
  '00e': 'UserProfileFeed',
  '00l': 'EmailTemplate',
  '00N': 'CustomField',
  '00P': 'Document',
  '00S': 'Solution',
  '012': 'RecordType',
  '500': 'Case',
  '701': 'Campaign',
  '800': 'Order',
  '801': 'OrderItem'
}

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
  private sobjectPrefixCache: Record<string, Record<string, string>> = {}
  private sobjectCacheTimestamp: Record<string, number> = {}
  private currentUserProfileId: Record<string, string> = {}
  private userLightningPreferenceCache: Record<string, boolean> = {}
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

        // Fetch user Lightning preference in background (non-blocking)
        if (this.state.hasSession) {
          this.getUserLightningPreference().catch(() => {})
        }
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
    if (!this.state.sfHost || !objectApiName) {
      return
    }

    try {
      const record = await sfRest(this.state.sfHost, `/services/data/v${API_VERSION}/sobjects/${objectApiName}/${recordId}?fields=RecordTypeId`)
      if (record?.RecordTypeId && this.state.recordContext) {
        this.state.recordContext.recordTypeId = record.RecordTypeId
        await this.renderComponent()
      }
    } catch {
      // Record may not have RecordType field
    }
  }

  private async handleFieldsNavigation(): Promise<void> {
    if (!this.state.recordContext?.objectApiName) {
      this.state.searchError = 'No object found for this record.'
      await this.renderComponent()
      return
    }

    // Show loading state
    this.state.isLoading = true
    await this.renderComponent()

    try {
      const objectApiName = this.state.recordContext.objectApiName
      const useLightning = shouldUseLightning(this.state.navigationMode, this.state.userLightningPreference)

      let url: string | null = null

      if (useLightning) {
        // Get object DurableId for Lightning URL
        const entityQuery = `SELECT DurableId FROM EntityDefinition WHERE QualifiedApiName='${objectApiName}' LIMIT 1`
        const entityResp = await sfRest(this.state.sfHost!, `/services/data/v${API_VERSION}/tooling/query/?q=${encodeURIComponent(entityQuery)}`)
        const objectDurableId = entityResp?.records?.[0]?.DurableId

        if (objectDurableId) {
          url = buildSetupUrl(this.state.sfHost!, `/lightning/setup/ObjectManager/${objectDurableId}/FieldsAndRelationships/view`)
        }
      } else {
        // Classic URL: /p/setup/layout/LayoutFieldList?type={objectApiName}&setupid={objectApiName}Fields&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3D{objectApiName}
        url = `https://${this.state.sfHost}/p/setup/layout/LayoutFieldList?type=${objectApiName}&setupid=${objectApiName}Fields&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3D${objectApiName}`
      }

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

    // Show loading state
    this.state.isLoading = true
    await this.renderComponent()

    try {
      const objectApiName = this.state.recordContext.objectApiName
      const recordTypeId = this.state.recordContext.recordTypeId
      const useLightning = shouldUseLightning(this.state.navigationMode, this.state.userLightningPreference)

      let url: string | null = null

      if (useLightning) {
        // Get object DurableId for Lightning URL
        const entityQuery = `SELECT DurableId FROM EntityDefinition WHERE QualifiedApiName='${objectApiName}' LIMIT 1`
        const entityResp = await sfRest(this.state.sfHost!, `/services/data/v${API_VERSION}/tooling/query/?q=${encodeURIComponent(entityQuery)}`)
        const objectDurableId = entityResp?.records?.[0]?.DurableId

        if (objectDurableId) {
          url = buildSetupUrl(this.state.sfHost!, `/lightning/setup/ObjectManager/${objectDurableId}/RecordTypes/${recordTypeId}/view`)
        }
      } else {
        // Classic URL: /setup/ui/recordtypefields.jsp?id={recordTypeId}&type={objectApiName}&setupid={objectApiName}Records
        url = `https://${this.state.sfHost}/setup/ui/recordtypefields.jsp?id=${recordTypeId}&type=${objectApiName}&setupid=${objectApiName}Records`
      }

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
    // Show loading state
    this.state.isLoading = true
    await this.renderComponent()

    try {
      const layoutInfo = await this.getCurrentRecordLayoutInfo()
      if (layoutInfo) {
        const useLightning = shouldUseLightning(this.state.navigationMode, this.state.userLightningPreference)
        let url: string | null

        if (useLightning) {
          url = buildSetupUrl(this.state.sfHost!, `/lightning/setup/ObjectManager/${layoutInfo.objectDurableId}/PageLayouts/${layoutInfo.layoutId}/view`)
        } else {
          // Classic URL: /layouteditor/layoutEditor.apexp?type=Account&lid=00h0I000006U7pu&retURL=%2F{recordId}
          url = `https://${this.state.sfHost}/layouteditor/layoutEditor.apexp?type=${layoutInfo.objectApiName}&lid=${layoutInfo.layoutId}&retURL=%2F${layoutInfo.recordId}`
        }

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
    const layoutInfo = await this.getCurrentRecordLayoutInfo()
    if (!layoutInfo) return null

    const useLightning = shouldUseLightning(this.state.navigationMode, this.state.userLightningPreference)
    let url: string | null

    if (useLightning) {
      url = buildSetupUrl(this.state.sfHost!, `/lightning/setup/ObjectManager/${layoutInfo.objectDurableId}/PageLayouts/${layoutInfo.layoutId}/view`)
    } else {
      url = `https://${this.state.sfHost}/layouteditor/layoutEditor.apexp?type=${layoutInfo.objectApiName}&lid=${layoutInfo.layoutId}&retURL=%2F${layoutInfo.recordId}`
    }

    if (!url) return null

    return {
      objectApiName: layoutInfo.objectApiName,
      url
    }
  }

  private async getCurrentRecordLayoutInfo(): Promise<{ objectApiName: string; objectDurableId: string; layoutId: string; recordId: string } | null> {
    const { objectApiName: fromUrlObject, recordId } = getCurrentRecordFromUrl()
    const objectApiName = fromUrlObject || (recordId ? await this.resolveObjectApiNameFromRecord(recordId) : null)

    if (!this.state.sfHost || !objectApiName || !recordId) {
      return null
    }

    try {
      let recordTypeId: string | null = null
      try {
        const record = await sfRest(this.state.sfHost, `/services/data/v${API_VERSION}/sobjects/${objectApiName}/${recordId}?fields=RecordTypeId`)
        recordTypeId = record?.RecordTypeId || null
      } catch {
        // Record may not have RecordType field
      }

      const profileId = await this.getCurrentUserProfileId()
      if (!profileId) {
        return null
      }

      const layoutResult = await this.getLayoutAssignment(objectApiName, profileId, recordTypeId)
      if (!layoutResult) {
        return null
      }

      return { objectApiName, objectDurableId: layoutResult.objectDurableId, layoutId: layoutResult.layoutId, recordId }
    } catch (error) {
      logger.warn('Failed to resolve current record layout:', error)
      return null
    }
  }

  private async resolveObjectApiNameFromRecord(recordId: string): Promise<string | null> {
    const prefix = recordId.slice(0, 3)
    if (KEY_PREFIX_MAP[prefix]) {
      return KEY_PREFIX_MAP[prefix]
    }
    if (!this.state.sfHost) {
      return null
    }

    const hostKey = this.state.sfHost
    const hostCache = this.sobjectPrefixCache[hostKey] || {}
    const cacheTs = this.sobjectCacheTimestamp[hostKey] || 0

    if (hostCache[prefix] && Date.now() - cacheTs < GLOBAL_DESCRIBE_CACHE_DURATION) {
      return hostCache[prefix]
    }

    try {
      const resp = await sfRest(this.state.sfHost, `/services/data/v${API_VERSION}/sobjects/`)
      if (resp?.sobjects) {
        if (!this.sobjectPrefixCache[hostKey]) {
          this.sobjectPrefixCache[hostKey] = {}
        }
        resp.sobjects.forEach((obj: any) => {
          if (obj.keyPrefix && obj.name) {
            this.sobjectPrefixCache[hostKey][obj.keyPrefix] = obj.name
          }
        })
        this.sobjectCacheTimestamp[hostKey] = Date.now()
      }
      return this.sobjectPrefixCache[hostKey]?.[prefix] || null
    } catch (error) {
      logger.warn('Failed to resolve object from key prefix:', error)
      return null
    }
  }

  private currentUserId: Record<string, string> = {}

  private async getCurrentUserId(): Promise<string | null> {
    if (!this.state.sfHost) {
      return null
    }

    const hostKey = this.state.sfHost
    if (this.currentUserId[hostKey]) {
      return this.currentUserId[hostKey]
    }

    // Skip if API is not available
    if (!isApiAvailable(this.state.sfHost)) {
      return null
    }

    try {
      const apex = encodeURIComponent('throw new System.TypeException(UserInfo.getUserId());')
      const resp = await sfRest(this.state.sfHost, `/services/data/v${API_VERSION}/tooling/executeAnonymous/?anonymousBody=${apex}`)
      const userId = resp?.exceptionMessage?.replace('System.TypeException: ', '')
      if (userId && userId.startsWith('005')) {
        this.currentUserId[hostKey] = userId
        return userId
      }
    } catch {
      // User may not have Author Apex permission
    }
    return null
  }

  private async getCurrentUserProfileId(): Promise<string | null> {
    if (!this.state.sfHost) {
      return null
    }

    const hostKey = this.state.sfHost
    if (this.currentUserProfileId[hostKey]) {
      return this.currentUserProfileId[hostKey]
    }

    const userId = await this.getCurrentUserId()
    if (!userId) {
      return null
    }

    try {
      const soql = encodeURIComponent(`SELECT ProfileId FROM User WHERE Id = '${userId}'`)
      const resp = await sfRest(this.state.sfHost, `/services/data/v${API_VERSION}/query/?q=${soql}`)
      const profileId = resp?.records?.[0]?.ProfileId
      if (profileId) {
        this.currentUserProfileId[hostKey] = profileId
        return profileId
      }
    } catch {
      // ignore
    }
    return null
  }

  private async getUserLightningPreference(): Promise<boolean | null> {
    if (!this.state.sfHost) {
      return null
    }

    const hostKey = this.state.sfHost
    if (hostKey in this.userLightningPreferenceCache) {
      return this.userLightningPreferenceCache[hostKey]
    }

    const userId = await this.getCurrentUserId()
    if (!userId) {
      this.userLightningPreferenceCache[hostKey] = true
      this.state.userLightningPreference = true
      return true
    }

    try {
      const soql = encodeURIComponent(`SELECT UserPreferencesLightningExperiencePreferred FROM User WHERE Id = '${userId}'`)
      const resp = await sfRest(this.state.sfHost, `/services/data/v${API_VERSION}/query/?q=${soql}`)
      const preference = resp?.records?.[0]?.UserPreferencesLightningExperiencePreferred

      if (typeof preference === 'boolean') {
        this.userLightningPreferenceCache[hostKey] = preference
        this.state.userLightningPreference = preference
        return preference
      }
    } catch {
      // ignore
    }

    this.userLightningPreferenceCache[hostKey] = true
    this.state.userLightningPreference = true
    return true
  }

  private async getLayoutAssignment(objectApiName: string, profileId: string, recordTypeId: string | null): Promise<{ layoutId: string; objectDurableId: string } | null> {
    if (!this.state.sfHost) {
      return null
    }

    let objectDurableId: string | null = null
    try {
      const entityQuery = `SELECT DurableId FROM EntityDefinition WHERE QualifiedApiName='${objectApiName}' LIMIT 1`
      const entityResp = await sfRest(this.state.sfHost, `/services/data/v${API_VERSION}/tooling/query/?q=${encodeURIComponent(entityQuery)}`)
      objectDurableId = entityResp?.records?.[0]?.DurableId || null
    } catch (error) {
      logger.warn('EntityDefinition query failed:', error)
    }

    if (!objectDurableId) {
      return null
    }

    const queries = [
      recordTypeId ? `SELECT LayoutId FROM ProfileLayout WHERE TableEnumOrId='${objectDurableId}' AND ProfileId='${profileId}' AND RecordTypeId='${recordTypeId}' LIMIT 1` : null,
      `SELECT LayoutId FROM ProfileLayout WHERE TableEnumOrId='${objectDurableId}' AND ProfileId='${profileId}' AND RecordTypeId = NULL LIMIT 1`
    ].filter(Boolean) as string[]

    for (const q of queries) {
      try {
        const resp = await sfRest(this.state.sfHost, `/services/data/v${API_VERSION}/tooling/query/?q=${encodeURIComponent(q)}`)
        const layoutId = resp?.records?.[0]?.LayoutId
        if (layoutId) {
          return { layoutId, objectDurableId }
        }
      } catch (error) {
        logger.warn('ProfileLayout query failed:', error)
      }
    }

    return null
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

    // Setup shortcuts are absolute URLs
    if (result.type === 'SetupShortcut' && result.url) {
      window.open(result.url, '_blank')
      if (this.state.closeOnNavigate) {
        this.hide()
      }
      return
    }

    // Navigate to the result
    if (this.state.sfHost && result.id) {
      const baseUrl = `https://${this.state.sfHost}`
      const useLightning = shouldUseLightning(this.state.navigationMode, this.state.userLightningPreference)
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
          case 'ApexPage':
            targetUrl = `${baseUrl}/lightning/setup/ApexPages/page?address=%2F${result.id}`
            break
          case 'ApexComponent':
            targetUrl = `${baseUrl}/lightning/setup/ApexComponents/page?address=%2F${result.id}`
            break
          case 'LightningComponentBundle':
            targetUrl = `${baseUrl}/lightning/setup/LightningComponentBundles/page?address=%2F${result.id}`
            break
          case 'AuraDefinitionBundle':
            targetUrl = `${baseUrl}/lightning/setup/AuraBundles/page?address=%2F${result.id}`
            break
          case 'Flow':
            targetUrl = `${baseUrl}/builder_platform_interaction/flowBuilder.app?flowId=${result.id}`
            break
          case 'User': {
            const setupHost = this.state.sfHost?.replace('.my.salesforce.com', '.my.salesforce-setup.com')
                                                ?.replace('.lightning.force.com', '.my.salesforce-setup.com')
            targetUrl = `https://${setupHost}/lightning/setup/ManageUsers/page?address=%2F${result.id}%3Fnoredirect%3D1%26isUserEntityOverride%3D1`
            break
          }
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
          case 'ProfileSubMenu':
            // Tab-only navigation, no click action
            return
          case 'ObjectPermission': {
            const setupHostObj = this.state.sfHost?.replace('.my.salesforce.com', '.my.salesforce-setup.com')
                                                   ?.replace('.lightning.force.com', '.my.salesforce-setup.com')
            const objProfileId = result.metadata?.profileId
            // Custom objects use DurableId (01Ixx), standard objects use API name
            const objectRef = result.metadata?.objectRef || result.name
            const objAddr = encodeURIComponent(`/${objProfileId}?s=ObjectsAndTabs&o=${objectRef}`)
            targetUrl = `https://${setupHostObj}/lightning/setup/Profiles/page?address=${objAddr}`
            break
          }
          case 'FieldPermission': {
            const setupHostField = this.state.sfHost?.replace('.my.salesforce.com', '.my.salesforce-setup.com')
                                                     ?.replace('.lightning.force.com', '.my.salesforce-setup.com')
            const fieldProfileId = result.metadata?.profileId
            const fieldSobjectType = result.metadata?.SobjectType
            const fieldAddr = encodeURIComponent(`/${fieldProfileId}?s=FieldPermissions&o=${fieldSobjectType}`)
            targetUrl = `https://${setupHostField}/lightning/setup/Profiles/page?address=${fieldAddr}`
            break
          }
          case 'CustomPermissionAccess': {
            const setupHostCP = this.state.sfHost?.replace('.my.salesforce.com', '.my.salesforce-setup.com')
                                                  ?.replace('.lightning.force.com', '.my.salesforce-setup.com')
            const cpProfileId = result.metadata?.profileId
            const cpAddr = encodeURIComponent(`/${cpProfileId}?s=CustomPermissions`)
            targetUrl = `https://${setupHostCP}/lightning/setup/Profiles/page?address=${cpAddr}`
            break
          }
          case 'ApexClassAccess': {
            const setupHostAC = this.state.sfHost?.replace('.my.salesforce.com', '.my.salesforce-setup.com')
                                                  ?.replace('.lightning.force.com', '.my.salesforce-setup.com')
            const acProfileId = result.metadata?.profileId
            const acAddr = encodeURIComponent(`/${acProfileId}?s=ApexClassAccess`)
            targetUrl = `https://${setupHostAC}/lightning/setup/Profiles/page?address=${acAddr}`
            break
          }
          case 'VFPageAccess': {
            const setupHostVF = this.state.sfHost?.replace('.my.salesforce.com', '.my.salesforce-setup.com')
                                                  ?.replace('.lightning.force.com', '.my.salesforce-setup.com')
            const vfProfileId = result.metadata?.profileId
            const vfAddr = encodeURIComponent(`/${vfProfileId}?s=ApexPageAccess`)
            targetUrl = `https://${setupHostVF}/lightning/setup/Profiles/page?address=${vfAddr}`
            break
          }
          case 'ConnectedAppAccess': {
            const setupHostCA = this.state.sfHost?.replace('.my.salesforce.com', '.my.salesforce-setup.com')
                                                  ?.replace('.lightning.force.com', '.my.salesforce-setup.com')
            const caProfileId = result.metadata?.profileId
            const caAddr = encodeURIComponent(`/${caProfileId}?s=ConnectedAppSettings`)
            targetUrl = `https://${setupHostCA}/lightning/setup/Profiles/page?address=${caAddr}`
            break
          }
          case 'AssignedAppAccess': {
            const setupHostAA = this.state.sfHost?.replace('.my.salesforce.com', '.my.salesforce-setup.com')
                                                  ?.replace('.lightning.force.com', '.my.salesforce-setup.com')
            const aaProfileId = result.metadata?.profileId
            const aaAddr = encodeURIComponent(`/${aaProfileId}?s=ObjectsAndTabs`)
            targetUrl = `https://${setupHostAA}/lightning/setup/Profiles/page?address=${aaAddr}`
            break
          }
          case 'ProfileSetupLink': {
            const setupHostPSL = this.state.sfHost?.replace('.my.salesforce.com', '.my.salesforce-setup.com')
                                                   ?.replace('.lightning.force.com', '.my.salesforce-setup.com')
            const pslProfileId = result.metadata?.profileId
            const pslSection = result.metadata?.section
            const pslAddr = encodeURIComponent(`/${pslProfileId}?s=${pslSection}`)
            targetUrl = `https://${setupHostPSL}/lightning/setup/Profiles/page?address=${pslAddr}`
            break
          }
          case 'CustomLabel':
            targetUrl = `${baseUrl}/lightning/setup/ExternalStrings/page?address=%2F${result.id}`
            break
          case 'CustomMetadataType': {
            const setupHost = this.state.sfHost?.replace('.my.salesforce.com', '.my.salesforce-setup.com')
                                                ?.replace('.lightning.force.com', '.my.salesforce-setup.com')
            // Use metadata.Id for the actual Salesforce record ID (result.id may be index key like "Type__mdt.RecordName")
            const recordId = result.metadata?.Id || result.metadata?.DurableId || result.id
            if (result.metadata?._isTypeDefinition) {
              // Type definition page: /lightning/setup/CustomMetadata/page?address=%2F01Ixxxxx
              targetUrl = `https://${setupHost}/lightning/setup/CustomMetadata/page?address=%2F${recordId}`
            } else {
              // Record page: /lightning/setup/CustomMetadata/page?address=%2Fm0Axxxxx
              targetUrl = `https://${setupHost}/lightning/setup/CustomMetadata/page?address=%2F${recordId}`
            }
            break
          }
          case 'CustomSetting': {
            const setupHost = this.state.sfHost?.replace('.my.salesforce.com', '.my.salesforce-setup.com')
                                                ?.replace('.lightning.force.com', '.my.salesforce-setup.com')
            const settingId = result.metadata?.DurableId || result.id
            if (result.metadata?._isSettingDefinition) {
              // Setting definition page
              targetUrl = `https://${setupHost}/lightning/setup/CustomSettings/page?address=%2Fsetup%2Fui%2FviewCustomSettings.apexp%3Fid%3D${settingId}`
            } else {
              // Setting record page
              targetUrl = `https://${setupHost}/lightning/setup/CustomSettings/page?address=%2F${result.id}`
            }
            break
          }
          case 'CustomQuery':
            // Custom query results - navigate to record directly
            targetUrl = `${baseUrl}/lightning/r/sObject/${result.id}/view`
            break
          case 'Queue': {
            const setupHost = this.state.sfHost?.replace('.my.salesforce.com', '.my.salesforce-setup.com')
                                                ?.replace('.lightning.force.com', '.my.salesforce-setup.com')
            targetUrl = `https://${setupHost}/lightning/setup/Queues/page?address=%2Fp%2Fown%2FQueue%2Fd%3Fid%3D${result.id}`
            break
          }
          case 'Group': {
            const setupHost = this.state.sfHost?.replace('.my.salesforce.com', '.my.salesforce-setup.com')
                                                ?.replace('.lightning.force.com', '.my.salesforce-setup.com')
            targetUrl = `https://${setupHost}/lightning/setup/PublicGroups/page?address=%2Fsetup%2Fown%2Fgroupdetail.jsp%3Fid%3D${result.id}`
            break
          }
          case 'Report':
            targetUrl = `${baseUrl}/lightning/r/Report/${result.id}/view`
            break
          case 'Dashboard':
            targetUrl = `${baseUrl}/lightning/r/Dashboard/${result.id}/view`
            break
          default:
            targetUrl = `${baseUrl}/lightning/r/${result.type}/${result.id}/view`
        }
      } else {
        // Classic URLs
        switch (result.type) {
          case 'ApexClass':
          case 'ApexTrigger':
          case 'ApexPage':
          case 'ApexComponent':
          case 'LightningComponentBundle':
          case 'AuraDefinitionBundle':
          case 'User':
          case 'PermissionSet':
          case 'Profile':
            targetUrl = `${baseUrl}/${result.id}`
            break
          case 'ProfileSubMenu':
            // Tab-only navigation, no click action
            return
          case 'ObjectPermission': {
            const classicObjRef = result.metadata?.objectRef || result.name
            targetUrl = `${baseUrl}/${result.metadata?.profileId}?s=ObjectsAndTabs&o=${classicObjRef}`
            break
          }
          case 'FieldPermission':
            targetUrl = `${baseUrl}/${result.metadata?.profileId}?s=FieldPermissions&o=${result.metadata?.SobjectType}`
            break
          case 'CustomPermissionAccess':
            targetUrl = `${baseUrl}/${result.metadata?.profileId}?s=CustomPermissions`
            break
          case 'ApexClassAccess':
            targetUrl = `${baseUrl}/${result.metadata?.profileId}?s=ApexClassAccess`
            break
          case 'VFPageAccess':
            targetUrl = `${baseUrl}/${result.metadata?.profileId}?s=ApexPageAccess`
            break
          case 'ConnectedAppAccess':
            targetUrl = `${baseUrl}/${result.metadata?.profileId}?s=ConnectedAppSettings`
            break
          case 'AssignedAppAccess':
            targetUrl = `${baseUrl}/${result.metadata?.profileId}?s=ObjectsAndTabs`
            break
          case 'ProfileSetupLink':
            targetUrl = `${baseUrl}/${result.metadata?.profileId}?s=${result.metadata?.section}`
            break
          case 'Flow':
            targetUrl = `${baseUrl}/builder_platform_interaction/flowBuilder.app?flowId=${result.id}`
            break
          case 'CustomObject': {
            // Custom objects (DurableId '01I...') have a single Classic setup page
            const objectDurableId = result.metadata?.DurableId
            if (objectDurableId && objectDurableId.startsWith('01I')) {
              targetUrl = `${baseUrl}/${objectDurableId}`
            } else {
              // Standard objects: use keyPrefix for list view, or field list as fallback
              const keyPrefix = result.metadata?.KeyPrefix
              if (keyPrefix) {
                targetUrl = `${baseUrl}/${keyPrefix}`
              } else {
                targetUrl = `${baseUrl}/p/setup/layout/LayoutFieldList?type=${result.metadata?.QualifiedApiName}`
              }
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
          case 'CustomLabel':
            targetUrl = `${baseUrl}/${result.id}`
            break
          case 'CustomMetadataType': {
            // Use metadata.Id for the actual Salesforce record ID (result.id may be index key like "Type__mdt.RecordName")
            const classicRecordId = result.metadata?.Id || result.metadata?.DurableId || result.id
            targetUrl = `${baseUrl}/${classicRecordId}`
            break
          }
          case 'CustomSetting': {
            const settingId = result.metadata?.DurableId || result.id
            if (result.metadata?._isSettingDefinition) {
              targetUrl = `${baseUrl}/setup/ui/viewCustomSettings.apexp?id=${settingId}`
            } else {
              targetUrl = `${baseUrl}/${result.id}`
            }
            break
          }
          case 'CustomQuery':
            targetUrl = `${baseUrl}/${result.id}`
            break
          case 'Queue':
            targetUrl = `${baseUrl}/p/own/Queue/d?id=${result.id}&setupid=Queues`
            break
          case 'Group':
            targetUrl = `${baseUrl}/setup/own/groupdetail.jsp?id=${result.id}&setupid=PublicGroups`
            break
          case 'Report':
          case 'Dashboard':
            targetUrl = `${baseUrl}/${result.id}`
            break
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

  private handleIdNavigate(id: string): void {
    this.log(`Direct ID navigation: ${id}`)
    if (this.state.sfHost) {
      const baseUrl = `https://${this.state.sfHost}`
      window.open(`${baseUrl}/${id}`, '_blank')
    }
    if (this.state.closeOnNavigate) {
      this.hide()
    }
  }

  private handleActionClick(result: SearchResult, action: ObjectAction): void {
    this.log(`Action clicked: ${action} for ${result.name}`)
    this.emit('actionClick', { result, action })

    if (!this.state.sfHost) {
      this.log('Missing sfHost for action navigation')
      return
    }

    const baseUrl = `https://${this.state.sfHost}`

    // Handle preview action for ApexPage
    if (action === 'preview' && result.type === 'ApexPage') {
      const pageName = result.namespace
        ? `${result.namespace}__${result.name}`
        : result.name
      const previewUrl = `${baseUrl}/apex/${pageName}`
      window.open(previewUrl, '_blank')
      if (this.state.closeOnNavigate) {
        this.hide()
      }
      return
    }

    if (!result.metadata?.DurableId) {
      this.log('Missing DurableId for action navigation')
      return
    }

    const objectId = result.metadata.DurableId
    const objectApiName = result.metadata.QualifiedApiName
    const useLightning = shouldUseLightning(this.state.navigationMode, this.state.userLightningPreference)
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
        case 'recordtypes':
          targetUrl = `${baseUrl}/lightning/setup/ObjectManager/${objectId}/RecordTypes/view`
          break
        case 'validationrules':
          targetUrl = `${baseUrl}/lightning/setup/ObjectManager/${objectId}/ValidationRules/view`
          break
        case 'details':
          targetUrl = `${baseUrl}/lightning/setup/ObjectManager/${objectId}/Details/view`
          break
      }
    } else {
      // Classic URLs
      // Custom objects (DurableId starts with '01I') have a single setup page at /{DurableId}
      // that includes fields, page layouts, record types, etc.
      // Standard objects use separate Classic setup URLs.
      if (action === 'list') {
        const keyPrefix = result.metadata?.KeyPrefix
        targetUrl = keyPrefix ? `${baseUrl}/${keyPrefix}` : `${baseUrl}/p/setup/layout/LayoutFieldList?type=${objectApiName}`
      } else if (objectId && objectId.startsWith('01I')) {
        targetUrl = `${baseUrl}/${objectId}`
      } else {
        switch (action) {
          case 'fields':
            targetUrl = `${baseUrl}/p/setup/layout/LayoutFieldList?type=${objectApiName}`
            break
          case 'layouts':
            targetUrl = `${baseUrl}/ui/setup/layout/PageLayouts?type=${objectApiName}`
            break
          case 'recordtypes':
            targetUrl = `${baseUrl}/setup/ui/recordtypeselect.jsp?type=${objectApiName}&setupid=${objectApiName}Records`
            break
          case 'validationrules':
            targetUrl = `${baseUrl}/p/setup/vr/listvr.jsp?type=${objectApiName}&setupid=${objectApiName}ValidationRules`
            break
          case 'details':
            targetUrl = `${baseUrl}/p/setup/layout/LayoutFieldList?type=${objectApiName}`
            break
        }
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
