import {
  buildSearchIndex,
  searchIndex,
  parseSearchQuery,
  clearSearchIndex,
  clearAllSearchIndexes,
  hasSearchIndex
} from './fuzzy-search'

const SF_HOST = 'test.my.salesforce.com'

function makeApexRecords(names: string[]) {
  return names.map((name, i) => ({
    Id: `01p${String(i).padStart(12, '0')}`,
    Name: name,
    NamespacePrefix: null
  }))
}

function makeCustomObjectRecords(items: Array<{ label: string; apiName: string }>) {
  return items.map((item, i) => ({
    Id: `01I${String(i).padStart(12, '0')}`,
    Label: item.label,
    QualifiedApiName: item.apiName,
    NamespacePrefix: null
  }))
}

describe('parseSearchQuery', () => {
  it('should parse plain query', () => {
    const result = parseSearchQuery('AccountService')
    expect(result).toEqual({
      searchTerm: 'AccountService',
      filterTerm: null,
      isExactMatch: false
    })
  })

  it('should trim whitespace', () => {
    const result = parseSearchQuery('  Account  ')
    expect(result.searchTerm).toBe('Account')
  })

  it('should parse pipe filter', () => {
    const result = parseSearchQuery('Account | test')
    expect(result.searchTerm).toBe('Account')
    expect(result.filterTerm).toBe('test')
  })

  it('should handle empty filter after pipe', () => {
    const result = parseSearchQuery('Account |  ')
    expect(result.searchTerm).toBe('Account')
    expect(result.filterTerm).toBeNull()
  })

  it('should parse exact match with double quotes', () => {
    const result = parseSearchQuery('"AccountService"')
    expect(result.searchTerm).toBe('AccountService')
    expect(result.isExactMatch).toBe(true)
  })

  it('should not treat single quotes as exact match', () => {
    const result = parseSearchQuery("'test'")
    expect(result.isExactMatch).toBe(false)
  })

  it('should not treat short quoted string as exact match', () => {
    const result = parseSearchQuery('""')
    expect(result.isExactMatch).toBe(false)
  })

  it('should combine exact match with filter', () => {
    const result = parseSearchQuery('"AccountService" | controller')
    expect(result.searchTerm).toBe('AccountService')
    expect(result.isExactMatch).toBe(true)
    expect(result.filterTerm).toBe('controller')
  })
})

describe('buildSearchIndex and hasSearchIndex', () => {
  afterEach(() => {
    clearAllSearchIndexes()
  })

  it('should create an index for a metadata type', () => {
    const records = makeApexRecords(['AccountService', 'ContactHelper'])
    buildSearchIndex('ApexClass', records, SF_HOST)
    expect(hasSearchIndex('ApexClass', SF_HOST)).toBe(true)
  })

  it('should not have index before building', () => {
    expect(hasSearchIndex('ApexClass', SF_HOST)).toBe(false)
  })

  it('should deduplicate records with the same ID', () => {
    const records = [
      { Id: '01p001', Name: 'Duplicate' },
      { Id: '01p001', Name: 'Duplicate' }
    ]
    buildSearchIndex('ApexClass', records, SF_HOST)
    const results = searchIndex('', 'ApexClass', SF_HOST)
    expect(results).toHaveLength(1)
  })

  it('should index custom object records', () => {
    const records = makeCustomObjectRecords([
      { label: 'Account', apiName: 'Account' },
      { label: 'My Custom Object', apiName: 'My_Custom_Object__c' }
    ])
    buildSearchIndex('CustomObject', records, SF_HOST)
    expect(hasSearchIndex('CustomObject', SF_HOST)).toBe(true)
  })

  it('should index Flow records', () => {
    const records = [
      { Id: '301001', MasterLabel: 'Create Case', VersionNumber: 1, Status: 'Active' }
    ]
    buildSearchIndex('Flow', records, SF_HOST)
    const results = searchIndex('', 'Flow', SF_HOST)
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('Create Case')
  })

  it('should index User records with email and username', () => {
    const records = [
      { Id: '005001', Name: 'John Doe', Email: 'john@test.com', Username: 'john@test.com.dev' }
    ]
    buildSearchIndex('User', records, SF_HOST)
    const results = searchIndex('john', 'User', SF_HOST)
    expect(results.length).toBeGreaterThan(0)
  })

  it('should index PermissionSet records', () => {
    const records = [
      { Id: '0PS001', Label: 'Admin Access', Name: 'Admin_Access' }
    ]
    buildSearchIndex('PermissionSet', records, SF_HOST)
    const results = searchIndex('admin', 'PermissionSet', SF_HOST)
    expect(results.length).toBeGreaterThan(0)
  })

  it('should index Profile records', () => {
    const records = [{ Id: '00e001', Name: 'System Administrator' }]
    buildSearchIndex('Profile', records, SF_HOST)
    const results = searchIndex('system', 'Profile', SF_HOST)
    expect(results.length).toBeGreaterThan(0)
  })

  it('should index CustomLabel records', () => {
    const records = [
      { Id: '101001', MasterLabel: 'Error Message', Name: 'Error_Msg', Value: 'Something went wrong' }
    ]
    buildSearchIndex('CustomLabel', records, SF_HOST)
    const results = searchIndex('error', 'CustomLabel', SF_HOST)
    expect(results.length).toBeGreaterThan(0)
  })

  it('should index LightningComponentBundle records', () => {
    const records = [
      { Id: 'lcb001', MasterLabel: 'MyComponent', DeveloperName: 'myComponent' }
    ]
    buildSearchIndex('LightningComponentBundle', records, SF_HOST)
    const results = searchIndex('component', 'LightningComponentBundle', SF_HOST)
    expect(results.length).toBeGreaterThan(0)
  })

  it('should index Field records with dot-notation IDs', () => {
    const records = [
      { ObjectApiName: 'Account', QualifiedApiName: 'Name', MasterLabel: 'Account Name', DataType: 'Text' }
    ]
    buildSearchIndex('Field:Account', records, SF_HOST)
    const results = searchIndex('', 'Field:Account', SF_HOST)
    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('CustomField')
  })

  it('should index CMDTRecord records', () => {
    const records = [
      { DeveloperName: 'MyRecord', MasterLabel: 'My Record', _parentLabel: 'My_Setting__mdt', _parentType: 'My_Setting__mdt' }
    ]
    buildSearchIndex('CMDTRecord:My_Setting__mdt', records, SF_HOST)
    const results = searchIndex('', 'CMDTRecord:My_Setting__mdt', SF_HOST)
    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('CustomMetadataType')
  })

  it('should index CustomSettingRecord records', () => {
    const records = [
      { Id: 'a00001', Name: 'TestSetting', _parentLabel: 'My_Setting__c', _parentType: 'My_Setting__c' }
    ]
    buildSearchIndex('CustomSettingRecord:My_Setting__c', records, SF_HOST)
    const results = searchIndex('', 'CustomSettingRecord:My_Setting__c', SF_HOST)
    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('CustomSetting')
  })

  it('should index CustomMetadataType definition records', () => {
    const records = [
      { DeveloperName: 'MyType', MasterLabel: 'My Type', QualifiedApiName: 'MyType__mdt', _isTypeDefinition: true }
    ]
    buildSearchIndex('CustomMetadataType', records, SF_HOST)
    const results = searchIndex('', 'CustomMetadataType', SF_HOST)
    expect(results).toHaveLength(1)
  })

  it('should index CustomSetting definition records', () => {
    const records = [
      { Label: 'My Setting', QualifiedApiName: 'My_Setting__c', DeveloperName: 'My_Setting' }
    ]
    buildSearchIndex('CustomSetting', records, SF_HOST)
    const results = searchIndex('', 'CustomSetting', SF_HOST)
    expect(results).toHaveLength(1)
  })

  it('should index Report records', () => {
    const records = [{ Id: '00O001', Name: 'Revenue Report', DeveloperName: 'Rev_Report', FolderName: 'Finance' }]
    buildSearchIndex('Report', records, SF_HOST)
    const results = searchIndex('revenue', 'Report', SF_HOST)
    expect(results.length).toBeGreaterThan(0)
  })

  it('should index Dashboard records', () => {
    const records = [{ Id: '01Z001', Title: 'Sales Dashboard', DeveloperName: 'Sales_Dashboard', FolderName: 'Sales' }]
    buildSearchIndex('Dashboard', records, SF_HOST)
    const results = searchIndex('sales', 'Dashboard', SF_HOST)
    expect(results.length).toBeGreaterThan(0)
  })

  it('should index unknown type records using Name fallback', () => {
    const records = [{ Id: 'xxx001', Name: 'Something' }]
    buildSearchIndex('SomeNewType', records, SF_HOST)
    const results = searchIndex('something', 'SomeNewType', SF_HOST)
    expect(results.length).toBeGreaterThan(0)
  })
})

describe('searchIndex', () => {
  beforeEach(() => {
    clearAllSearchIndexes()
    const records = [
      ...makeApexRecords(['AccountService', 'AccountController', 'ContactHelper', 'OpportunityBatch']),
      { Id: '01p100', Name: 'ManagedPkgClass', NamespacePrefix: 'ns1' }
    ]
    buildSearchIndex('ApexClass', records, SF_HOST)
  })

  afterEach(() => {
    clearAllSearchIndexes()
  })

  it('should return empty array for missing index', () => {
    expect(searchIndex('test', 'Flow', SF_HOST)).toEqual([])
  })

  it('should return all records for empty query', () => {
    const results = searchIndex('', 'ApexClass', SF_HOST)
    expect(results).toHaveLength(4) // 5 records minus 1 managed package (hidden by default)
  })

  it('should include managed packages when hideManagedPackage is false', () => {
    const results = searchIndex('', 'ApexClass', SF_HOST, { useFuzzy: true, hideManagedPackage: false })
    expect(results).toHaveLength(5)
  })

  it('should find records with fuzzy search', () => {
    const results = searchIndex('account', 'ApexClass', SF_HOST)
    expect(results.length).toBeGreaterThanOrEqual(2)
    expect(results.some(r => r.name === 'AccountService')).toBe(true)
    expect(results.some(r => r.name === 'AccountController')).toBe(true)
  })

  it('should work with exact match query', () => {
    const results = searchIndex('"AccountService"', 'ApexClass', SF_HOST)
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('AccountService')
  })

  it('should return empty for exact match with no match', () => {
    const results = searchIndex('"NonExistent"', 'ApexClass', SF_HOST)
    expect(results).toHaveLength(0)
  })

  it('should boost exact API name matches', () => {
    const results = searchIndex('AccountService', 'ApexClass', SF_HOST)
    expect(results[0].name).toBe('AccountService')
  })

  it('should work with useFuzzy false (boolean option)', () => {
    const results = searchIndex('account', 'ApexClass', SF_HOST, false)
    expect(results.length).toBeGreaterThan(0)
  })

  it('should apply post-filter with pipe', () => {
    const results = searchIndex('Account | service', 'ApexClass', SF_HOST)
    expect(results.every(r => r.name.toLowerCase().includes('service'))).toBe(true)
  })

  it('should apply filter on empty search term', () => {
    const results = searchIndex(' | controller', 'ApexClass', SF_HOST)
    expect(results.every(r => r.name.toLowerCase().includes('controller'))).toBe(true)
  })

  it('should hide managed packages by default', () => {
    const results = searchIndex('', 'ApexClass', SF_HOST)
    expect(results.some(r => r.namespace === 'ns1')).toBe(false)
  })
})

describe('clearSearchIndex', () => {
  it('should remove specific index', () => {
    buildSearchIndex('ApexClass', makeApexRecords(['Test']), SF_HOST)
    expect(hasSearchIndex('ApexClass', SF_HOST)).toBe(true)
    clearSearchIndex('ApexClass', SF_HOST)
    expect(hasSearchIndex('ApexClass', SF_HOST)).toBe(false)
  })
})

describe('clearAllSearchIndexes', () => {
  it('should remove all indexes', () => {
    buildSearchIndex('ApexClass', makeApexRecords(['Test']), SF_HOST)
    buildSearchIndex('Flow', [{ Id: '301001', MasterLabel: 'Flow1' }], SF_HOST)
    clearAllSearchIndexes()
    expect(hasSearchIndex('ApexClass', SF_HOST)).toBe(false)
    expect(hasSearchIndex('Flow', SF_HOST)).toBe(false)
  })
})

describe('toSearchResult formatting', () => {
  afterEach(() => clearAllSearchIndexes())

  it('should format User result with profile and role', () => {
    const records = [{
      Id: '005001',
      Name: 'John Doe',
      Email: 'john@test.com',
      Username: 'john@test.com.dev',
      Profile: { Name: 'System Administrator' },
      UserRole: { Name: 'CEO' },
      IsActive: true
    }]
    buildSearchIndex('User', records, SF_HOST)
    const results = searchIndex('john', 'User', SF_HOST)
    expect(results[0].description).toContain('john@test.com.dev')
    expect(results[0].description).toContain('System Administrator')
    expect(results[0].description).toContain('CEO')
  })

  it('should mark inactive users', () => {
    const records = [{
      Id: '005001',
      Name: 'Old User',
      Username: 'old@test.com.dev',
      IsActive: false
    }]
    buildSearchIndex('User', records, SF_HOST)
    const results = searchIndex('old', 'User', SF_HOST)
    expect(results[0].description).toContain('Inactive')
  })

  it('should truncate long CustomLabel values', () => {
    const longValue = 'x'.repeat(100)
    const records = [{ Id: '101001', MasterLabel: 'Long Label', Name: 'Long_Label', Value: longValue }]
    buildSearchIndex('CustomLabel', records, SF_HOST)
    const results = searchIndex('', 'CustomLabel', SF_HOST)
    expect(results[0].description!.length).toBeLessThan(100)
    expect(results[0].description!.endsWith('...')).toBe(true)
  })

  it('should format Report with folder and modifier', () => {
    const records = [{
      Id: '00O001',
      Name: 'Revenue Report',
      DeveloperName: 'Rev',
      FolderName: 'Finance',
      LastModifiedBy: { Name: 'Admin' }
    }]
    buildSearchIndex('Report', records, SF_HOST)
    const results = searchIndex('', 'Report', SF_HOST)
    expect(results[0].description).toContain('Finance')
    expect(results[0].description).toContain('Admin')
  })

  it('should show QualifiedApiName for CustomObject when different from Label', () => {
    const records = [{ Id: '01I001', Label: 'My Object', QualifiedApiName: 'My_Object__c' }]
    buildSearchIndex('CustomObject', records, SF_HOST)
    const results = searchIndex('', 'CustomObject', SF_HOST)
    expect(results[0].description).toBe('My_Object__c')
  })

  it('should not show description for CustomObject when Label equals ApiName', () => {
    const records = [{ Id: '01I001', Label: 'Account', QualifiedApiName: 'Account' }]
    buildSearchIndex('CustomObject', records, SF_HOST)
    const results = searchIndex('', 'CustomObject', SF_HOST)
    expect(results[0].description).toBeUndefined()
  })
})
