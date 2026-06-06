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
import { fetchAllPages } from './metadata-fetcher'

const mockGetSession = vi.mocked(getSession)
const mockFetchAllPages = vi.mocked(fetchAllPages)
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
