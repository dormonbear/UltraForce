import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SearchResult } from '~types'

// Fixtures
import apexClassFixtures from './__fixtures__/salesforce-responses/apex-classes.json'
import entityDefFixtures from './__fixtures__/salesforce-responses/entity-definitions.json'
import fieldDefFixtures from './__fixtures__/salesforce-responses/field-definitions.json'
import flowDefFixtures from './__fixtures__/salesforce-responses/flow-definitions.json'
import userFixtures from './__fixtures__/salesforce-responses/users.json'

// Mock dependencies before importing the module under test
vi.mock('./auth', () => ({
  getSession: vi.fn(),
  sfRest: vi.fn(),
  API_VERSION: '62.0'
}))

vi.mock('./metadata-cache', () => {
  const mockInstance = {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    clear: vi.fn(),
    getStats: vi.fn(),
    warmup: vi.fn()
  }
  return {
    MetadataCache: {
      getInstance: () => mockInstance
    }
  }
})

vi.mock('./fuzzy-search', () => ({
  buildSearchIndex: vi.fn(),
  searchIndex: vi.fn().mockReturnValue([]),
  hasSearchIndex: vi.fn().mockReturnValue(false),
  clearSearchIndex: vi.fn(),
  clearAllSearchIndexes: vi.fn(),
  parseSearchQuery: vi.fn((query: string) => ({
    searchTerm: query,
    filterTerm: null,
    isExactMatch: false
  }))
}))

vi.mock('./profile-search', () => ({
  parseProfileDotNotation: vi.fn().mockReturnValue(null),
  buildProfileSubMenu: vi.fn().mockReturnValue([]),
  queryProfileUsers: vi.fn().mockResolvedValue([]),
  queryProfileObjectPermissions: vi.fn().mockResolvedValue([]),
  queryProfileFieldPermissions: vi.fn().mockResolvedValue([]),
  queryProfileCustomPermissions: vi.fn().mockResolvedValue([]),
  queryProfileApexClassAccess: vi.fn().mockResolvedValue([]),
  queryProfileVFPageAccess: vi.fn().mockResolvedValue([]),
  queryProfileConnectedApps: vi.fn().mockResolvedValue([]),
  queryProfileAssignedApps: vi.fn().mockResolvedValue([]),
  filterProfileSubData: vi.fn((data: any) => data)
}))

vi.mock('./unsupported-types', () => ({
  markTypeUnsupported: vi.fn(),
  getUnsupportedTypes: vi.fn().mockResolvedValue([]),
  markTypesChecked: vi.fn(),
  needsPermissionCheck: vi.fn().mockResolvedValue(false),
  clearUnsupportedTypesCache: vi.fn()
}))

vi.mock('./domain-utils', () => ({
  normalizeHost: vi.fn((host: string) => host),
  escapeSoql: vi.fn((input: string) => input)
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

// Import after mocks
import {
  searchSalesforceMetadata,
  executeCustomCommand,
  isApiAvailable,
  warmupMetadataCache,
  clearMetadataCache,
  getAvailableMetadataTypes,
  getUnsupportedTypes,
  getSupportedMetadataTypes,
  validateSalesforceSession,
  refreshMetadataCache,
  checkMetadataPermissions
} from './salesforce-api'
import { getSession, sfRest } from './auth'
import { MetadataCache } from './metadata-cache'
import {
  buildSearchIndex,
  searchIndex,
  hasSearchIndex,
  clearSearchIndex,
  clearAllSearchIndexes
} from './fuzzy-search'
import { needsPermissionCheck } from './unsupported-types'

const mockGetSession = vi.mocked(getSession)
const mockSfRest = vi.mocked(sfRest)
const mockCache = MetadataCache.getInstance()
const mockBuildSearchIndex = vi.mocked(buildSearchIndex)
const mockSearchIndex = vi.mocked(searchIndex)
const mockHasSearchIndex = vi.mocked(hasSearchIndex)
const mockClearSearchIndex = vi.mocked(clearSearchIndex)
const mockClearAllSearchIndexes = vi.mocked(clearAllSearchIndexes)
const mockNeedsPermissionCheck = vi.mocked(needsPermissionCheck)

const TEST_HOST = 'myorg.my.salesforce.com'
const TEST_SESSION = { key: 'test-session-key-12345', hostname: TEST_HOST }

// Mock global fetch for fetchAllPages
const mockFetch = vi.fn()

describe('salesforce-api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue(TEST_SESSION)
    global.fetch = mockFetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('searchSalesforceMetadata', () => {
    it('should return empty object when no session', async () => {
      mockGetSession.mockResolvedValue(null)
      const result = await searchSalesforceMetadata('test', ['ApexClass'], TEST_HOST)
      expect(result).toEqual({})
    })

    it('should return empty object when host is empty', async () => {
      const result = await searchSalesforceMetadata('test', ['ApexClass'], '')
      expect(result).toEqual({})
    })

    it('should use cached results on cache hit with existing search index', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(apexClassFixtures)
      mockHasSearchIndex.mockReturnValue(true)
      const mockResults: SearchResult[] = [{
        id: '01pDn00000abcde',
        name: 'WeatherService',
        type: 'ApexClass'
      }]
      mockSearchIndex.mockReturnValue(mockResults)

      const result = await searchSalesforceMetadata('weather', ['ApexClass'], TEST_HOST)

      expect(result.ApexClass).toEqual(mockResults)
      expect(mockBuildSearchIndex).not.toHaveBeenCalled()
    })

    it('should fetch from API on cache miss', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null)
      mockHasSearchIndex.mockReturnValue(false)
      mockSearchIndex.mockReturnValue([])

      // Mock sfRest for API call (fetchAllPages now uses sfRest)
      mockSfRest.mockResolvedValue({
        totalSize: apexClassFixtures.length,
        done: true,
        records: apexClassFixtures
      })

      const result = await searchSalesforceMetadata('weather', ['ApexClass'], TEST_HOST)

      expect(mockBuildSearchIndex).toHaveBeenCalledWith(
        'ApexClass',
        apexClassFixtures,
        TEST_HOST
      )
      expect(result).toHaveProperty('ApexClass')
    })

    it('should mark type as unsupported on INVALID_TYPE API error', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null)
      mockHasSearchIndex.mockReturnValue(false)

      // sfRest throws on error responses (like sfRest does internally)
      mockSfRest.mockRejectedValue(new Error('API Error 400: [{"message":"INVALID_TYPE: sObject type not supported"}]'))

      const result = await searchSalesforceMetadata('test', ['ApexClass'], TEST_HOST)

      const { markTypeUnsupported } = await import('./unsupported-types')
      expect(markTypeUnsupported).toHaveBeenCalledWith(TEST_HOST, 'ApexClass')
      expect(result).toHaveProperty('ApexClass')
    })

    it('should handle concurrent searches for multiple metadata types', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null)
      mockHasSearchIndex.mockReturnValue(false)
      mockSearchIndex.mockReturnValue([])

      // Different response for each type
      mockSfRest.mockResolvedValue({
        totalSize: 1,
        done: true,
        records: [apexClassFixtures[0]]
      })

      const result = await searchSalesforceMetadata('test', ['ApexClass', 'Flow'], TEST_HOST)

      // Both types should be present in results
      expect(result).toHaveProperty('ApexClass')
      expect(result).toHaveProperty('Flow')
    })

    it('should delegate to fuzzy search when index exists', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(apexClassFixtures)
      mockHasSearchIndex.mockReturnValue(true)
      const mockResults: SearchResult[] = [{
        id: '01pDn00000abcde',
        name: 'WeatherService',
        type: 'ApexClass'
      }]
      mockSearchIndex.mockReturnValue(mockResults)

      await searchSalesforceMetadata('weather', ['ApexClass'], TEST_HOST, { useFuzzy: true })

      expect(mockSearchIndex).toHaveBeenCalledWith(
        'weather',
        'ApexClass',
        TEST_HOST,
        { useFuzzy: true, hideManagedPackage: true }
      )
    })

    it('should pass hideManagedPackage option correctly', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(apexClassFixtures)
      mockHasSearchIndex.mockReturnValue(true)
      mockSearchIndex.mockReturnValue([])

      await searchSalesforceMetadata('test', ['ApexClass'], TEST_HOST, {
        useFuzzy: false,
        hideManagedPackage: false
      })

      expect(mockSearchIndex).toHaveBeenCalledWith(
        'test',
        'ApexClass',
        TEST_HOST,
        { useFuzzy: false, hideManagedPackage: false }
      )
    })

    it('should handle User type with real-time SOQL search', async () => {
      // User search uses fetchAllPages -> sfRest (not cache/index)
      mockSfRest.mockResolvedValue({
        totalSize: userFixtures.length,
        done: true,
        records: userFixtures
      })

      const result = await searchSalesforceMetadata('Admin', ['User'], TEST_HOST)

      expect(result).toHaveProperty('User')
      expect(Array.isArray(result.User)).toBe(true)
    })

    it('should handle Queue type with real-time SOQL search', async () => {
      mockSfRest.mockResolvedValue({
        totalSize: 1,
        done: true,
        records: [{
          attributes: { type: 'Group' },
          Id: '00GDn000001abcde',
          Name: 'Support Queue',
          DeveloperName: 'Support_Queue',
          Email: 'support@test.example.com'
        }]
      })

      const result = await searchSalesforceMetadata('Support', ['Queue'], TEST_HOST)

      expect(result).toHaveProperty('Queue')
    })

    it('should handle Group type with real-time SOQL search', async () => {
      mockSfRest.mockResolvedValue({
        totalSize: 1,
        done: true,
        records: [{
          attributes: { type: 'Group' },
          Id: '00GDn000002fghij',
          Name: 'All Employees',
          DeveloperName: 'All_Employees'
        }]
      })

      const result = await searchSalesforceMetadata('All', ['Group'], TEST_HOST)

      expect(result).toHaveProperty('Group')
    })

    it('should filter out CustomField from non-dot-notation searches', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(apexClassFixtures)
      mockHasSearchIndex.mockReturnValue(true)
      mockSearchIndex.mockReturnValue([])

      const result = await searchSalesforceMetadata('test', ['ApexClass', 'CustomField'], TEST_HOST)

      // CustomField should not appear in results for non-dot-notation query
      expect(result).not.toHaveProperty('CustomField')
    })

    it('should handle dot-notation field search', async () => {
      // Field search: "Account.Name"
      mockHasSearchIndex.mockReturnValue(false)
      mockSfRest.mockResolvedValue({
        totalSize: fieldDefFixtures.length,
        done: true,
        records: fieldDefFixtures
      })
      mockSearchIndex.mockReturnValue([])

      const result = await searchSalesforceMetadata('Account.Name', ['CustomField'], TEST_HOST)

      expect(result).toHaveProperty('CustomField')
    })

    it('should handle empty query returning empty results', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null)
      mockHasSearchIndex.mockReturnValue(false)
      mockSfRest.mockResolvedValue({
        totalSize: 0,
        done: true,
        records: []
      })
      mockSearchIndex.mockReturnValue([])

      const result = await searchSalesforceMetadata('', ['ApexClass'], TEST_HOST)

      expect(result).toHaveProperty('ApexClass')
    })
  })

  describe('executeCustomCommand', () => {
    const baseOptions = {
      soqlTemplate: "SELECT Id, Name FROM ApexClass WHERE Name LIKE '%{query}%' LIMIT 10",
      searchQuery: 'Weather',
      useToolingApi: true,
      nameField: 'Name'
    }

    it('should execute SOQL query via sfRest', async () => {
      mockSfRest.mockResolvedValue({
        totalSize: 1,
        done: true,
        records: [apexClassFixtures[0]]
      })

      const results = await executeCustomCommand(baseOptions, TEST_HOST)

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('WeatherService')
      expect(results[0].type).toBe('CustomQuery')
    })

    it('should format results using descriptionFields from command config', async () => {
      mockSfRest.mockResolvedValue({
        totalSize: 1,
        done: true,
        records: [userFixtures[0]]
      })

      const results = await executeCustomCommand({
        ...baseOptions,
        soqlTemplate: "SELECT Id, Name, Email, Username FROM User WHERE Name LIKE '%{query}%'",
        nameField: 'Name',
        descriptionFields: ['Email', 'Username']
      }, TEST_HOST)

      expect(results[0].description).toContain('admin@test.example.com')
    })

    it('should return empty on API failure (no session)', async () => {
      mockGetSession.mockResolvedValue(null)

      const results = await executeCustomCommand(baseOptions, TEST_HOST)

      expect(results).toEqual([])
    })

    it('should return empty when sfHost is empty', async () => {
      const results = await executeCustomCommand(baseOptions, '')

      expect(results).toEqual([])
    })

    it('should throw formatted error on API error', async () => {
      mockSfRest.mockRejectedValue(new Error('API Error 400: [{"message":"INVALID_FIELD: No such column Name"}]'))

      await expect(executeCustomCommand(baseOptions, TEST_HOST))
        .rejects.toThrow('SOQL Error')
    })

    it('should handle empty result set', async () => {
      mockSfRest.mockResolvedValue({
        totalSize: 0,
        done: true,
        records: []
      })

      const results = await executeCustomCommand(baseOptions, TEST_HOST)

      expect(results).toEqual([])
    })

    it('should use getFieldValue for dot-notation field paths', async () => {
      mockSfRest.mockResolvedValue({
        totalSize: 1,
        done: true,
        records: [userFixtures[0]]
      })

      const results = await executeCustomCommand({
        ...baseOptions,
        soqlTemplate: "SELECT Id, Name, Profile.Name FROM User LIMIT 1",
        nameField: 'Name',
        descriptionFields: ['Profile.Name']
      }, TEST_HOST)

      expect(results[0].description).toBe('System Administrator')
    })

    it('should replace {query} placeholder in SOQL template', async () => {
      mockSfRest.mockResolvedValue({
        totalSize: 0,
        done: true,
        records: []
      })

      await executeCustomCommand({
        ...baseOptions,
        searchQuery: 'TestSearch'
      }, TEST_HOST)

      // Verify sfRest was called with the interpolated query path
      expect(mockSfRest).toHaveBeenCalled()
      const queryPath = mockSfRest.mock.calls[0][1] as string
      expect(queryPath).toContain('TestSearch')
    })
  })

  describe('isApiAvailable', () => {
    it('should return true when no cached state (unknown host)', () => {
      const result = isApiAvailable('unknown-host.salesforce.com')
      expect(result).toBe(true)
    })

    it('should return true for session key change (recheck needed)', () => {
      // First call has no cache, returns true
      const result = isApiAvailable(TEST_HOST, 'new-session-key')
      expect(result).toBe(true)
    })

    it('should reflect markApiAvailability(false) after a failed session validation', async () => {
      const host = 'unavailable-org.my.salesforce.com'
      const session = { key: 'session-key-abc123', hostname: host }
      mockGetSession.mockResolvedValue(session)
      // validateSalesforceSession marks availability false on a non-ok response
      mockFetch.mockResolvedValue({ ok: false })

      const valid = await validateSalesforceSession(host)
      expect(valid).toBe(false)

      // Same session key -> reflects cached unavailable state
      expect(isApiAvailable(host, session.key)).toBe(false)
    })

    it('should reset to available when the session key changes', async () => {
      const host = 'reset-org.my.salesforce.com'
      const session = { key: 'old-session-key-1', hostname: host }
      mockGetSession.mockResolvedValue(session)
      mockFetch.mockResolvedValue({ ok: false })

      await validateSalesforceSession(host)
      expect(isApiAvailable(host, session.key)).toBe(false)

      // A different session key (different 8-char hash) forces a recheck -> true
      expect(isApiAvailable(host, 'new-session-key-2')).toBe(true)
    })
  })

  describe('warmupMetadataCache', () => {
    it('should prefetch common metadata types', async () => {
      mockNeedsPermissionCheck.mockResolvedValue(false)
      vi.mocked(mockCache.get).mockResolvedValue(null)
      mockHasSearchIndex.mockReturnValue(false)
      mockSearchIndex.mockReturnValue([])

      mockSfRest.mockResolvedValue({
        totalSize: 1,
        done: true,
        records: [apexClassFixtures[0]]
      })

      await warmupMetadataCache(TEST_HOST)

      // Should build search index for common types
      expect(mockBuildSearchIndex).toHaveBeenCalled()
    })

    it('should not warmup when no session', async () => {
      mockGetSession.mockResolvedValue(null)

      await warmupMetadataCache(TEST_HOST)

      expect(mockBuildSearchIndex).not.toHaveBeenCalled()
    })

    it('should skip unsupported types during warmup', async () => {
      mockNeedsPermissionCheck.mockResolvedValue(false)
      const { getUnsupportedTypes: getUnsupportedRaw } = await import('./unsupported-types')
      vi.mocked(getUnsupportedRaw).mockResolvedValue(['ApexClass', 'Flow'])

      vi.mocked(mockCache.get).mockResolvedValue(null)
      mockSfRest.mockResolvedValue({
        totalSize: 0,
        done: true,
        records: []
      })

      await warmupMetadataCache(TEST_HOST)

      // ApexClass and Flow should be skipped, but others should still process
      const buildCalls = mockBuildSearchIndex.mock.calls
      const warmedTypes = buildCalls.map(call => call[0])
      expect(warmedTypes).not.toContain('ApexClass')
      expect(warmedTypes).not.toContain('Flow')
    })
  })

  describe('clearMetadataCache', () => {
    it('should clear both cache and search indexes', async () => {
      await clearMetadataCache()

      expect(mockCache.clear).toHaveBeenCalled()
      expect(mockClearAllSearchIndexes).toHaveBeenCalled()
    })
  })

  describe('getAvailableMetadataTypes', () => {
    it('should return all known metadata type keys', () => {
      const types = getAvailableMetadataTypes()

      expect(types).toContain('ApexClass')
      expect(types).toContain('Flow')
      expect(types).toContain('User')
      expect(types).toContain('CustomObject')
      expect(types).toContain('PermissionSet')
      expect(types).toContain('Profile')
      expect(types.length).toBeGreaterThan(10)
    })
  })

  describe('getUnsupportedTypes', () => {
    it('should delegate to unsupported-types module with normalized host', async () => {
      const { getUnsupportedTypes: getUnsupportedRaw } = await import('./unsupported-types')
      vi.mocked(getUnsupportedRaw).mockResolvedValue(['ApexClass'])

      const result = await getUnsupportedTypes(TEST_HOST)

      expect(result).toEqual(['ApexClass'])
    })
  })

  describe('getSupportedMetadataTypes', () => {
    it('should return types excluding unsupported ones', async () => {
      const { getUnsupportedTypes: getUnsupportedRaw } = await import('./unsupported-types')
      vi.mocked(getUnsupportedRaw).mockResolvedValue(['ApexClass', 'Flow'])

      const result = await getSupportedMetadataTypes(TEST_HOST)

      expect(result).not.toContain('ApexClass')
      expect(result).not.toContain('Flow')
      expect(result).toContain('CustomObject')
      expect(result).toContain('User')
    })
  })

  describe('validateSalesforceSession', () => {
    it('should return true when API responds ok', async () => {
      mockFetch.mockResolvedValue({ ok: true })

      const result = await validateSalesforceSession(TEST_HOST)

      expect(result).toBe(true)
    })

    it('should return false when no session', async () => {
      mockGetSession.mockResolvedValue(null)

      const result = await validateSalesforceSession(TEST_HOST)

      expect(result).toBe(false)
    })

    it('should return false when API responds not ok', async () => {
      mockFetch.mockResolvedValue({ ok: false })

      const result = await validateSalesforceSession(TEST_HOST)

      expect(result).toBe(false)
    })

    it('should return false on fetch error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      const result = await validateSalesforceSession(TEST_HOST)

      expect(result).toBe(false)
    })
  })

  describe('refreshMetadataCache', () => {
    it('should delete old cache and rebuild with fresh data', async () => {
      mockSfRest.mockResolvedValue({
        totalSize: apexClassFixtures.length,
        done: true,
        records: apexClassFixtures
      })

      await refreshMetadataCache('ApexClass', TEST_HOST)

      expect(mockCache.delete).toHaveBeenCalled()
      expect(mockClearSearchIndex).toHaveBeenCalledWith('ApexClass', TEST_HOST)
      expect(mockCache.set).toHaveBeenCalled()
      expect(mockBuildSearchIndex).toHaveBeenCalled()
    })

    it('should do nothing when no session', async () => {
      mockGetSession.mockResolvedValue(null)

      await refreshMetadataCache('ApexClass', TEST_HOST)

      expect(mockCache.delete).not.toHaveBeenCalled()
    })
  })

  describe('fetchAllPages (tested indirectly via sfRest)', () => {
    it('should handle pagination with nextRecordsUrl', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null)
      mockHasSearchIndex.mockReturnValue(false)
      mockSearchIndex.mockReturnValue([])

      // First page
      mockSfRest
        .mockResolvedValueOnce({
          totalSize: 4,
          done: false,
          records: apexClassFixtures.slice(0, 2),
          nextRecordsUrl: '/services/data/v62.0/query/01gDn0000abcde-2000'
        })
        // Second page
        .mockResolvedValueOnce({
          totalSize: 4,
          done: true,
          records: apexClassFixtures.slice(2, 4)
        })

      const result = await searchSalesforceMetadata('test', ['ApexClass'], TEST_HOST)

      // Should have made 2 sfRest calls for pagination
      expect(mockSfRest).toHaveBeenCalledTimes(2)
      expect(result).toHaveProperty('ApexClass')
    })

    it('should stop when done is true', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null)
      mockHasSearchIndex.mockReturnValue(false)
      mockSearchIndex.mockReturnValue([])

      mockSfRest.mockResolvedValueOnce({
        totalSize: 2,
        done: true,
        records: apexClassFixtures.slice(0, 2)
      })

      await searchSalesforceMetadata('test', ['ApexClass'], TEST_HOST)

      // Only one sfRest call since done=true (no nextRecordsUrl)
      expect(mockSfRest).toHaveBeenCalledTimes(1)
    })

    it('should throw on 401 session expired', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null)
      mockHasSearchIndex.mockReturnValue(false)

      mockSfRest.mockRejectedValue(new Error('Session expired. Please refresh the page and try again.'))

      // The error is caught inside searchMetadataTypes, so it returns empty
      const result = await searchSalesforceMetadata('test', ['ApexClass'], TEST_HOST)
      expect(result.ApexClass).toEqual([])
    })
  })

  describe('formatCustomCommandError (tested indirectly)', () => {
    it('should include error message and suggestion for API errors', async () => {
      mockSfRest.mockRejectedValue(new Error('API Error 400: [{"message":"INVALID_FIELD: SELECT Invalid FROM Account"}]'))

      await expect(executeCustomCommand({
        soqlTemplate: 'SELECT Invalid FROM Account',
        searchQuery: '',
        useToolingApi: false,
        nameField: 'Name'
      }, TEST_HOST)).rejects.toThrow('SOQL Error')
    })

    it('should handle non-JSON error responses', async () => {
      mockSfRest.mockRejectedValue(new Error('API Error 500: Internal Server Error'))

      await expect(executeCustomCommand({
        soqlTemplate: 'SELECT Id FROM Account',
        searchQuery: '',
        useToolingApi: false,
        nameField: 'Name'
      }, TEST_HOST)).rejects.toThrow('check your custom command configuration')
    })
  })

  describe('buildCustomResultDescription (tested indirectly)', () => {
    it('should join field values with separator', async () => {
      mockSfRest.mockResolvedValue({
        totalSize: 1,
        done: true,
        records: [{
          Id: '001abc',
          Name: 'Test Account',
          Industry: 'Technology',
          Phone: '555-1234',
          attributes: { type: 'Account' }
        }]
      })

      const results = await executeCustomCommand({
        soqlTemplate: 'SELECT Id, Name, Industry, Phone FROM Account LIMIT 1',
        searchQuery: '',
        useToolingApi: false,
        nameField: 'Name'
      }, TEST_HOST)

      // Description should include non-excluded fields joined by ' | '
      expect(results[0].description).toContain('Industry: Technology')
      expect(results[0].description).toContain('Phone: 555-1234')
    })

    it('should use first column value as name (buildResultName)', async () => {
      mockSfRest.mockResolvedValue({
        totalSize: 1,
        done: true,
        records: [{
          Id: '301abc',
          MasterLabel: 'My Flow',
          Status: 'Active',
          attributes: { type: 'Flow' }
        }]
      })

      const results = await executeCustomCommand({
        soqlTemplate: 'SELECT Id, MasterLabel, Status FROM Flow LIMIT 1',
        searchQuery: '',
        useToolingApi: true,
        nameField: 'MasterLabel'
      }, TEST_HOST)

      expect(results[0].name).toBe('My Flow')
    })
  })

  describe('getNestedValue (tested indirectly)', () => {
    it('should traverse dot-notation paths', async () => {
      mockSfRest.mockResolvedValue({
        totalSize: 1,
        done: true,
        records: [userFixtures[0]]
      })

      const results = await executeCustomCommand({
        soqlTemplate: 'SELECT Id, Name, Profile.Name, UserRole.Name FROM User LIMIT 1',
        searchQuery: '',
        useToolingApi: false,
        nameField: 'Profile.Name',
        descriptionFields: ['UserRole.Name']
      }, TEST_HOST)

      expect(results[0].name).toBe('System Administrator')
      expect(results[0].description).toBe('CEO')
    })

    it('should return empty string for null path segments', async () => {
      mockSfRest.mockResolvedValue({
        totalSize: 1,
        done: true,
        records: [userFixtures[1]] // Integration User has null UserRole
      })

      const results = await executeCustomCommand({
        soqlTemplate: 'SELECT Id, Name, UserRole.Name FROM User LIMIT 1',
        searchQuery: '',
        useToolingApi: false,
        nameField: 'Name',
        descriptionFields: ['UserRole.Name']
      }, TEST_HOST)

      // UserRole is null, so description should not contain it
      expect(results[0].description).not.toContain('null')
    })
  })

  describe('checkMetadataPermissions', () => {
    it('should return empty array when no session', async () => {
      mockGetSession.mockResolvedValue(null)

      const result = await checkMetadataPermissions(TEST_HOST)

      expect(result).toEqual([])
    })

    it('should check ViewSetup permission first', async () => {
      // Mock fetch for ViewSetup check
      mockFetch.mockResolvedValueOnce({ ok: true })
      // Mock subsequent per-type checks
      mockFetch.mockResolvedValue({ ok: true })

      const result = await checkMetadataPermissions(TEST_HOST)

      // First call should be the ViewSetup check (ApexClass LIMIT 1)
      expect(mockFetch).toHaveBeenCalled()
      expect(Array.isArray(result)).toBe(true)
    })

    it('should skip tooling API types when no ViewSetup permission', async () => {
      // ViewSetup check fails
      mockFetch.mockResolvedValue({ ok: false })

      const result = await checkMetadataPermissions(TEST_HOST)

      // Should return tooling API types as unsupported
      expect(result).toContain('ApexClass')
      expect(result).toContain('Flow')
    })
  })

  describe('fixture data integrity', () => {
    it('should have valid apex class fixtures with attributes metadata', () => {
      expect(apexClassFixtures.length).toBeGreaterThanOrEqual(3)
      for (const record of apexClassFixtures) {
        expect(record).toHaveProperty('attributes')
        expect(record.attributes).toHaveProperty('type', 'ApexClass')
        expect(record).toHaveProperty('Id')
        expect(record).toHaveProperty('Name')
      }
    })

    it('should have valid entity definition fixtures', () => {
      expect(entityDefFixtures.length).toBeGreaterThanOrEqual(3)
      for (const record of entityDefFixtures) {
        expect(record).toHaveProperty('attributes')
        expect(record).toHaveProperty('QualifiedApiName')
        expect(record).toHaveProperty('Label')
      }
    })

    it('should have valid field definition fixtures with EntityDefinition reference', () => {
      expect(fieldDefFixtures.length).toBeGreaterThanOrEqual(3)
      for (const record of fieldDefFixtures) {
        expect(record).toHaveProperty('attributes')
        expect(record).toHaveProperty('QualifiedApiName')
        expect(record).toHaveProperty('DataType')
        expect(record).toHaveProperty('EntityDefinition')
        expect(record.EntityDefinition).toHaveProperty('QualifiedApiName')
      }
    })

    it('should have valid flow definition fixtures', () => {
      expect(flowDefFixtures.length).toBeGreaterThanOrEqual(3)
      for (const record of flowDefFixtures) {
        expect(record).toHaveProperty('attributes')
        expect(record).toHaveProperty('MasterLabel')
        expect(record).toHaveProperty('Status')
      }
    })

    it('should have valid user fixtures with profile and role references', () => {
      expect(userFixtures.length).toBeGreaterThanOrEqual(3)
      for (const record of userFixtures) {
        expect(record).toHaveProperty('attributes')
        expect(record).toHaveProperty('Name')
        expect(record).toHaveProperty('Username')
        expect(record).toHaveProperty('Email')
      }
      // At least one user should have a Profile
      const withProfile = userFixtures.filter((u) => u.Profile !== null)
      expect(withProfile.length).toBeGreaterThan(0)
    })
  })
})
