import React from 'react'
import { createRoot } from 'react-dom/client'
import SearchModal from '~components/search/SearchModal'
import ErrorBoundary from '~components/ErrorBoundary'
import { searchSalesforceMetadata, executeCustomCommand, type CustomCommandOptions } from '~lib/salesforce-api'
import { getSfHost, getSession } from '~lib/auth'
import { logger } from '~lib/logger'
import { useSettingsStore } from '~stores/settings-store'
import { useSessionStore } from '~stores/session-store'
import { useSearchStore } from '~stores/search-store'
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

/**
 * Composite state type for backward compatibility.
 * All state is now managed by Zustand stores; this interface
 * aggregates them for getState() / updateState() callers.
 */
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
  private _isInitialized = false

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
      await this.loadSession()

      this._isInitialized = true
      this.log('WindowManager initialized successfully')

      this.emit('initialized', this.getState())
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
      if (document.hidden && useSearchStore.getState().isVisible) {
        this.log('Page hidden, keeping modal state')
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    this.cleanupFunctions.push(() => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    })
  }

  /** Loads session info (sfHost, hasSession) into the session store. */
  private async loadSession(): Promise<void> {
    try {
      const sfHost = await getSfHost(window.location.href)
      if (sfHost) {
        this.log('SF Host detected:', sfHost)

        const session = await getSession(sfHost)
        const hasSession = session !== null
        useSessionStore.getState().setSession(sfHost, hasSession)
        this.log('Session status:', hasSession ? 'Active' : 'None')

        if (hasSession) {
          this.fetchLightningPreference().catch(() => {})
        }
      }
    } catch (error) {
      logger.warn('Failed to load session:', error)
    }
  }

  public async toggle(): Promise<void> {
    if (useSearchStore.getState().isVisible) {
      await this.hide()
    } else {
      await this.show()
    }
  }

  public async show(): Promise<void> {
    if (!this._isInitialized) {
      throw new Error('WindowManager not initialized')
    }

    if (useSearchStore.getState().isVisible) {
      this.log('Modal already visible')
      return
    }

    await this.loadSession()

    // Detect record context
    const { objectApiName: urlObjectApiName, recordId } = getCurrentRecordFromUrl()
    if (recordId) {
      let objectApiName = urlObjectApiName
      if (!objectApiName) {
        objectApiName = await this.resolveObjectApiNameFromRecord(recordId)
        this.log('Resolved objectApiName from recordId:', objectApiName)
      }
      useSearchStore.getState().setRecordContext({ objectApiName, recordId })
      if (objectApiName) {
        this.fetchRecordTypeId(objectApiName, recordId)
      }
      this.log('Record context detected:', useSearchStore.getState().recordContext)
    } else {
      useSearchStore.getState().setRecordContext(null)
    }

    useSearchStore.getState().show()
    this.log('Showing modal')

    document.documentElement.setAttribute('data-ultraforce-modal-open', '')
    logger.debug('keyboard:shield activated')

    this.keyboardInterceptor = createKeyboardInterceptor(
      () => this.shadowRoot?.querySelector('[data-ultraforce-input]') as HTMLInputElement | null,
      () => this.shadowRoot?.querySelector('[data-ultraforce-modal]') as HTMLElement | null
    )

    window.addEventListener('keydown', this.keyboardInterceptor, true)
    window.addEventListener('keyup', this.keyboardInterceptor, true)
    window.addEventListener('keypress', this.keyboardInterceptor, true)
    logger.debug('keyboard:interceptor added')

    await this.renderComponent()
    this.emit('show', this.getState())
  }

  public async hide(): Promise<void> {
    if (!useSearchStore.getState().isVisible) {
      this.log('Modal already hidden')
      return
    }

    useSearchStore.getState().hide()
    this.log('Hiding modal')

    if (this.keyboardInterceptor) {
      window.removeEventListener('keydown', this.keyboardInterceptor, true)
      window.removeEventListener('keyup', this.keyboardInterceptor, true)
      window.removeEventListener('keypress', this.keyboardInterceptor, true)
      this.keyboardInterceptor = null
    }

    document.documentElement.removeAttribute('data-ultraforce-modal-open')
    logger.debug('keyboard:shield deactivated')

    if (this.reactRoot) {
      this.reactRoot.unmount()
      this.reactRoot = null
    }

    this.emit('hide', this.getState())
  }

  /** Mounts the React tree. Only called once per show(). Components self-update via stores. */
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
          onClose: this.hide,
          onSearch: this.handleSearch.bind(this),
          onCustomSearch: this.handleCustomSearch.bind(this),
          onSetupSearch: this.handleSetupShortcutSearch.bind(this),
          onResultClick: this.handleResultClick.bind(this),
          onIdNavigate: this.handleIdNavigate.bind(this),
          onActionClick: this.handleActionClick.bind(this),
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

    const { sfHost } = useSessionStore.getState()
    if (!sfHost) {
      logger.error('No SF host available for search')
      return
    }

    const currentNonce = ++this.searchNonce
    useSearchStore.getState().setLoading(true)
    this.emit('searchStart', { query, selectedTypes })

    try {
      const results = await searchSalesforceMetadata(query, selectedTypes, sfHost, { useFuzzy, hideManagedPackage: hideManagedPkg })

      if (currentNonce !== this.searchNonce) {
        this.log(`Discarding stale search results (nonce ${currentNonce} vs ${this.searchNonce})`)
        return
      }

      useSearchStore.getState().setResults(results)
      this.emit('searchSuccess', results)
    } catch (error: any) {
      if (currentNonce !== this.searchNonce) {
        return
      }
      logger.error('Search failed:', error)
      useSearchStore.getState().setError(error.message || 'Search failed')
      this.emit('searchError', error)
    }
  }

  private async handleCustomSearch(soqlTemplate: string, query: string, useToolingApi: boolean, nameField: string, descriptionFields?: string[]): Promise<void> {
    this.log(`Custom search requested: "${query}" with template, tooling: ${useToolingApi}`)

    const { sfHost } = useSessionStore.getState()
    if (!sfHost) {
      logger.error('No SF host available for custom search')
      return
    }

    const currentNonce = ++this.searchNonce
    useSearchStore.getState().setLoading(true)
    this.emit('searchStart', { query, customCommand: true })

    try {
      const options: CustomCommandOptions = {
        soqlTemplate,
        searchQuery: query,
        useToolingApi,
        nameField,
        descriptionFields
      }
      const results = await executeCustomCommand(options, sfHost)

      if (currentNonce !== this.searchNonce) {
        this.log(`Discarding stale custom search results (nonce ${currentNonce} vs ${this.searchNonce})`)
        return
      }

      useSearchStore.getState().setResults({ CustomQuery: results })
      this.emit('searchSuccess', { CustomQuery: results })
    } catch (error: any) {
      if (currentNonce !== this.searchNonce) {
        return
      }
      logger.error('Custom search failed:', error)
      useSearchStore.getState().setError(error.message || 'Custom search failed')
      this.emit('searchError', error)
    }
  }

  private async handleSetupShortcutSearch(query: string): Promise<void> {
    const { sfHost } = useSessionStore.getState()
    const { navigationMode } = useSettingsStore.getState()
    const { userLightningPreference } = useSessionStore.getState()

    const normalized = query.trim().toLowerCase()
    const searchTerms = normalized.split(/\s+/).filter(Boolean)

    const matchesAllTerms = (text: string): boolean => {
      if (searchTerms.length === 0) {
        return true
      }
      const lowerText = text.toLowerCase()
      return searchTerms.every((term) => lowerText.includes(term))
    }

    if (!buildSetupUrl(sfHost, '')) {
      useSearchStore.setState({
        searchResults: { SetupShortcut: [] },
        searchError: 'Open a Salesforce tab to use setup shortcuts.',
        isLoading: false
      })
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

    const useLightning = shouldUseLightning(navigationMode, userLightningPreference)

    const listResults = shortcuts
      .filter((shortcut) => {
        const combinedText = `${shortcut.name} ${shortcut.description}`
        return matchesAllTerms(combinedText)
      })
      .map((shortcut) => {
        let url: string | null = null

        if (useLightning) {
          const resolvedPath = resolveSetupShortcutPath(shortcut, sfHost)
          url = buildSetupUrl(sfHost, resolvedPath)
        } else if (shortcut.classicPath && sfHost) {
          url = `https://${sfHost}${shortcut.classicPath}`
        } else {
          const resolvedPath = resolveSetupShortcutPath(shortcut, sfHost)
          url = buildSetupUrl(sfHost, resolvedPath)
        }

        return {
          id: shortcut.id,
          name: shortcut.name,
          type: 'SetupShortcut',
          description: shortcut.description,
          url: url || undefined
        } as SearchResult
      })

    useSearchStore.setState({
      searchResults: { SetupShortcut: [...results, ...listResults] },
      searchError: null,
      isLoading: false
    })
  }

  private async fetchRecordTypeId(objectApiName: string | null, recordId: string): Promise<void> {
    const { sfHost } = useSessionStore.getState()
    if (!sfHost || !objectApiName) return
    const recordTypeId = await fetchRecordTypeIdFn(sfHost, objectApiName, recordId)
    if (recordTypeId) {
      const ctx = useSearchStore.getState().recordContext
      if (ctx) {
        useSearchStore.getState().setRecordContext({ ...ctx, recordTypeId })
      }
    }
  }

  private async handleFieldsNavigation(): Promise<void> {
    const { recordContext } = useSearchStore.getState()
    if (!recordContext?.objectApiName) {
      useSearchStore.getState().setError('No object found for this record.')
      return
    }
    useSearchStore.getState().setLoading(true)
    try {
      const { sfHost } = useSessionStore.getState()
      const { navigationMode } = useSettingsStore.getState()
      const { userLightningPreference } = useSessionStore.getState()
      const url = await handleFieldsNavigationFn(
        sfHost!,
        recordContext.objectApiName,
        navigationMode,
        userLightningPreference
      )
      if (url) {
        useSearchStore.getState().setLoading(false)
        window.open(url, '_blank')
        if (useSettingsStore.getState().closeOnNavigate) {
          this.hide()
        }
        return
      }
      useSearchStore.getState().setError('Could not determine Fields URL.')
    } catch (error) {
      logger.error('Failed to navigate to Fields:', error)
      useSearchStore.getState().setError('Failed to load Fields information.')
    }
  }

  private async handleRecordTypeNavigation(): Promise<void> {
    const { recordContext } = useSearchStore.getState()
    if (!recordContext?.recordTypeId || !recordContext?.objectApiName) {
      useSearchStore.getState().setError('No RecordType found for this record.')
      return
    }
    useSearchStore.getState().setLoading(true)
    try {
      const { sfHost } = useSessionStore.getState()
      const { navigationMode } = useSettingsStore.getState()
      const { userLightningPreference } = useSessionStore.getState()
      const url = await handleRecordTypeNavigationFn(
        sfHost!,
        recordContext.objectApiName,
        recordContext.recordTypeId,
        navigationMode,
        userLightningPreference
      )
      if (url) {
        useSearchStore.getState().setLoading(false)
        window.open(url, '_blank')
        if (useSettingsStore.getState().closeOnNavigate) {
          this.hide()
        }
        return
      }
      useSearchStore.getState().setError('Could not determine RecordType URL.')
    } catch (error) {
      logger.error('Failed to navigate to RecordType:', error)
      useSearchStore.getState().setError('Failed to load RecordType information.')
    }
  }

  private async handlePageLayoutNavigation(): Promise<void> {
    useSearchStore.getState().setLoading(true)
    try {
      const result = await this.getCurrentRecordLayoutUrl()
      if (result) {
        useSearchStore.getState().setLoading(false)
        window.open(result.url, '_blank')
        if (useSettingsStore.getState().closeOnNavigate) {
          this.hide()
        }
        return
      }
      useSearchStore.getState().setError('Could not determine page layout for this record.')
    } catch (error) {
      logger.error('Failed to navigate to page layout:', error)
      useSearchStore.getState().setError('Failed to load page layout information.')
    }
  }

  private async getCurrentRecordLayoutUrl(): Promise<{ objectApiName: string; url: string } | null> {
    const { sfHost } = useSessionStore.getState()
    const { navigationMode } = useSettingsStore.getState()
    const { userLightningPreference } = useSessionStore.getState()

    const { objectApiName: fromUrlObject, recordId } = getCurrentRecordFromUrl()
    const objectApiName = fromUrlObject || (recordId && sfHost ? await resolveObjectApiNameFromRecordFn(sfHost, recordId) : null)
    if (!sfHost || !objectApiName || !recordId) return null
    const layoutInfo = await getCurrentRecordLayoutInfoFn(sfHost, objectApiName, recordId)
    if (!layoutInfo) return null
    const useLightning = shouldUseLightning(navigationMode, userLightningPreference)
    const url = useLightning
      ? buildSetupUrl(sfHost, `/lightning/setup/ObjectManager/${layoutInfo.objectDurableId}/PageLayouts/${layoutInfo.layoutId}/view`)
      : `https://${sfHost}/layouteditor/layoutEditor.apexp?type=${layoutInfo.objectApiName}&lid=${layoutInfo.layoutId}&retURL=%2F${layoutInfo.recordId}`
    if (!url) return null
    return { objectApiName: layoutInfo.objectApiName, url }
  }

  private async resolveObjectApiNameFromRecord(recordId: string): Promise<string | null> {
    const { sfHost } = useSessionStore.getState()
    if (!sfHost) return null
    return resolveObjectApiNameFromRecordFn(sfHost, recordId)
  }

  private async fetchLightningPreference(): Promise<boolean | null> {
    const { sfHost } = useSessionStore.getState()
    if (!sfHost) return null
    const pref = await getUserLightningPreferenceFn(sfHost)
    if (pref !== null) {
      useSessionStore.getState().setLightningPreference(pref)
    }
    return pref
  }

  private handleResultClick(result: SearchResult): void {
    this.log(`Result clicked: ${result.name} (${result.type})`)
    this.emit('resultClick', result)

    const navContext = this.getNavigationContext()
    const targetUrl = buildNavigationUrl(result, navContext)
    if (targetUrl) {
      window.open(targetUrl, '_blank')
    }
    if (useSettingsStore.getState().closeOnNavigate) {
      this.hide()
    }
  }

  private handleIdNavigate(id: string): void {
    this.log(`Direct ID navigation: ${id}`)
    const navContext = this.getNavigationContext()
    const targetUrl = buildIdNavigationUrl(id, navContext)
    if (targetUrl) {
      window.open(targetUrl, '_blank')
    }
    if (useSettingsStore.getState().closeOnNavigate) {
      this.hide()
    }
  }

  private handleActionClick(result: SearchResult, action: ObjectAction): void {
    this.log(`Action clicked: ${action} for ${result.name}`)
    this.emit('actionClick', { result, action })

    const navContext = this.getNavigationContext()
    const targetUrl = buildActionUrl(result, action, navContext)
    if (targetUrl) {
      window.open(targetUrl, '_blank')
      if (useSettingsStore.getState().closeOnNavigate) {
        this.hide()
      }
    }
  }

  /** Builds NavigationContext from session + settings stores. */
  private getNavigationContext(): NavigationContext {
    const { sfHost, userLightningPreference } = useSessionStore.getState()
    const { navigationMode } = useSettingsStore.getState()
    return { sfHost, navigationMode, userLightningPreference }
  }

  /**
   * Backward-compatible state update. Writes to the appropriate store(s).
   */
  public updateState(updates: Partial<WindowManagerState>): void {
    const searchUpdates: Record<string, any> = {}
    const sessionUpdates: Record<string, any> = {}
    const settingsUpdates: Record<string, any> = {}

    for (const [key, value] of Object.entries(updates)) {
      switch (key) {
        case 'isVisible':
        case 'searchResults':
        case 'isLoading':
        case 'searchError':
        case 'recordContext':
          searchUpdates[key] = value
          break
        case 'sfHost':
        case 'hasSession':
        case 'userLightningPreference':
          sessionUpdates[key] = value
          break
        case 'closeOnNavigate':
        case 'navigationMode':
        case 'fuzzySearch':
          settingsUpdates[key] = value
          break
        case 'isInitialized':
          this._isInitialized = value as boolean
          break
      }
    }

    if (Object.keys(searchUpdates).length > 0) useSearchStore.setState(searchUpdates)
    if (Object.keys(sessionUpdates).length > 0) useSessionStore.setState(sessionUpdates)
    if (Object.keys(settingsUpdates).length > 0) useSettingsStore.setState(settingsUpdates)

    this.log('State updated', updates)
    this.emit('stateChange', { oldState: this.getState(), newState: this.getState(), updates })
  }

  /** Returns a composite snapshot of all stores for backward compatibility. */
  public getState(): Readonly<WindowManagerState> {
    const search = useSearchStore.getState()
    const session = useSessionStore.getState()
    const settings = useSettingsStore.getState()
    return {
      isVisible: search.isVisible,
      isInitialized: this._isInitialized,
      sfHost: session.sfHost,
      searchResults: search.searchResults,
      isLoading: search.isLoading,
      hasSession: session.hasSession,
      closeOnNavigate: settings.closeOnNavigate,
      navigationMode: settings.navigationMode,
      fuzzySearch: settings.fuzzySearch,
      searchError: search.searchError,
      userLightningPreference: session.userLightningPreference,
      recordContext: search.recordContext
    }
  }

  public isVisible(): boolean {
    return useSearchStore.getState().isVisible
  }

  public isInitialized(): boolean {
    return this._isInitialized
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
      if (useSearchStore.getState().isVisible) {
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

      useSearchStore.getState().reset()
      useSessionStore.getState().reset()
      this._isInitialized = false

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
      state: this.getState(),
      hasContainer: !!this.containerElement,
      hasReactRoot: !!this.reactRoot,
      eventEmitter: 'TypedEventEmitter',
      cleanupFunctions: this.cleanupFunctions.length
    }
  }
}

export default UltraForceWindowManager
export type { WindowManagerState, WindowManagerOptions }
