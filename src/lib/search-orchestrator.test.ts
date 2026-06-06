import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SearchResult } from '~types'

vi.mock('./auth', () => ({
  getSession: vi.fn(),
  API_VERSION: '62.0'
}))
vi.mock('./metadata-fetcher', () => ({
  fetchAllPages: vi.fn().mockResolvedValue([]),
  ensureCMDTRecordIndex: vi.fn().mockResolvedValue(undefined),
  ensureCustomSettingRecordIndex: vi.fn().mockResolvedValue(undefined),
  ensureFieldIndex: vi.fn().mockResolvedValue(undefined),
  ensureMetadataIndex: vi.fn().mockResolvedValue(undefined)
}))
vi.mock('./fuzzy-search', () => ({
  searchIndex: vi.fn().mockReturnValue([]),
  hasSearchIndex: vi.fn().mockReturnValue(false)
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
  filterProfileSubData: vi.fn((d: unknown) => d)
}))
vi.mock('./domain-utils', () => ({
  normalizeHost: vi.fn((h: string) => h),
  escapeSoql: vi.fn((s: string) => s)
}))
vi.mock('./logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

import { searchSalesforceMetadata } from './search-orchestrator'
import { getSession } from './auth'
import {
  fetchAllPages,
  ensureCMDTRecordIndex,
  ensureFieldIndex,
  ensureMetadataIndex
} from './metadata-fetcher'
import { searchIndex, hasSearchIndex } from './fuzzy-search'
import {
  parseProfileDotNotation,
  buildProfileSubMenu,
  queryProfileUsers
} from './profile-search'

const mockGetSession = vi.mocked(getSession)
const mockParseProfileDotNotation = vi.mocked(parseProfileDotNotation)
const mockBuildProfileSubMenu = vi.mocked(buildProfileSubMenu)
const mockQueryProfileUsers = vi.mocked(queryProfileUsers)
const mockFetchAllPages = vi.mocked(fetchAllPages)
const mockSearchIndex = vi.mocked(searchIndex)
const mockHasSearchIndex = vi.mocked(hasSearchIndex)
const mockEnsureCMDTRecordIndex = vi.mocked(ensureCMDTRecordIndex)
const mockEnsureFieldIndex = vi.mocked(ensureFieldIndex)
const mockEnsureMetadataIndex = vi.mocked(ensureMetadataIndex)

const fieldResult: SearchResult = { id: '00N000000000001', name: 'Name', type: 'CustomField', description: 'Text' }
const TEST_HOST = 'myorg.my.salesforce.com'
const SESSION = { key: 'k', hostname: TEST_HOST }

describe('search-orchestrator / searchSalesforceMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue(SESSION)
  })

  it('returns {} when sfHost is empty', async () => {
    const result = await searchSalesforceMetadata('weather', ['ApexClass'], '')
    expect(result).toEqual({})
    expect(mockGetSession).not.toHaveBeenCalled()
  })

  it('returns {} when there is no session', async () => {
    mockGetSession.mockResolvedValue(null)
    const result = await searchSalesforceMetadata('x', ['ApexClass'], TEST_HOST)
    expect(result).toEqual({})
  })

  it('runs a realtime User SOQL search and maps records to SearchResult[]', async () => {
    mockFetchAllPages.mockResolvedValue([
      {
        Id: '005000000000001',
        Name: 'Dormon Zhou',
        Username: 'dormon@test.com',
        Email: 'dormon@test.com',
        FederationIdentifier: null,
        IsActive: true,
        Profile: { Name: 'System Administrator' },
        UserRole: null
      }
    ])

    const result = await searchSalesforceMetadata('Dormon', ['User'], TEST_HOST)

    expect(result.User).toHaveLength(1)
    expect(result.User[0]).toMatchObject({
      id: '005000000000001',
      name: 'Dormon Zhou',
      type: 'User'
    })
    expect(result.User[0].description).toContain('dormon@test.com')
    expect(result.User[0].description).toContain('System Administrator')
  })

  it('appends "Inactive" to description for inactive users', async () => {
    mockFetchAllPages.mockResolvedValue([
      { Id: '005x', Name: 'Old User', Username: 'old@test.com', Email: '', FederationIdentifier: null, IsActive: false, Profile: null, UserRole: null }
    ])
    const result = await searchSalesforceMetadata('Old', ['User'], TEST_HOST)
    expect(result.User[0].description).toContain('Inactive')
  })

  it('runs a realtime Queue search with type "Queue"', async () => {
    mockFetchAllPages.mockResolvedValue([
      { Id: '00G000000000001', Name: 'Support Queue', DeveloperName: 'Support_Queue', Email: 'support@test.com' }
    ])
    const result = await searchSalesforceMetadata('Support', ['Queue'], TEST_HOST)
    expect(result.Queue[0]).toMatchObject({ id: '00G000000000001', name: 'Support Queue', type: 'Queue' })
    expect(result.Queue[0].description).toContain('Support_Queue')
  })

  it('runs a realtime Group search with type "Group"', async () => {
    mockFetchAllPages.mockResolvedValue([
      { Id: '00G000000000002', Name: 'All Reps', DeveloperName: 'All_Reps' }
    ])
    const result = await searchSalesforceMetadata('Reps', ['Group'], TEST_HOST)
    expect(result.Group[0]).toMatchObject({ name: 'All Reps', type: 'Group' })
  })

  it('returns [] for a realtime type when fetchAllPages throws', async () => {
    mockFetchAllPages.mockRejectedValue(new Error('boom'))
    const result = await searchSalesforceMetadata('x', ['User'], TEST_HOST)
    expect(result.User).toEqual([])
  })

  it('skips realtime search when query is blank', async () => {
    const result = await searchSalesforceMetadata('   ', ['User'], TEST_HOST)
    expect(mockFetchAllPages).not.toHaveBeenCalled()
    expect(result.User).toBeUndefined()
  })
})

describe('search-orchestrator / dot-notation field search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue(SESSION)
  })

  it('returns field results from the cached Field index for "Account.Name"', async () => {
    mockEnsureFieldIndex.mockResolvedValue(undefined)
    mockHasSearchIndex.mockReturnValue(true)
    mockSearchIndex.mockReturnValue([fieldResult])

    const result = await searchSalesforceMetadata('Account.Name', ['CustomField'], TEST_HOST)

    expect(mockEnsureFieldIndex).toHaveBeenCalledWith('Account', TEST_HOST)
    expect(mockHasSearchIndex).toHaveBeenCalledWith('Field:Account', TEST_HOST)
    expect(mockSearchIndex).toHaveBeenCalledWith('Name', 'Field:Account', TEST_HOST, {
      useFuzzy: true,
      hideManagedPackage: true
    })
    expect(result.CustomField).toEqual([fieldResult])
  })

  it('returns [] for CustomField when the Field index is not present', async () => {
    mockEnsureFieldIndex.mockResolvedValue(undefined)
    mockHasSearchIndex.mockReturnValue(false)
    mockSearchIndex.mockReturnValue([fieldResult])

    const result = await searchSalesforceMetadata('Account.Name', ['CustomField'], TEST_HOST)

    expect(result.CustomField).toEqual([])
    expect(mockSearchIndex).not.toHaveBeenCalledWith('Name', 'Field:Account', TEST_HOST, expect.anything())
  })

  it('returns [] for CustomField when ensureFieldIndex throws', async () => {
    mockEnsureFieldIndex.mockRejectedValue(new Error('boom'))

    const result = await searchSalesforceMetadata('Account.Name', ['CustomField'], TEST_HOST)

    expect(result.CustomField).toEqual([])
  })

  it('merges other selected types alongside a field search', async () => {
    mockEnsureFieldIndex.mockResolvedValue(undefined)
    mockEnsureMetadataIndex.mockResolvedValue(undefined)
    mockHasSearchIndex.mockReturnValue(true)
    mockSearchIndex.mockImplementation((_q, indexKey) => {
      if (indexKey === 'Field:Account') return [fieldResult]
      if (indexKey === 'ApexClass') return [{ id: '01p', name: 'AccountController', type: 'ApexClass', description: '' }]
      return []
    })

    const result = await searchSalesforceMetadata('Account.Name', ['CustomField', 'ApexClass'], TEST_HOST)

    expect(result.CustomField).toEqual([fieldResult])
    expect(result.ApexClass).toHaveLength(1)
    expect(mockEnsureMetadataIndex).toHaveBeenCalledWith('ApexClass', TEST_HOST)
  })
})

describe('search-orchestrator / dot-notation CMDT search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue(SESSION)
  })

  it('returns CMDT record results for "Foo__mdt.Bar"', async () => {
    const cmdtResult: SearchResult = { id: 'm01', name: 'Bar', type: 'CustomMetadataType', description: '' }
    mockEnsureCMDTRecordIndex.mockResolvedValue(undefined)
    mockHasSearchIndex.mockReturnValue(true)
    mockSearchIndex.mockReturnValue([cmdtResult])

    const result = await searchSalesforceMetadata('Foo__mdt.Bar', ['CustomMetadataType'], TEST_HOST)

    expect(mockEnsureCMDTRecordIndex).toHaveBeenCalledWith('Foo__mdt', TEST_HOST)
    expect(mockHasSearchIndex).toHaveBeenCalledWith('CMDTRecord:Foo__mdt', TEST_HOST)
    expect(mockSearchIndex).toHaveBeenCalledWith('Bar', 'CMDTRecord:Foo__mdt', TEST_HOST, {
      useFuzzy: true,
      hideManagedPackage: true
    })
    expect(result.CustomMetadataType).toEqual([cmdtResult])
  })

  it('returns [] for CMDT when the record index is missing', async () => {
    mockEnsureCMDTRecordIndex.mockResolvedValue(undefined)
    mockHasSearchIndex.mockReturnValue(false)

    const result = await searchSalesforceMetadata('Foo__mdt.Bar', ['CustomMetadataType'], TEST_HOST)

    expect(result.CustomMetadataType).toEqual([])
  })

  it('returns [] for CMDT when ensureCMDTRecordIndex throws', async () => {
    mockEnsureCMDTRecordIndex.mockRejectedValue(new Error('boom'))

    const result = await searchSalesforceMetadata('Foo__mdt.Bar', ['CustomMetadataType'], TEST_HOST)

    expect(result.CustomMetadataType).toEqual([])
  })
})

describe('search-orchestrator / dot-notation custom setting search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue(SESSION)
  })

  it('returns custom-setting record results when object is a known custom setting', async () => {
    const csHost = 'cs-known.my.salesforce.com'
    mockGetSession.mockResolvedValue({ key: 'k', hostname: csHost })
    mockEnsureMetadataIndex.mockResolvedValue(undefined)
    // checkIsCustomSetting reads the CustomSetting index for QualifiedApiName
    mockSearchIndex.mockImplementation((_q, indexKey) => {
      if (indexKey === 'CustomSetting') {
        return [{ id: 'cs1', name: 'MySetting__c', type: 'CustomSetting', description: '', metadata: { QualifiedApiName: 'MySetting__c' } }]
      }
      if (indexKey === 'CustomSettingRecord:MySetting__c') {
        return [{ id: 'rec1', name: 'Default', type: 'CustomSetting', description: '' }]
      }
      return []
    })
    mockHasSearchIndex.mockReturnValue(true)

    const result = await searchSalesforceMetadata('MySetting__c.Default', ['CustomSetting'], csHost)

    expect(mockHasSearchIndex).toHaveBeenCalledWith('CustomSettingRecord:MySetting__c', csHost)
    expect(result.CustomSetting).toEqual([{ id: 'rec1', name: 'Default', type: 'CustomSetting', description: '' }])
  })

  it('falls through to normal search when object is not a custom setting', async () => {
    const csHost = 'cs-unknown.my.salesforce.com'
    mockGetSession.mockResolvedValue({ key: 'k', hostname: csHost })
    mockEnsureMetadataIndex.mockResolvedValue(undefined)
    mockSearchIndex.mockImplementation((_q, indexKey) => {
      if (indexKey === 'CustomSetting') return []
      return []
    })

    const result = await searchSalesforceMetadata('NotASetting__c.Field', ['CustomSetting'], csHost)

    // Not a custom setting -> handleDotNotationSearch returns null -> normal cached search runs for CustomSetting type
    expect(result.CustomSetting).toEqual([])
  })
})

describe('search-orchestrator / dot-notation profile search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue(SESSION)
  })

  it('returns a profile submenu when no sub-category is given', async () => {
    const submenu: SearchResult[] = [{ id: 'p1', name: 'Users', type: 'Profile', description: '' }]
    mockParseProfileDotNotation.mockReturnValue({ profileId: 'p1', profileName: 'System Administrator', subCategory: null, filter: null })
    mockBuildProfileSubMenu.mockReturnValue(submenu)
    mockSearchIndex.mockReturnValue([])

    const result = await searchSalesforceMetadata('System Administrator.', ['Profile'], TEST_HOST)

    expect(mockBuildProfileSubMenu).toHaveBeenCalledWith('p1', 'System Administrator')
    expect(result.Profile).toEqual(submenu)
  })

  it('dispatches a profile sub-data query for the Users sub-category', async () => {
    mockParseProfileDotNotation.mockReturnValue({ profileId: 'p1', profileName: 'System Administrator', subCategory: 'Users', filter: null })
    mockQueryProfileUsers.mockResolvedValue([{ id: 'u1', name: 'Dormon', type: 'User', description: '' }])
    mockSearchIndex.mockReturnValue([])

    const result = await searchSalesforceMetadata('System Administrator.Users', ['Profile'], TEST_HOST)

    expect(mockQueryProfileUsers).toHaveBeenCalledWith('p1', TEST_HOST, 'k')
    expect(result.Profile).toHaveLength(1)
    expect(result.Profile[0]).toMatchObject({ id: 'u1', type: 'User' })
  })
})

describe('search-orchestrator / cached metadata-type search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue(SESSION)
  })

  it('returns mapped results from the cached ApexClass index', async () => {
    const apexResult: SearchResult = { id: '01p000000000001', name: 'WeatherService', type: 'ApexClass', description: '' }
    mockEnsureMetadataIndex.mockResolvedValue(undefined)
    mockSearchIndex.mockReturnValue([apexResult])

    const result = await searchSalesforceMetadata('weather', ['ApexClass'], TEST_HOST)

    expect(mockEnsureMetadataIndex).toHaveBeenCalledWith('ApexClass', TEST_HOST)
    expect(mockSearchIndex).toHaveBeenCalledWith('weather', 'ApexClass', TEST_HOST, {
      useFuzzy: true,
      hideManagedPackage: true
    })
    expect(result.ApexClass).toEqual([apexResult])
  })

  it('returns [] for a cached type when ensureMetadataIndex throws', async () => {
    mockEnsureMetadataIndex.mockRejectedValue(new Error('boom'))

    const result = await searchSalesforceMetadata('weather', ['ApexClass'], TEST_HOST)

    expect(result.ApexClass).toEqual([])
  })

  it('honors useFuzzy=false option passed through to searchIndex', async () => {
    mockEnsureMetadataIndex.mockResolvedValue(undefined)
    mockSearchIndex.mockReturnValue([])

    await searchSalesforceMetadata('weather', ['ApexClass'], TEST_HOST, { useFuzzy: false })

    expect(mockSearchIndex).toHaveBeenCalledWith('weather', 'ApexClass', TEST_HOST, {
      useFuzzy: false,
      hideManagedPackage: true
    })
  })
})
