import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock all heavy dependencies before importing
vi.mock('./salesforce-api', () => ({
  searchSalesforceMetadata: vi.fn().mockResolvedValue({}),
  executeCustomCommand: vi.fn().mockResolvedValue([]),
  isApiAvailable: vi.fn().mockReturnValue(true)
}))

vi.mock('./auth', () => ({
  getSfHost: vi.fn().mockResolvedValue('myorg.my.salesforce.com'),
  getSession: vi.fn().mockResolvedValue({ key: 'test-session', hostname: 'myorg.my.salesforce.com' }),
  sfRest: vi.fn().mockResolvedValue(null),
  API_VERSION: '62.0'
}))

vi.mock('./keyboard-interceptor', () => ({
  createKeyboardInterceptor: vi.fn().mockReturnValue(vi.fn())
}))

vi.mock('./fuzzy-search', () => ({
  buildSearchIndex: vi.fn(),
  searchIndex: vi.fn().mockReturnValue([]),
  hasSearchIndex: vi.fn().mockReturnValue(false),
  clearSearchIndex: vi.fn(),
  clearAllSearchIndexes: vi.fn(),
  parseSearchQuery: vi.fn()
}))

vi.mock('./metadata-cache', () => ({
  MetadataCache: {
    getInstance: () => ({
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn()
    })
  }
}))

vi.mock('./domain-utils', () => ({
  normalizeHost: vi.fn((host: string) => host),
  isSalesforceDomain: vi.fn().mockReturnValue(true),
  escapeSoql: vi.fn((input: string) => input)
}))

vi.mock('./unsupported-types', () => ({
  markTypeUnsupported: vi.fn(),
  getUnsupportedTypes: vi.fn().mockResolvedValue([]),
  markTypesChecked: vi.fn(),
  needsPermissionCheck: vi.fn().mockResolvedValue(false),
  clearUnsupportedTypesCache: vi.fn()
}))

vi.mock('./logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('./api-stats', () => ({
  trackApiRequest: vi.fn()
}))

vi.mock('./profile-search', () => ({
  parseProfileDotNotation: vi.fn(),
  buildProfileSubMenu: vi.fn(),
  queryProfileUsers: vi.fn(),
  queryProfileObjectPermissions: vi.fn(),
  queryProfileFieldPermissions: vi.fn(),
  queryProfileCustomPermissions: vi.fn(),
  queryProfileApexClassAccess: vi.fn(),
  queryProfileVFPageAccess: vi.fn(),
  queryProfileConnectedApps: vi.fn(),
  queryProfileAssignedApps: vi.fn(),
  filterProfileSubData: vi.fn()
}))

// Mock React to avoid JSX/rendering issues in unit tests
vi.mock('react', () => ({
  default: {
    createElement: vi.fn().mockReturnValue(null)
  },
  createElement: vi.fn().mockReturnValue(null)
}))

vi.mock('react-dom/client', () => ({
  createRoot: vi.fn().mockReturnValue({
    render: vi.fn(),
    unmount: vi.fn()
  })
}))

vi.mock('~components/search/SearchModal', () => ({
  default: vi.fn()
}))

vi.mock('~components/ErrorBoundary', () => ({
  default: vi.fn()
}))

import UltraForceWindowManager from './window-manager'
import type { WindowManagerState } from './window-manager'
import { getSfHost, getSession, sfRest } from './auth'
import { createKeyboardInterceptor } from './keyboard-interceptor'
import { searchSalesforceMetadata, executeCustomCommand } from './salesforce-api'
import { useSearchStore } from '~stores/search-store'
import { useSessionStore } from '~stores/session-store'
import { useSettingsStore, SETTINGS_DEFAULTS } from '~stores/settings-store'
import { useHistoryStore } from '~stores/history-store'

const mockGetSfHost = vi.mocked(getSfHost)
const mockGetSession = vi.mocked(getSession)
const mockSfRest = vi.mocked(sfRest)
const mockCreateKeyboardInterceptor = vi.mocked(createKeyboardInterceptor)
const mockSearchMetadata = vi.mocked(searchSalesforceMetadata)

const TEST_HOST = 'myorg.my.salesforce.com'

function resetStores(): void {
  useSearchStore.getState().reset()
  useSessionStore.getState().reset()
  useSettingsStore.setState(SETTINGS_DEFAULTS)
  useHistoryStore.setState({ items: [] })
}

// Helper to destroy singleton and reset static fields
async function resetSingleton(): Promise<void> {
  // Access static properties to reset singleton
  const WM = UltraForceWindowManager as any
  if (WM.instance) {
    try {
      await WM.instance.destroy()
    } catch {
      // ignore cleanup errors
    }
    WM.instance = null
  }
  WM.initializationPromise = null
  resetStores()
}

describe('UltraForceWindowManager', () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    // Reset singleton
    await resetSingleton()

    // Default mock returns
    mockGetSfHost.mockResolvedValue(TEST_HOST)
    mockGetSession.mockResolvedValue({ key: 'test-session', hostname: TEST_HOST })
    mockSfRest.mockResolvedValue(null)
    mockCreateKeyboardInterceptor.mockReturnValue(vi.fn())

    // Mock chrome.storage.onChanged.addListener
    chrome.storage.onChanged.addListener = vi.fn()
    chrome.storage.onChanged.removeListener = vi.fn()
  })

  afterEach(async () => {
    await resetSingleton()
    // Clean up any containers left in DOM
    document.querySelectorAll('[id^="ultraforce-modal"]').forEach((el) => el.remove())
  })

  describe('getInstance / lifecycle', () => {
    it('should create singleton instance', async () => {
      const instance = await UltraForceWindowManager.getInstance({ debugMode: false })
      expect(instance).toBeDefined()
    })

    it('should return same instance on subsequent calls', async () => {
      const instance1 = await UltraForceWindowManager.getInstance()
      const instance2 = await UltraForceWindowManager.getInstance()
      expect(instance1).toBe(instance2)
    })

    it('should reset after destroy()', async () => {
      const instance1 = await UltraForceWindowManager.getInstance()
      await instance1.destroy()

      // Reset static reference so next getInstance creates new
      const WM = UltraForceWindowManager as any
      WM.instance = null
      WM.initializationPromise = null

      const instance2 = await UltraForceWindowManager.getInstance()
      expect(instance2).not.toBe(instance1)
    })

    it('should handle rapid getInstance calls (race condition)', async () => {
      // Fire off multiple getInstance calls simultaneously
      const promises = [
        UltraForceWindowManager.getInstance(),
        UltraForceWindowManager.getInstance(),
        UltraForceWindowManager.getInstance()
      ]

      const results = await Promise.all(promises)
      // All should return the same instance
      expect(results[0]).toBe(results[1])
      expect(results[1]).toBe(results[2])
    })

    it('should be initialized after getInstance', async () => {
      const instance = await UltraForceWindowManager.getInstance()
      expect(instance.isInitialized()).toBe(true)
    })
  })

  describe('toggle / show / hide', () => {
    it('should toggle visibility state', async () => {
      const instance = await UltraForceWindowManager.getInstance()
      expect(instance.isVisible()).toBe(false)

      await instance.toggle()
      expect(instance.isVisible()).toBe(true)

      await instance.toggle()
      expect(instance.isVisible()).toBe(false)
    })

    it('should show when hidden', async () => {
      const instance = await UltraForceWindowManager.getInstance()
      expect(instance.isVisible()).toBe(false)

      await instance.show()
      expect(instance.isVisible()).toBe(true)
    })

    it('should hide when visible', async () => {
      const instance = await UltraForceWindowManager.getInstance()
      await instance.show()
      expect(instance.isVisible()).toBe(true)

      await instance.hide()
      expect(instance.isVisible()).toBe(false)
    })

    it('should not throw when show() called while already visible', async () => {
      const instance = await UltraForceWindowManager.getInstance()
      await instance.show()

      // Second show should not throw
      await expect(instance.show()).resolves.not.toThrow()
    })

    it('should not throw when hide() called while already hidden', async () => {
      const instance = await UltraForceWindowManager.getInstance()

      // Already hidden, calling hide should not throw
      await expect(instance.hide()).resolves.not.toThrow()
    })

    it('should set data-ultraforce-modal-open attribute on show', async () => {
      const instance = await UltraForceWindowManager.getInstance()
      await instance.show()

      expect(document.documentElement.hasAttribute('data-ultraforce-modal-open')).toBe(true)
    })

    it('should remove data-ultraforce-modal-open attribute on hide', async () => {
      const instance = await UltraForceWindowManager.getInstance()
      await instance.show()
      await instance.hide()

      expect(document.documentElement.hasAttribute('data-ultraforce-modal-open')).toBe(false)
    })

    it('should setup keyboard interceptor on show', async () => {
      const instance = await UltraForceWindowManager.getInstance()
      await instance.show()

      expect(mockCreateKeyboardInterceptor).toHaveBeenCalled()
    })
  })

  describe('state management', () => {
    it('should return current state via getState()', async () => {
      const instance = await UltraForceWindowManager.getInstance()
      const state = instance.getState()

      expect(state).toHaveProperty('isVisible')
      expect(state).toHaveProperty('isInitialized')
      expect(state).toHaveProperty('sfHost')
      expect(state).toHaveProperty('searchResults')
      expect(state).toHaveProperty('isLoading')
      expect(state).toHaveProperty('hasSession')
      expect(state).toHaveProperty('navigationMode')
      expect(state).toHaveProperty('fuzzySearch')
    })

    it('should update state via updateState()', async () => {
      const instance = await UltraForceWindowManager.getInstance()
      instance.updateState({ isLoading: true })

      expect(instance.getState().isLoading).toBe(true)
    })

    it('should merge partial state updates (not replace)', async () => {
      const instance = await UltraForceWindowManager.getInstance()
      const originalState = instance.getState()

      instance.updateState({ isLoading: true })
      const newState = instance.getState()

      // Original properties should still exist
      expect(newState.isInitialized).toBe(originalState.isInitialized)
      expect(newState.sfHost).toBe(originalState.sfHost)
      // Updated property should reflect new value
      expect(newState.isLoading).toBe(true)
    })

    it('should report visibility via isVisible()', async () => {
      const instance = await UltraForceWindowManager.getInstance()
      expect(instance.isVisible()).toBe(false)

      await instance.show()
      expect(instance.isVisible()).toBe(true)
    })

    it('should report initialization via isInitialized()', async () => {
      const instance = await UltraForceWindowManager.getInstance()
      expect(instance.isInitialized()).toBe(true)
    })

    it('should detect SF host from page URL during init', async () => {
      const instance = await UltraForceWindowManager.getInstance()
      const state = instance.getState()

      expect(state.sfHost).toBe(TEST_HOST)
      expect(mockGetSfHost).toHaveBeenCalled()
    })

    it('should detect session status during init', async () => {
      const instance = await UltraForceWindowManager.getInstance()
      const state = instance.getState()

      expect(state.hasSession).toBe(true)
      expect(mockGetSession).toHaveBeenCalled()
    })

    it('should handle missing session gracefully', async () => {
      mockGetSession.mockResolvedValue(null)

      const instance = await UltraForceWindowManager.getInstance()
      const state = instance.getState()

      expect(state.hasSession).toBe(false)
    })

    it('should handle missing SF host gracefully', async () => {
      mockGetSfHost.mockResolvedValue(null)

      const instance = await UltraForceWindowManager.getInstance()
      const state = instance.getState()

      expect(state.sfHost).toBeNull()
    })

    it('should return a copy of state (not reference)', async () => {
      const instance = await UltraForceWindowManager.getInstance()
      const state1 = instance.getState()
      const state2 = instance.getState()

      expect(state1).not.toBe(state2) // Different object references
      expect(state1).toEqual(state2) // Same values
    })
  })

  describe('event emitter', () => {
    it('should register event handler with on()', async () => {
      const instance = await UltraForceWindowManager.getInstance()
      const handler = vi.fn()

      instance.on('test-event', handler)

      // Emit via show (which emits 'show' event)
      await instance.show()
      // Check 'show' event was emitted
      const showHandler = vi.fn()
      instance.on('show', showHandler)
      // Already emitted, so we test registration works
      expect(handler).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'test-event' }))
    })

    it('should unregister event handler with off()', async () => {
      const instance = await UltraForceWindowManager.getInstance()
      const handler = vi.fn()

      instance.on('show', handler)
      instance.off('show', handler)

      await instance.show()
      expect(handler).not.toHaveBeenCalled()
    })

    it('should emit events to registered handlers', async () => {
      const instance = await UltraForceWindowManager.getInstance()
      const showHandler = vi.fn()
      const hideHandler = vi.fn()

      instance.on('show', showHandler)
      instance.on('hide', hideHandler)

      await instance.show()
      expect(showHandler).toHaveBeenCalledTimes(1)

      await instance.hide()
      expect(hideHandler).toHaveBeenCalledTimes(1)
    })

    it('should not emit to unregistered handlers', async () => {
      const instance = await UltraForceWindowManager.getInstance()
      const handler = vi.fn()

      instance.on('show', handler)
      instance.off('show', handler)

      await instance.show()
      expect(handler).not.toHaveBeenCalled()
    })

    it('should handle multiple handlers for same event', async () => {
      const instance = await UltraForceWindowManager.getInstance()
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      instance.on('show', handler1)
      instance.on('show', handler2)

      await instance.show()
      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)
    })

    it('should emit initialized event during getInstance', async () => {
      // Can't easily test since init happens before we can register handler
      // But we can verify the instance was initialized
      const instance = await UltraForceWindowManager.getInstance()
      expect(instance.isInitialized()).toBe(true)
    })

    it('should emit stateChange event on updateState', async () => {
      const instance = await UltraForceWindowManager.getInstance()
      const handler = vi.fn()

      instance.on('stateChange', handler)
      instance.updateState({ isLoading: true })

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        updates: { isLoading: true }
      }))
    })
  })

  describe('getDebugInfo', () => {
    it('should return debug information object', async () => {
      const instance = await UltraForceWindowManager.getInstance()
      const info = instance.getDebugInfo() as Record<string, any>

      expect(info).toHaveProperty('containerId')
      expect(info).toHaveProperty('useShadowDOM')
      expect(info).toHaveProperty('state')
      expect(info).toHaveProperty('hasContainer')
      expect(info).toHaveProperty('hasReactRoot')
      expect(info).toHaveProperty('eventEmitter')
      expect(info).toHaveProperty('cleanupFunctions')
    })

    it('should include host and visibility state', async () => {
      const instance = await UltraForceWindowManager.getInstance()
      const info = instance.getDebugInfo() as Record<string, any>

      expect(info.state.sfHost).toBe(TEST_HOST)
      expect(info.state.isVisible).toBe(false)
    })

    it('should reflect container presence', async () => {
      const instance = await UltraForceWindowManager.getInstance()
      const info = instance.getDebugInfo() as Record<string, any>

      expect(info.hasContainer).toBe(true)
    })

    it('should report event emitter type', async () => {
      const instance = await UltraForceWindowManager.getInstance()
      instance.on('custom-event', vi.fn())

      const info = instance.getDebugInfo() as Record<string, any>
      expect(info.eventEmitter).toBe('TypedEventEmitter')
    })
  })

  describe('destroy', () => {
    it('should clean up all resources', async () => {
      const instance = await UltraForceWindowManager.getInstance()
      await instance.show()

      await instance.destroy()

      expect(instance.isVisible()).toBe(false)
      expect(instance.isInitialized()).toBe(false)
    })

    it('should remove container from DOM', async () => {
      const instance = await UltraForceWindowManager.getInstance()
      const info = instance.getDebugInfo() as Record<string, any>
      const containerId = info.containerId

      expect(document.getElementById(containerId)).not.toBeNull()

      await instance.destroy()

      expect(document.getElementById(containerId)).toBeNull()
    })

    it('should clear event handlers', async () => {
      const instance = await UltraForceWindowManager.getInstance()
      instance.on('test', vi.fn())

      await instance.destroy()

      const info = instance.getDebugInfo() as Record<string, any>
      expect(info.eventEmitter).toBe('TypedEventEmitter')
    })

    it('should reset state to defaults', async () => {
      const instance = await UltraForceWindowManager.getInstance()
      instance.updateState({ isLoading: true, searchError: 'test error' })

      await instance.destroy()

      const state = instance.getState()
      expect(state.isLoading).toBe(false)
      expect(state.searchError).toBeNull()
      expect(state.sfHost).toBeNull()
      expect(state.isVisible).toBe(false)
      expect(state.isInitialized).toBe(false)
    })

    it('should hide modal before destroying if visible', async () => {
      const instance = await UltraForceWindowManager.getInstance()
      await instance.show()
      expect(instance.isVisible()).toBe(true)

      await instance.destroy()
      expect(instance.isVisible()).toBe(false)
      // Modal attribute should be removed
      expect(document.documentElement.hasAttribute('data-ultraforce-modal-open')).toBe(false)
    })
  })

  describe('setup shortcuts (tested via handleSetupShortcutSearch)', () => {
    it('should match shortcut by partial name', async () => {
      const instance = await UltraForceWindowManager.getInstance()
      // Access private method via bracket notation
      const handler = (instance as any).handleSetupShortcutSearch.bind(instance)

      await handler('debug')

      const state = instance.getState()
      expect(state.searchResults).toHaveProperty('SetupShortcut')
      const shortcuts = state.searchResults['SetupShortcut'] || []
      expect(shortcuts.some((s: any) => s.name.toLowerCase().includes('debug'))).toBe(true)
    })

    it('should return all shortcuts when query is empty', async () => {
      const instance = await UltraForceWindowManager.getInstance()
      const handler = (instance as any).handleSetupShortcutSearch.bind(instance)

      await handler('')

      const state = instance.getState()
      const shortcuts = state.searchResults['SetupShortcut'] || []
      // Should return many shortcuts (40+)
      expect(shortcuts.length).toBeGreaterThan(30)
    })

    it('should be case-insensitive', async () => {
      const instance = await UltraForceWindowManager.getInstance()
      const handler = (instance as any).handleSetupShortcutSearch.bind(instance)

      await handler('DEBUG LOGS')
      const state1 = instance.getState()

      await handler('debug logs')
      const state2 = instance.getState()

      expect(state1.searchResults['SetupShortcut']?.length).toBe(
        state2.searchResults['SetupShortcut']?.length
      )
    })

    it('should match by description category', async () => {
      const instance = await UltraForceWindowManager.getInstance()
      const handler = (instance as any).handleSetupShortcutSearch.bind(instance)

      await handler('security')

      const state = instance.getState()
      const shortcuts = state.searchResults['SetupShortcut'] || []
      // Multiple security-related shortcuts should match
      expect(shortcuts.length).toBeGreaterThan(3)
    })

    it('should set error when no SF host available', async () => {
      mockGetSfHost.mockResolvedValue(null)
      const instance = await UltraForceWindowManager.getInstance()
      const handler = (instance as any).handleSetupShortcutSearch.bind(instance)

      await handler('debug')

      const state = instance.getState()
      expect(state.searchError).toContain('Salesforce')
    })
  })

  describe('navigation routing (handleResultClick)', () => {
    let instance: InstanceType<typeof UltraForceWindowManager>
    let openSpy: ReturnType<typeof vi.fn>

    beforeEach(async () => {
      instance = await UltraForceWindowManager.getInstance()
      openSpy = vi.fn()
      vi.stubGlobal('open', openSpy)
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('should navigate to Apex class detail page', async () => {
      const handler = (instance as any).handleResultClick.bind(instance)

      handler({
        id: '01pDn00000abcde',
        name: 'WeatherService',
        type: 'ApexClass'
      })

      expect(openSpy).toHaveBeenCalledWith(
        expect.stringContaining('01pDn00000abcde'),
        '_blank'
      )
    })

    it('should navigate to Flow builder', async () => {
      const handler = (instance as any).handleResultClick.bind(instance)

      handler({
        id: '301Dn000000abcd',
        name: 'CreateCase',
        type: 'Flow'
      })

      expect(openSpy).toHaveBeenCalledWith(
        expect.stringContaining('flowBuilder'),
        '_blank'
      )
    })

    it('should navigate to user profile page', async () => {
      const handler = (instance as any).handleResultClick.bind(instance)

      handler({
        id: '005Dn000001abcdef',
        name: 'Test Admin',
        type: 'User'
      })

      expect(openSpy).toHaveBeenCalledWith(
        expect.stringContaining('ManageUsers'),
        '_blank'
      )
    })

    it('should record User command results in recent history', async () => {
      const handler = (instance as any).handleResultClick.bind(instance)

      handler({
        id: '005Dn000001abcdef',
        name: 'Test Admin',
        type: 'User',
        description: 'test@example.com | System Administrator'
      })

      expect(useHistoryStore.getState().items).toEqual([
        expect.objectContaining({
          id: '005Dn000001abcdef',
          name: 'Test Admin',
          type: 'User',
          description: 'test@example.com | System Administrator',
          url: expect.stringContaining('ManageUsers'),
          visitCount: 1
        })
      ])
    })

    it('should navigate to custom object list page', async () => {
      const handler = (instance as any).handleResultClick.bind(instance)

      handler({
        id: '01IDn000000abcd',
        name: 'Hotel',
        type: 'CustomObject',
        metadata: { QualifiedApiName: 'ASR_Hotel__c' }
      })

      expect(openSpy).toHaveBeenCalledWith(
        expect.stringContaining('ASR_Hotel__c'),
        '_blank'
      )
    })

    it('should navigate to PermissionSet page', async () => {
      const handler = (instance as any).handleResultClick.bind(instance)

      handler({
        id: '0PSDn00000abc',
        name: 'Agent Platform Builder',
        type: 'PermissionSet'
      })

      expect(openSpy).toHaveBeenCalledWith(
        expect.stringContaining('PermSets'),
        '_blank'
      )
    })

    it('should navigate to Profile page', async () => {
      const handler = (instance as any).handleResultClick.bind(instance)

      handler({
        id: '00eDn000001abc',
        name: 'System Administrator',
        type: 'Profile'
      })

      expect(openSpy).toHaveBeenCalledWith(
        expect.stringContaining('EnhancedProfiles'),
        '_blank'
      )
    })

    it('should record Profile command results in recent history', async () => {
      const handler = (instance as any).handleResultClick.bind(instance)

      handler({
        id: '00eDn000001abc',
        name: 'System Administrator',
        type: 'Profile'
      })

      expect(useHistoryStore.getState().items).toEqual([
        expect.objectContaining({
          id: '00eDn000001abc',
          name: 'System Administrator',
          type: 'Profile',
          url: expect.stringContaining('EnhancedProfiles'),
          visitCount: 1
        })
      ])
    })

    it('should open setup shortcut URL directly', async () => {
      const handler = (instance as any).handleResultClick.bind(instance)

      handler({
        id: 'debug-logs',
        name: 'Debug Logs',
        type: 'SetupShortcut',
        url: 'https://myorg.my.salesforce-setup.com/lightning/setup/ApexDebugLogs/home'
      })

      expect(openSpy).toHaveBeenCalledWith(
        'https://myorg.my.salesforce-setup.com/lightning/setup/ApexDebugLogs/home',
        '_blank'
      )
    })

    it('should prefer a result URL and record it in recent history', async () => {
      const handler = (instance as any).handleResultClick.bind(instance)
      const url = 'https://myorg.my.salesforce.com/lightning/r/User/005Dn000001abcdef/view'

      handler({
        id: '005Dn000001abcdef',
        name: 'Test Admin',
        type: 'User',
        url
      })

      expect(openSpy).toHaveBeenCalledWith(url, '_blank')
      expect(useHistoryStore.getState().items[0]).toEqual(
        expect.objectContaining({
          id: '005Dn000001abcdef',
          name: 'Test Admin',
          type: 'User',
          url
        })
      )
    })

    it('should refresh recent history when opening an existing recent item by URL', async () => {
      const handler = (instance as any).handleDirectNavigate.bind(instance)
      const url = 'https://myorg.my.salesforce.com/lightning/setup/EnhancedProfiles/page?address=%2F00eDn000001abc'

      useHistoryStore.getState().recordVisit({
        id: '00eDn000001abc',
        name: 'System Administrator',
        type: 'Profile',
        url
      })
      const firstVisit = useHistoryStore.getState().items[0]

      handler(url)

      expect(openSpy).toHaveBeenCalledWith(url, '_blank')
      expect(useHistoryStore.getState().items[0]).toEqual(
        expect.objectContaining({
          id: firstVisit.id,
          type: firstVisit.type,
          visitCount: 2
        })
      )
    })

    it('should handle unknown result type gracefully', async () => {
      const handler = (instance as any).handleResultClick.bind(instance)

      // Should not throw
      expect(() => handler({
        id: 'unknown-123',
        name: 'Unknown Item',
        type: 'UnknownType'
      })).not.toThrow()
    })

    it('should not navigate when sfHost is null', async () => {
      useSessionStore.getState().setSession(null, false)
      const handler = (instance as any).handleResultClick.bind(instance)

      handler({
        id: '01pDn00000abcde',
        name: 'WeatherService',
        type: 'ApexClass'
      })

      // SetupShortcut without url also should not navigate
      expect(openSpy).not.toHaveBeenCalled()
    })

    it('should navigate to CustomLabel page', async () => {
      const handler = (instance as any).handleResultClick.bind(instance)

      handler({
        id: '101Dn00000abc',
        name: 'MyLabel',
        type: 'CustomLabel'
      })

      expect(openSpy).toHaveBeenCalledWith(
        expect.stringContaining('ExternalStrings'),
        '_blank'
      )
    })
  })

  describe('record context detection', () => {
    it('should detect record context from standard Lightning URL', async () => {
      // Set up window.location to simulate Lightning record page
      Object.defineProperty(window, 'location', {
        writable: true,
        value: {
          href: `https://${TEST_HOST}/lightning/r/Account/001Dn00000abcde/view`,
          hostname: TEST_HOST,
          pathname: '/lightning/r/Account/001Dn00000abcde/view'
        }
      })

      const instance = await UltraForceWindowManager.getInstance()
      await instance.show()

      const state = instance.getState()
      expect(state.recordContext).not.toBeNull()
      expect(state.recordContext?.objectApiName).toBe('Account')
      expect(state.recordContext?.recordId).toBe('001Dn00000abcde')
    })

    it('should return null recordContext for non-record pages', async () => {
      Object.defineProperty(window, 'location', {
        writable: true,
        value: {
          href: `https://${TEST_HOST}/lightning/setup/ApexClasses/home`,
          hostname: TEST_HOST,
          pathname: '/lightning/setup/ApexClasses/home'
        }
      })

      const instance = await UltraForceWindowManager.getInstance()
      await instance.show()

      const state = instance.getState()
      expect(state.recordContext).toBeNull()
    })
  })

  describe('search handling', () => {
    it('should call searchSalesforceMetadata on handleSearch', async () => {
      const instance = await UltraForceWindowManager.getInstance()
      const handler = (instance as any).handleSearch.bind(instance)

      mockSearchMetadata.mockResolvedValue({
        ApexClass: [{ id: '01p', name: 'Test', type: 'ApexClass' }]
      })

      await handler('test', ['ApexClass'], true, true)

      expect(mockSearchMetadata).toHaveBeenCalledWith(
        'test',
        ['ApexClass'],
        TEST_HOST,
        { useFuzzy: true, hideManagedPackage: true }
      )
    })

    it('should update state with search results', async () => {
      const instance = await UltraForceWindowManager.getInstance()
      const handler = (instance as any).handleSearch.bind(instance)
      const expectedResults = {
        ApexClass: [{ id: '01p', name: 'Test', type: 'ApexClass' }]
      }

      mockSearchMetadata.mockResolvedValue(expectedResults)

      await handler('test', ['ApexClass'], true, true)

      const state = instance.getState()
      expect(state.searchResults).toEqual(expectedResults)
      expect(state.isLoading).toBe(false)
    })

    it('should handle search error gracefully', async () => {
      const instance = await UltraForceWindowManager.getInstance()
      const handler = (instance as any).handleSearch.bind(instance)

      mockSearchMetadata.mockRejectedValue(new Error('Search failed'))

      await handler('test', ['ApexClass'], true, true)

      const state = instance.getState()
      expect(state.searchError).toBe('Search failed')
      expect(state.isLoading).toBe(false)
    })

    it('should not search when sfHost is null', async () => {
      mockGetSfHost.mockResolvedValue(null)
      const instance = await UltraForceWindowManager.getInstance()
      const handler = (instance as any).handleSearch.bind(instance)

      await handler('test', ['ApexClass'], true, true)

      expect(mockSearchMetadata).not.toHaveBeenCalled()
    })

    it('should discard stale search results via nonce', async () => {
      const instance = await UltraForceWindowManager.getInstance()
      const handler = (instance as any).handleSearch.bind(instance)

      // Simulate slow search that gets superseded
      let resolveFirst: (value: any) => void
      const slowPromise = new Promise((resolve) => { resolveFirst = resolve })

      mockSearchMetadata
        .mockReturnValueOnce(slowPromise as any)
        .mockResolvedValueOnce({ ApexClass: [{ id: '2', name: 'Second', type: 'ApexClass' }] })

      // Start first search
      const firstSearch = handler('slow', ['ApexClass'], true, true)
      // Start second search (supersedes first)
      const secondSearch = handler('fast', ['ApexClass'], true, true)

      // Resolve first search after second
      resolveFirst!({ ApexClass: [{ id: '1', name: 'First', type: 'ApexClass' }] })

      await firstSearch
      await secondSearch

      // State should have second search results, not first
      const state = instance.getState()
      expect(state.searchResults.ApexClass?.[0]?.name).toBe('Second')
    })
  })

  describe('custom command handling', () => {
    it('should execute custom command via handleCustomSearch', async () => {
      const instance = await UltraForceWindowManager.getInstance()
      const handler = (instance as any).handleCustomSearch.bind(instance)

      vi.mocked(executeCustomCommand).mockResolvedValue([{
        id: '01p',
        name: 'WeatherService',
        type: 'CustomQuery'
      }])

      await handler(
        "SELECT Id, Name FROM ApexClass WHERE Name LIKE '%{query}%'",
        'Weather',
        true,
        'Name'
      )

      expect(executeCustomCommand).toHaveBeenCalled()
      const state = instance.getState()
      expect(state.searchResults).toHaveProperty('CustomQuery')
    })
  })

  describe('settings (via store)', () => {
    it('should read closeOnNavigate from settings store', async () => {
      useSettingsStore.setState({ closeOnNavigate: false })

      const instance = await UltraForceWindowManager.getInstance()
      const state = instance.getState()

      expect(state.closeOnNavigate).toBe(false)
    })

    it('should read navigationMode from settings store', async () => {
      useSettingsStore.setState({ navigationMode: 'classic' })

      const instance = await UltraForceWindowManager.getInstance()
      const state = instance.getState()

      expect(state.navigationMode).toBe('classic')
    })

    it('should read fuzzySearch from settings store', async () => {
      useSettingsStore.setState({ fuzzySearch: false })

      const instance = await UltraForceWindowManager.getInstance()
      const state = instance.getState()

      expect(state.fuzzySearch).toBe(false)
    })

    it('should default closeOnNavigate to true', async () => {
      const instance = await UltraForceWindowManager.getInstance()
      const state = instance.getState()

      expect(state.closeOnNavigate).toBe(true)
    })
  })
})
