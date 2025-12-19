import React from 'react'
import { createRoot } from 'react-dom/client'
import SearchModal from '~components/search/SearchModal'
import ErrorBoundary from '~components/ErrorBoundary'
import { searchSalesforceMetadata, executeCustomCommand, type CustomCommandOptions } from '~lib/salesforce-api'
import { getSfHost, getSession, sfRest, API_VERSION } from '~lib/auth'
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
  searchError: string | null
  userLightningPreference: boolean | null
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

type SetupShortcut = {
  id: string
  name: string
  description: string
  path: string
}

// Common standard object key prefixes for Classic record URLs
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

const SETUP_SHORTCUTS: SetupShortcut[] = [
  { id: 'approval-processes', name: 'Approval Processes', description: 'Process Automation', path: '/lightning/setup/ApprovalProcesses/home' },
  { id: 'session-settings', name: 'Session Settings', description: 'Security > Session', path: '/lightning/setup/SessionSettings/home' },
  { id: 'company-information', name: 'Company Information', description: 'Company Settings', path: '/lightning/setup/CompanyProfileInfo/home' },
  { id: 'password-policies', name: 'Password Policies', description: 'Security > Password Policies', path: '/lightning/setup/PasswordPolicies/home' },
  { id: 'login-history', name: 'Login History', description: 'Security > Login History', path: '/lightning/setup/SessionManagement/home' },
  { id: 'users', name: 'Users', description: 'User Management', path: '/lightning/setup/ManageUsers/home' },
  { id: 'permission-sets', name: 'Permission Sets', description: 'User Access', path: '/lightning/setup/PermSets/home' },
  { id: 'permission-set-groups', name: 'Permission Set Groups', description: 'User Access', path: '/lightning/setup/PermSetGroups/home' },
  { id: 'profiles', name: 'Profiles', description: 'User Access', path: '/lightning/setup/Profiles/home' },
  { id: 'roles', name: 'Roles', description: 'User Access', path: '/lightning/setup/Roles/home' },
  { id: 'sharing-settings', name: 'Sharing Settings', description: 'Security > Sharing', path: '/lightning/setup/SecuritySharing/home' },
  { id: 'connected-apps', name: 'Connected Apps', description: 'Apps > App Manager', path: '/lightning/setup/ConnectedApplication/home' },
  { id: 'apex-classes', name: 'Apex Classes', description: 'Development', path: '/lightning/setup/ApexClasses/home' },
  { id: 'apex-triggers', name: 'Apex Triggers', description: 'Development', path: '/lightning/setup/ApexTriggers/home' },
  { id: 'visualforce-pages', name: 'Visualforce Pages', description: 'Development', path: '/lightning/setup/ApexPages/home' },
  { id: 'visualforce-components', name: 'Visualforce Components', description: 'Development', path: '/lightning/setup/ApexComponents/home' },
  { id: 'remote-site-settings', name: 'Remote Site Settings', description: 'Security', path: '/lightning/setup/SecurityRemoteProxy/home' },
  { id: 'named-credentials', name: 'Named Credentials', description: 'Security', path: '/lightning/setup/NamedCredential/home' },
  { id: 'email-deliverability', name: 'Email Deliverability', description: 'Email', path: '/lightning/setup/OrgEmailSettings/home' },
  { id: 'queues', name: 'Queues', description: 'User Management', path: '/lightning/setup/Queues/home' },
  { id: 'public-groups', name: 'Public Groups', description: 'User Management', path: '/lightning/setup/PublicGroups/home' },
  { id: 'debug-logs', name: 'Debug Logs', description: 'Logs & Monitoring', path: '/lightning/setup/DebugLogs/home' },
  { id: 'apex-jobs', name: 'Apex Jobs', description: 'Logs & Monitoring', path: '/lightning/setup/ApexJobs/home' },
  { id: 'scheduled-jobs', name: 'Scheduled Jobs', description: 'Logs & Monitoring', path: '/lightning/setup/ScheduledJobs/home' },
  { id: 'email-templates', name: 'Email Templates', description: 'Communication', path: '/lightning/setup/CommunicationTemplatesEmail/home' },
  { id: 'lead-assignment-rules', name: 'Lead Assignment Rules', description: 'Automation', path: '/lightning/setup/LeadRules/home' },
  { id: 'case-assignment-rules', name: 'Case Assignment Rules', description: 'Automation', path: '/lightning/setup/CaseRules/home' },
  { id: 'deployment-status', name: 'Deployment Status', description: 'Deploy', path: '/lightning/setup/DeployStatus/home' },
  { id: 'sandboxes', name: 'Sandboxes', description: 'Environments', path: '/lightning/setup/DataManagementCreateTestInstance/home' }
]

function resolveSetupShortcutPath(shortcut: SetupShortcut, sfHost: string | null): string {
  if (shortcut.id === 'users') {
    // In .sfcrmproducts.cn / .sfcrmapps.cn environments, "Users" lives under ManageUsersLightning.
    if (sfHost?.includes('sfcrmproducts.cn') || sfHost?.includes('sfcrmapps.cn')) {
      return '/lightning/setup/ManageUsersLightning/home'
    }
  }
  return shortcut.path
}

function getSetupHost(sfHost: string | null): string | null {
  if (!sfHost) return null
  return sfHost
    .replace('.my.salesforce.com', '.my.salesforce-setup.com')
    .replace('.lightning.force.com', '.my.salesforce-setup.com')
    .replace('.my.sfcrmproducts.cn', '.setup.sfcrmproducts.cn')
    .replace('.my.sfcrmapps.cn', '.setup.sfcrmapps.cn')
    .replace('.lightning.sfcrmproducts.cn', '.setup.sfcrmproducts.cn')
    .replace('.lightning.sfcrmapps.cn', '.setup.sfcrmapps.cn')
    .replace('.sandbox.my.sfcrmproducts.cn', '.sandbox.setup.sfcrmproducts.cn')
    .replace('.sandbox.my.sfcrmapps.cn', '.sandbox.setup.sfcrmapps.cn')
}

function buildSetupUrl(sfHost: string | null, path: string): string | null {
  const setupHost = getSetupHost(sfHost)
  if (!setupHost) return null
  return `https://${setupHost}${path}`
}

function getCurrentRecordFromUrl(): { objectApiName: string | null; recordId: string | null } {
  const path = window.location.pathname

  // Lightning record URL: /lightning/r/ObjectApiName/recordId/view
  const lightningMatch = path.match(/^\/lightning\/r\/([^/]+)\/([A-Za-z0-9]{15,18})\/(?:view|edit|related)/)
  if (lightningMatch && lightningMatch[1] && lightningMatch[2]) {
    return { objectApiName: lightningMatch[1], recordId: lightningMatch[2] }
  }

  // Classic record URL: /001xxxxxxxxxxxxxx or /001xxxxxxxxxxxxxx?...
  const classicMatch = path.match(/^\/([A-Za-z0-9]{15,18})/)
  if (classicMatch && classicMatch[1]) {
    return { objectApiName: null, recordId: classicMatch[1] }
  }

  return { objectApiName: null, recordId: null }
}

/**
 * Detect if should use Lightning URLs based on mode setting and user preference
 */
function shouldUseLightning(mode: NavigationMode, userPreference: boolean | null = null): boolean {
  // If explicit mode is set, use it
  if (mode === 'lightning') return true
  if (mode === 'classic') return false

  // Auto mode: prefer user's API preference if available
  if (userPreference !== null) {
    return userPreference
  }

  // Fallback: detect from current page URL
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
    fuzzySearch: true,
    searchError: null,
    userLightningPreference: null
  }

  private options: Required<WindowManagerOptions> = {
    containerId: `${CONTAINER_PREFIX}-${Date.now()}`,
    useShadowDOM: true,
    debugMode: false
  }

  private eventHandlers = new Map<string, Set<Function>>()
  // Cache keyed by sfHost for multi-org support
  private sobjectPrefixCache: Record<string, Record<string, string>> = {}
  private sobjectCacheTimestamp: Record<string, number> = {}
  private currentUserProfileId: Record<string, string> = {}
  private userLightningPreferenceCache: Record<string, boolean> = {}

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
          searchError: this.state.searchError
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

    // Helper to check if all search terms match the target text
    const matchesAllTerms = (text: string): boolean => {
      if (searchTerms.length === 0) return true
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

    const listResults = shortcuts
      .filter((shortcut) => {
        const combinedText = `${shortcut.name} ${shortcut.description}`
        return matchesAllTerms(combinedText)
      })
      .map((shortcut) => {
        const resolvedPath = resolveSetupShortcutPath(shortcut, this.state.sfHost)
        const url = buildSetupUrl(this.state.sfHost, resolvedPath)
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

    // Render immediately to show results
    await this.renderComponent()
  }

  private async getCurrentRecordLayoutUrl(): Promise<{ url: string; objectApiName: string } | null> {
    const { objectApiName: fromUrlObject, recordId } = getCurrentRecordFromUrl()
    const objectApiName = fromUrlObject || (recordId ? await this.resolveObjectApiNameFromRecord(recordId) : null)

    if (!this.state.sfHost || !objectApiName || !recordId) {
      return null
    }

    try {
      const record = await sfRest(this.state.sfHost, `/services/data/v${API_VERSION}/sobjects/${objectApiName}/${recordId}?fields=RecordTypeId`)
      const recordTypeId = record?.RecordTypeId || null

      const profileId = await this.getCurrentUserProfileId()
      if (!profileId) {
        return null
      }

      const layoutId = await this.getLayoutAssignment(objectApiName, profileId, recordTypeId)
      if (!layoutId) {
        return null
      }

      const url = buildSetupUrl(this.state.sfHost, `/lightning/setup/ObjectManager/${objectApiName}/PageLayouts/${layoutId}/view`)
      return url ? { url, objectApiName } : null
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

  private async getCurrentUserProfileId(): Promise<string | null> {
    if (!this.state.sfHost) {
      return null
    }

    const hostKey = this.state.sfHost
    if (this.currentUserProfileId[hostKey]) {
      return this.currentUserProfileId[hostKey]
    }

    try {
      // Use Chatter API to get current user info
      const userInfo = await sfRest(this.state.sfHost, `/services/data/v${API_VERSION}/chatter/users/me`)
      const userId = userInfo?.id
      if (!userId) {
        return null
      }
      // Query ProfileId using the actual user ID
      const soql = encodeURIComponent(`SELECT ProfileId FROM User WHERE Id = '${userId}'`)
      const resp = await sfRest(this.state.sfHost, `/services/data/v${API_VERSION}/query/?q=${soql}`)
      const profileId = resp?.records?.[0]?.ProfileId
      if (profileId) {
        this.currentUserProfileId[hostKey] = profileId
        return profileId
      }
    } catch (error) {
      logger.warn('Failed to fetch current user profile:', error)
    }
    return null
  }

  private async getUserLightningPreference(): Promise<boolean | null> {
    if (!this.state.sfHost) return null

    const hostKey = this.state.sfHost
    if (hostKey in this.userLightningPreferenceCache) {
      return this.userLightningPreferenceCache[hostKey]
    }

    try {
      const userInfo = await sfRest(this.state.sfHost, `/services/data/v${API_VERSION}/chatter/users/me`)
      const userId = userInfo?.id
      if (!userId) return null

      const soql = encodeURIComponent(`SELECT UserPreferencesLightningExperiencePreferred FROM User WHERE Id = '${userId}'`)
      const resp = await sfRest(this.state.sfHost, `/services/data/v${API_VERSION}/query/?q=${soql}`)
      const preference = resp?.records?.[0]?.UserPreferencesLightningExperiencePreferred

      if (typeof preference === 'boolean') {
        this.userLightningPreferenceCache[hostKey] = preference
        this.state.userLightningPreference = preference
        return preference
      }
    } catch (error) {
      logger.warn('Failed to fetch user Lightning preference:', error)
    }
    return null
  }

  private async getLayoutAssignment(objectApiName: string, profileId: string, recordTypeId: string | null): Promise<string | null> {
    if (!this.state.sfHost) return null

    // Prefer matching record type; if not found, fallback to default (RecordTypeId = null)
    const queries = [
      recordTypeId ? `SELECT LayoutId FROM LayoutAssignment WHERE TableEnumOrId='${objectApiName}' AND ProfileId='${profileId}' AND RecordTypeId='${recordTypeId}' LIMIT 1` : null,
      `SELECT LayoutId FROM LayoutAssignment WHERE TableEnumOrId='${objectApiName}' AND ProfileId='${profileId}' AND RecordTypeId = NULL LIMIT 1`
    ].filter(Boolean) as string[]

    for (const q of queries) {
      try {
        const resp = await sfRest(this.state.sfHost, `/services/data/v${API_VERSION}/tooling/query/?q=${encodeURIComponent(q)}`)
        const layoutId = resp?.records?.[0]?.LayoutId
        if (layoutId) {
          return layoutId
        }
      } catch (error) {
        logger.warn('Layout assignment query failed:', error)
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
          case 'Flow':
            targetUrl = `${baseUrl}/builder_platform_interaction/flowBuilder.app?flowId=${result.id}`
            break
          case 'CustomObject': {
            const keyPrefix = result.metadata?.KeyPrefix
            if (keyPrefix) {
              targetUrl = `${baseUrl}/${keyPrefix}`
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
    const objectEntityId = result.metadata.Id || objectId
    const lightningObjectId = result.metadata.Id || objectId
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
          targetUrl = `${baseUrl}/lightning/setup/ObjectManager/${lightningObjectId}/FieldsAndRelationships/view`
          break
        case 'layouts':
          targetUrl = `${baseUrl}/lightning/setup/ObjectManager/${lightningObjectId}/PageLayouts/view`
          break
        case 'details':
          targetUrl = `${baseUrl}/lightning/setup/ObjectManager/${lightningObjectId}/Details/view`
          break
      }
    } else {
      // Classic URLs
      switch (action) {
        case 'list':
          const keyPrefix = result.metadata?.KeyPrefix
          targetUrl = keyPrefix ? `${baseUrl}/${keyPrefix}` : `${baseUrl}/p/setup/layout/LayoutFieldList?type=${objectApiName}`
          break
        case 'fields':
          targetUrl = `${baseUrl}/p/setup/layout/LayoutFieldList?type=${objectApiName}`
          break
        case 'layouts':
          targetUrl = `${baseUrl}/ui/setup/layout/PageLayouts?type=${objectApiName}`
          break
        case 'details':
          if (objectEntityId && /^[a-zA-Z0-9]{15,18}$/.test(objectEntityId)) {
            targetUrl = `${baseUrl}/setup/ui/viewCustomObject.apexp?id=${objectEntityId}`
          } else if (objectApiName) {
            targetUrl = `${baseUrl}/p/setup/layout/LayoutFieldList?type=${objectApiName}`
          }
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
        fuzzySearch: true,
        searchError: null,
        userLightningPreference: null
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
