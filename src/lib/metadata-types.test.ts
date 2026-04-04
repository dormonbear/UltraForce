import { describe, it, expect } from 'vitest'
import {
  METADATA_TYPES,
  type SearchOptions,
  type SfApexRecord,
  type SfEntityDefinition,
  type SfFieldDefinition,
  type SfFlow,
  type SfUser,
  type SfPermissionSet,
  type SfProfile,
  type SfCustomLabel,
  type SfCustomMetadataType,
  type SfCustomSetting,
  type SfQueue,
  type SfGroup,
  type SfReport,
  type SfDashboard,
  type SfBundleRecord
} from './metadata-types'

describe('METADATA_TYPES', () => {
  const expectedTypes = [
    'ApexClass',
    'ApexTrigger',
    'ApexPage',
    'ApexComponent',
    'LightningComponentBundle',
    'AuraDefinitionBundle',
    'CustomObject',
    'Flow',
    'User',
    'PermissionSet',
    'Profile',
    'CustomLabel',
    'CustomMetadataType',
    'CustomSetting',
    'Queue',
    'Group',
    'Report',
    'Dashboard'
  ]

  it('has exactly 18 entries', () => {
    expect(Object.keys(METADATA_TYPES)).toHaveLength(18)
  })

  it.each(expectedTypes)('has entry for %s', (type) => {
    expect(METADATA_TYPES[type]).toBeDefined()
  })

  it.each(expectedTypes)('%s has a query string starting with SELECT', (type) => {
    const entry = METADATA_TYPES[type]
    expect(typeof entry.query).toBe('string')
    expect(entry.query).toMatch(/^SELECT/)
    expect(entry.query).toContain('FROM')
  })

  it('only has the expected 17 types', () => {
    expect(Object.keys(METADATA_TYPES).sort()).toEqual(expectedTypes.sort())
  })
})

describe('SearchOptions interface', () => {
  it('accepts valid options', () => {
    const options: SearchOptions = { useFuzzy: true, hideManagedPackage: false }
    expect(options.useFuzzy).toBe(true)
    expect(options.hideManagedPackage).toBe(false)
  })

  it('accepts empty options', () => {
    const options: SearchOptions = {}
    expect(options).toBeDefined()
  })
})

describe('Salesforce record interfaces', () => {
  it('SfApexRecord has correct shape', () => {
    const record: SfApexRecord = {
      Id: '001',
      Name: 'TestClass',
      NamespacePrefix: null,
      LastModifiedDate: '2024-01-01',
      LastModifiedBy: { Name: 'Admin' }
    }
    expect(record.Id).toBe('001')
    expect(record.Name).toBe('TestClass')
  })

  it('SfEntityDefinition has correct shape', () => {
    const record: SfEntityDefinition = {
      QualifiedApiName: 'Account',
      Label: 'Account',
      DurableId: 'Account',
      KeyPrefix: '001'
    }
    expect(record.QualifiedApiName).toBe('Account')
  })

  it('SfFieldDefinition has correct shape', () => {
    const record: SfFieldDefinition = {
      DurableId: 'Account.Name',
      QualifiedApiName: 'Name',
      Label: 'Account Name',
      DataType: 'Text',
      EntityDefinition: { QualifiedApiName: 'Account' },
      NamespacePrefix: null
    }
    expect(record.Label).toBe('Account Name')
  })

  it('SfFlow has correct shape', () => {
    const record: SfFlow = {
      Id: '301',
      MasterLabel: 'My Flow',
      VersionNumber: 1,
      Status: 'Active'
    }
    expect(record.MasterLabel).toBe('My Flow')
  })

  it('SfUser has correct shape', () => {
    const record: SfUser = {
      Id: '005',
      Name: 'Test User',
      Username: 'test@example.com',
      Email: 'test@example.com',
      FederationIdentifier: null,
      IsActive: true,
      Profile: { Name: 'System Administrator' },
      UserRole: null
    }
    expect(record.Username).toBe('test@example.com')
  })

  it('SfPermissionSet has correct shape', () => {
    const record: SfPermissionSet = {
      Id: '0PS',
      Name: 'TestPS',
      Label: 'Test Permission Set',
      NamespacePrefix: null
    }
    expect(record.Label).toBe('Test Permission Set')
  })

  it('SfProfile has correct shape', () => {
    const record: SfProfile = {
      Id: '00e',
      Name: 'System Administrator'
    }
    expect(record.Name).toBe('System Administrator')
  })

  it('SfBundleRecord has correct shape', () => {
    const record: SfBundleRecord = {
      Id: '0Ab',
      DeveloperName: 'myComponent',
      NamespacePrefix: null,
      MasterLabel: 'My Component',
      LastModifiedDate: '2024-01-01',
      LastModifiedBy: { Name: 'Admin' }
    }
    expect(record.DeveloperName).toBe('myComponent')
  })

  it('SfCustomLabel has correct shape', () => {
    const record: SfCustomLabel = {
      Id: '101',
      Name: 'MyLabel',
      MasterLabel: 'My Label',
      Value: 'Hello',
      NamespacePrefix: null
    }
    expect(record.Value).toBe('Hello')
  })

  it('SfCustomMetadataType has correct shape', () => {
    const record: SfCustomMetadataType = {
      DurableId: 'My_Setting__mdt',
      QualifiedApiName: 'My_Setting__mdt',
      Label: 'My Setting',
      NamespacePrefix: null
    }
    expect(record.QualifiedApiName).toBe('My_Setting__mdt')
  })

  it('SfCustomSetting has correct shape', () => {
    const record: SfCustomSetting = {
      DurableId: 'My_Setting__c',
      QualifiedApiName: 'My_Setting__c',
      DeveloperName: 'My_Setting',
      Label: 'My Setting',
      NamespacePrefix: null
    }
    expect(record.DeveloperName).toBe('My_Setting')
  })

  it('SfQueue has correct shape', () => {
    const record: SfQueue = {
      Id: '00G',
      Name: 'Support Queue',
      DeveloperName: 'Support_Queue',
      Email: 'support@example.com'
    }
    expect(record.DeveloperName).toBe('Support_Queue')
  })

  it('SfGroup has correct shape', () => {
    const record: SfGroup = {
      Id: '00G',
      Name: 'Test Group',
      DeveloperName: 'Test_Group'
    }
    expect(record.Name).toBe('Test Group')
  })

  it('SfReport has correct shape', () => {
    const record: SfReport = {
      Id: '00O',
      Name: 'My Report',
      DeveloperName: 'My_Report',
      NamespacePrefix: null,
      FolderName: 'Public Reports',
      Description: 'A report',
      LastModifiedDate: '2024-01-01',
      LastModifiedBy: { Name: 'Admin' }
    }
    expect(record.FolderName).toBe('Public Reports')
  })

  it('SfDashboard has correct shape', () => {
    const record: SfDashboard = {
      Id: '01Z',
      Title: 'My Dashboard',
      DeveloperName: 'My_Dashboard',
      NamespacePrefix: null,
      FolderName: 'Public Dashboards',
      Description: 'A dashboard',
      LastModifiedDate: '2024-01-01',
      LastModifiedBy: { Name: 'Admin' }
    }
    expect(record.Title).toBe('My Dashboard')
  })
})
