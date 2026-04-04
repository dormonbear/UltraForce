import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  parseProfileDotNotation,
  buildProfileSubMenu,
  queryProfileUsers,
  queryProfileObjectPermissions,
  queryProfileFieldPermissions,
  queryProfileCustomPermissions,
  queryProfileApexClassAccess,
  queryProfileVFPageAccess,
  queryProfileConnectedApps,
  queryProfileAssignedApps,
  clearPermissionSetIdCache,
  filterProfileSubData
} from './profile-search'
import type { SearchResult } from '~types'

describe('parseProfileDotNotation', () => {
  const cachedProfiles = [
    { id: '00e000000000001', name: 'System Administrator' },
    { id: '00e000000000002', name: 'Standard User' },
    { id: '00e000000000003', name: 'Custom: Sales Profile' }
  ]

  it('should return null for query without dot', () => {
    expect(parseProfileDotNotation('System Administrator', cachedProfiles)).toBeNull()
  })

  it('should return null if name does not match any cached profile', () => {
    expect(parseProfileDotNotation('Account.', cachedProfiles)).toBeNull()
  })

  it('should parse single dot (sub-menu level)', () => {
    const result = parseProfileDotNotation('System Administrator.', cachedProfiles)
    expect(result).toEqual({
      profileId: '00e000000000001',
      profileName: 'System Administrator',
      subCategory: '',
      filter: ''
    })
  })

  it('should parse sub-category with trailing dot (sub-data level)', () => {
    const result = parseProfileDotNotation('System Administrator.Users.', cachedProfiles)
    expect(result).toEqual({
      profileId: '00e000000000001',
      profileName: 'System Administrator',
      subCategory: 'Users',
      filter: ''
    })
  })

  it('should parse sub-category with filter', () => {
    const result = parseProfileDotNotation('System Administrator.Users.john', cachedProfiles)
    expect(result).toEqual({
      profileId: '00e000000000001',
      profileName: 'System Administrator',
      subCategory: 'Users',
      filter: 'john'
    })
  })

  it('should match profile name case-insensitively', () => {
    const result = parseProfileDotNotation('system administrator.', cachedProfiles)
    expect(result).toEqual({
      profileId: '00e000000000001',
      profileName: 'System Administrator',
      subCategory: '',
      filter: ''
    })
  })

  it('should handle profile names with special characters', () => {
    const result = parseProfileDotNotation('Custom: Sales Profile.', cachedProfiles)
    expect(result).toEqual({
      profileId: '00e000000000003',
      profileName: 'Custom: Sales Profile',
      subCategory: '',
      filter: ''
    })
  })

  it('should parse ObjectPermissions sub-category', () => {
    const result = parseProfileDotNotation('Standard User.ObjectPermissions.', cachedProfiles)
    expect(result).toEqual({
      profileId: '00e000000000002',
      profileName: 'Standard User',
      subCategory: 'ObjectPermissions',
      filter: ''
    })
  })

  it('should parse FieldPermissions sub-category with filter', () => {
    const result = parseProfileDotNotation('Standard User.FieldPermissions.Account', cachedProfiles)
    expect(result).toEqual({
      profileId: '00e000000000002',
      profileName: 'Standard User',
      subCategory: 'FieldPermissions',
      filter: 'Account'
    })
  })

  it('should return null for empty string', () => {
    expect(parseProfileDotNotation('', cachedProfiles)).toBeNull()
  })

  it('should return null for dot-only query', () => {
    expect(parseProfileDotNotation('.', cachedProfiles)).toBeNull()
  })
})

describe('buildProfileSubMenu', () => {
  it('should return 11 sub-menu items', () => {
    const items = buildProfileSubMenu('00e000000000001', 'System Administrator')
    expect(items).toHaveLength(11)
  })

  it('should include all sub-menu items', () => {
    const items = buildProfileSubMenu('00e000000000001', 'System Administrator')
    const names = items.map((i) => i.name)
    expect(names).toContain('Users')
    expect(names).toContain('Object Permissions')
    expect(names).toContain('Field Permissions')
    expect(names).toContain('Custom Permissions')
    expect(names).toContain('Apex Class Access')
    expect(names).toContain('VF Page Access')
    expect(names).toContain('Connected Apps')
    expect(names).toContain('Assigned Apps')
    expect(names).toContain('System Permissions')
    expect(names).toContain('Login Hours')
    expect(names).toContain('Login IP Ranges')
  })

  it('should set type to ProfileSubMenu for queryable items and ProfileSetupLink for navigate-only items', () => {
    const items = buildProfileSubMenu('00e000000000001', 'System Administrator')
    const subMenuItems = items.filter((i) => i.type === 'ProfileSubMenu')
    const setupLinks = items.filter((i) => i.type === 'ProfileSetupLink')
    expect(subMenuItems).toHaveLength(8)
    expect(setupLinks).toHaveLength(3)
    expect(setupLinks.map((i) => i.name)).toEqual(['System Permissions', 'Login Hours', 'Login IP Ranges'])
  })

  it('should include profileId, profileName, subCategory in metadata', () => {
    const items = buildProfileSubMenu('00e000000000001', 'System Administrator')
    const usersItem = items.find((i) => i.name === 'Users')
    expect(usersItem?.metadata).toEqual({
      profileId: '00e000000000001',
      profileName: 'System Administrator',
      subCategory: 'Users'
    })
  })

  it('should include description for each item', () => {
    const items = buildProfileSubMenu('00e000000000001', 'System Administrator')
    items.forEach((item) => {
      expect(item.description).toBeTruthy()
    })
  })
})

// Mock sfRest for sub-data query tests (profile-search routes through sfRest)
const mockSfRest = vi.fn()

vi.mock('./auth', () => ({
  getSession: vi.fn().mockResolvedValue({ key: 'mock-key', hostname: 'test.my.salesforce.com' }),
  sfRest: (...args: unknown[]) => mockSfRest(...args),
  API_VERSION: '62.0'
}))

vi.mock('./domain-utils', () => ({
  normalizeHost: vi.fn((h: string) => h),
  escapeSoql: vi.fn((s: string) => s)
}))

// Helper: mock sfRest for PermissionSetId + SetupEntityAccess + detail query (3 calls)
function mockSetupEntityAccessFlow(detailRecords: Record<string, unknown>[]) {
  // 1. PermissionSetId query
  mockSfRest.mockResolvedValueOnce({ records: [{ Id: '0PS001' }], done: true })
  // 2. SetupEntityAccess query
  mockSfRest.mockResolvedValueOnce({
    records: detailRecords.map((r) => ({ SetupEntityId: r.Id })),
    done: true
  })
  // 3. Detail query
  mockSfRest.mockResolvedValueOnce({ records: detailRecords, done: true })
}

describe('queryProfileUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSfRest.mockReset()
    clearPermissionSetIdCache()
  })

  it('should return SearchResult[] with type User', async () => {
    mockSfRest.mockResolvedValueOnce({
      records: [
        { Id: '005001', Name: 'John Doe', Username: 'john@test.com', IsActive: true }
      ],
      done: true
    })

    const results = await queryProfileUsers('00e000000000001', 'test.my.salesforce.com', 'session-key')
    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('User')
    expect(results[0].name).toBe('John Doe')
    expect(results[0].id).toBe('005001')
  })

  it('should show Active/Inactive status in description', async () => {
    mockSfRest.mockResolvedValueOnce({
      records: [
        { Id: '005001', Name: 'John Doe', Username: 'john@test.com', IsActive: true },
        { Id: '005002', Name: 'Jane Doe', Username: 'jane@test.com', IsActive: false }
      ],
      done: true
    })

    const results = await queryProfileUsers('00e000000000001', 'test.my.salesforce.com', 'session-key')
    expect(results[0].description).toContain('Active')
    expect(results[1].description).toContain('Inactive')
  })

  it('should return empty array on error', async () => {
    mockSfRest.mockRejectedValueOnce(new Error('Network error'))

    const results = await queryProfileUsers('00e000000000001', 'test.my.salesforce.com', 'session-key')
    expect(results).toEqual([])
  })
})

describe('queryProfileObjectPermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSfRest.mockReset()
    clearPermissionSetIdCache()
  })

  it('should return SearchResult[] with type ObjectPermission', async () => {
    mockSfRest.mockResolvedValueOnce({ records: [{ Id: '0PS001' }], done: true })
    mockSfRest.mockResolvedValueOnce({
      records: [
        {
          Id: 'op001',
          SobjectType: 'Account',
          PermissionsCreate: true,
          PermissionsRead: true,
          PermissionsEdit: true,
          PermissionsDelete: false,
          PermissionsViewAllRecords: false,
          PermissionsModifyAllRecords: false
        }
      ],
      done: true
    })

    const results = await queryProfileObjectPermissions('00e000000000001', 'test.my.salesforce.com', 'session-key')
    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('ObjectPermission')
    expect(results[0].name).toBe('Account')
    expect(results[0].description).toContain('C')
    expect(results[0].description).toContain('R')
    expect(results[0].description).toContain('E')
  })

  it('should return empty array on error', async () => {
    mockSfRest.mockRejectedValueOnce(new Error('Network error'))
    const results = await queryProfileObjectPermissions('00e000000000001', 'test.my.salesforce.com', 'session-key')
    expect(results).toEqual([])
  })

  it('should use DurableId for custom objects in objectRef', async () => {
    mockSfRest.mockResolvedValueOnce({ records: [{ Id: '0PS001' }], done: true })
    mockSfRest.mockResolvedValueOnce({
      records: [{
        Id: 'op002',
        SobjectType: 'MyObj__c',
        PermissionsCreate: true,
        PermissionsRead: true,
        PermissionsEdit: false,
        PermissionsDelete: false,
        PermissionsViewAllRecords: false,
        PermissionsModifyAllRecords: false
      }],
      done: true
    })
    mockSfRest.mockResolvedValueOnce({
      records: [{ QualifiedApiName: 'MyObj__c', DurableId: '01I000000000ABC' }],
      done: true
    })

    const results = await queryProfileObjectPermissions('00e000000000001', 'test.my.salesforce.com', 'session-key')
    expect(results).toHaveLength(1)
    expect(results[0].metadata.objectRef).toBe('01I000000000ABC')
  })

  it('should use API name for standard objects in objectRef', async () => {
    mockSfRest.mockResolvedValueOnce({ records: [{ Id: '0PS001' }], done: true })
    mockSfRest.mockResolvedValueOnce({
      records: [{
        Id: 'op001',
        SobjectType: 'Account',
        PermissionsCreate: true,
        PermissionsRead: true,
        PermissionsEdit: true,
        PermissionsDelete: false,
        PermissionsViewAllRecords: false,
        PermissionsModifyAllRecords: false
      }],
      done: true
    })

    const results = await queryProfileObjectPermissions('00e000000000001', 'test.my.salesforce.com', 'session-key')
    expect(results).toHaveLength(1)
    expect(results[0].metadata.objectRef).toBe('Account')
  })
})

describe('queryProfileFieldPermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSfRest.mockReset()
    clearPermissionSetIdCache()
  })

  it('should return SearchResult[] with type FieldPermission', async () => {
    mockSfRest.mockResolvedValueOnce({ records: [{ Id: '0PS001' }], done: true })
    mockSfRest.mockResolvedValueOnce({
      records: [
        {
          Id: 'fp001',
          SobjectType: 'Account',
          Field: 'Account.Industry',
          PermissionsRead: true,
          PermissionsEdit: false
        }
      ],
      done: true
    })

    const results = await queryProfileFieldPermissions('00e000000000001', 'test.my.salesforce.com', 'session-key')
    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('FieldPermission')
    expect(results[0].name).toBe('Account.Industry')
    expect(results[0].description).toContain('Read')
  })

  it('should return empty array on error', async () => {
    mockSfRest.mockRejectedValueOnce(new Error('Network error'))
    const results = await queryProfileFieldPermissions('00e000000000001', 'test.my.salesforce.com', 'session-key')
    expect(results).toEqual([])
  })

  it('should return empty array when no PermissionSet found', async () => {
    mockSfRest.mockResolvedValueOnce({ records: [], done: true })
    const results = await queryProfileFieldPermissions('00e000000000001', 'test.my.salesforce.com', 'session-key')
    expect(results).toEqual([])
  })
})

describe('queryProfileCustomPermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSfRest.mockReset()
    clearPermissionSetIdCache()
  })

  it('should return SearchResult[] with type CustomPermissionAccess', async () => {
    mockSetupEntityAccessFlow([
      { Id: 'cp001', DeveloperName: 'CanAccessFeatureX', Description: 'Access Feature X' }
    ])

    const results = await queryProfileCustomPermissions('00e000000000001', 'test.my.salesforce.com', 'session-key')
    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('CustomPermissionAccess')
    expect(results[0].name).toBe('CanAccessFeatureX')
    expect(results[0].description).toBe('Access Feature X')
  })

  it('should return empty array when no custom permissions', async () => {
    mockSfRest.mockResolvedValueOnce({ records: [{ Id: '0PS001' }], done: true })
    mockSfRest.mockResolvedValueOnce({ records: [], done: true })

    const results = await queryProfileCustomPermissions('00e000000000001', 'test.my.salesforce.com', 'session-key')
    expect(results).toEqual([])
  })

  it('should return empty array on error', async () => {
    mockSfRest.mockRejectedValueOnce(new Error('Network error'))
    const results = await queryProfileCustomPermissions('00e000000000001', 'test.my.salesforce.com', 'session-key')
    expect(results).toEqual([])
  })
})

describe('queryProfileApexClassAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSfRest.mockReset()
    clearPermissionSetIdCache()
  })

  it('should return SearchResult[] with type ApexClassAccess', async () => {
    mockSetupEntityAccessFlow([
      { Id: 'ac001', Name: 'WeatherService', NamespacePrefix: null }
    ])

    const results = await queryProfileApexClassAccess('00e000000000001', 'test.my.salesforce.com', 'session-key')
    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('ApexClassAccess')
    expect(results[0].name).toBe('WeatherService')
  })

  it('should include namespace prefix in name', async () => {
    mockSetupEntityAccessFlow([
      { Id: 'ac002', Name: 'SomeClass', NamespacePrefix: 'myns' }
    ])

    const results = await queryProfileApexClassAccess('00e000000000001', 'test.my.salesforce.com', 'session-key')
    expect(results[0].name).toBe('myns.SomeClass')
    expect(results[0].description).toContain('myns')
  })

  it('should return empty array on error', async () => {
    mockSfRest.mockRejectedValueOnce(new Error('Network error'))
    const results = await queryProfileApexClassAccess('00e000000000001', 'test.my.salesforce.com', 'session-key')
    expect(results).toEqual([])
  })

  it('should return empty array when no PermissionSet found', async () => {
    mockSfRest.mockResolvedValueOnce({ records: [], done: true })
    const results = await queryProfileApexClassAccess('00e000000000001', 'test.my.salesforce.com', 'session-key')
    expect(results).toEqual([])
  })
})

describe('queryProfileVFPageAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSfRest.mockReset()
    clearPermissionSetIdCache()
  })

  it('should return SearchResult[] with type VFPageAccess', async () => {
    mockSetupEntityAccessFlow([
      { Id: 'vf001', Name: 'MyVisualforcePage', NamespacePrefix: null }
    ])

    const results = await queryProfileVFPageAccess('00e000000000001', 'test.my.salesforce.com', 'session-key')
    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('VFPageAccess')
    expect(results[0].name).toBe('MyVisualforcePage')
  })

  it('should return empty array on error', async () => {
    mockSfRest.mockRejectedValueOnce(new Error('Network error'))
    const results = await queryProfileVFPageAccess('00e000000000001', 'test.my.salesforce.com', 'session-key')
    expect(results).toEqual([])
  })
})

describe('queryProfileConnectedApps', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSfRest.mockReset()
    clearPermissionSetIdCache()
  })

  it('should return SearchResult[] with type ConnectedAppAccess', async () => {
    mockSetupEntityAccessFlow([
      { Id: 'ca001', Name: 'My Connected App' }
    ])

    const results = await queryProfileConnectedApps('00e000000000001', 'test.my.salesforce.com', 'session-key')
    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('ConnectedAppAccess')
    expect(results[0].name).toBe('My Connected App')
  })

  it('should return empty array on error', async () => {
    mockSfRest.mockRejectedValueOnce(new Error('Network error'))
    const results = await queryProfileConnectedApps('00e000000000001', 'test.my.salesforce.com', 'session-key')
    expect(results).toEqual([])
  })
})

describe('queryProfileAssignedApps', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSfRest.mockReset()
    clearPermissionSetIdCache()
  })

  it('should return SearchResult[] with type AssignedAppAccess', async () => {
    mockSetupEntityAccessFlow([
      { Id: 'aa001', Label: 'Sales Console', Name: 'SalesConsole', Type: 'Standard' }
    ])

    const results = await queryProfileAssignedApps('00e000000000001', 'test.my.salesforce.com', 'session-key')
    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('AssignedAppAccess')
    expect(results[0].name).toBe('Sales Console')
    expect(results[0].description).toBe('Standard')
  })

  it('should use Name when Label is missing', async () => {
    mockSetupEntityAccessFlow([
      { Id: 'aa002', Label: null, Name: 'FallbackName', Type: 'Custom' }
    ])

    const results = await queryProfileAssignedApps('00e000000000001', 'test.my.salesforce.com', 'session-key')
    expect(results[0].name).toBe('FallbackName')
  })

  it('should return empty array on error', async () => {
    mockSfRest.mockRejectedValueOnce(new Error('Network error'))
    const results = await queryProfileAssignedApps('00e000000000001', 'test.my.salesforce.com', 'session-key')
    expect(results).toEqual([])
  })
})

describe('filterProfileSubData', () => {
  const sampleResults: SearchResult[] = [
    { id: '1', name: 'Account', type: 'ObjectPermission', description: 'C R E D - -', metadata: {} },
    { id: '2', name: 'Contact', type: 'ObjectPermission', description: 'C R - - - -', metadata: {} },
    { id: '3', name: 'MyObj__c', type: 'ObjectPermission', description: '- R - - - -', metadata: {} }
  ]

  it('should return all results when filter is empty', () => {
    expect(filterProfileSubData(sampleResults, '')).toEqual(sampleResults)
  })

  it('should filter by name case-insensitively', () => {
    const result = filterProfileSubData(sampleResults, 'account')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Account')
  })

  it('should filter by description', () => {
    const result = filterProfileSubData(sampleResults, 'C R E')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Account')
  })

  it('should return empty array when nothing matches', () => {
    expect(filterProfileSubData(sampleResults, 'zzz')).toEqual([])
  })

  it('should not throw on empty results array', () => {
    expect(filterProfileSubData([], 'test')).toEqual([])
  })
})
