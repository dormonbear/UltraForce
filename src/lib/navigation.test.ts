import type { SearchResult } from '~types'
import { buildNavigationUrl, buildIdNavigationUrl, buildActionUrl, KEY_PREFIX_MAP } from './navigation'
import type { NavigationContext } from './navigation'

const lightningCtx: NavigationContext = {
  sfHost: 'test.my.salesforce.com',
  navigationMode: 'lightning',
  userLightningPreference: true
}

const classicCtx: NavigationContext = {
  sfHost: 'test.my.salesforce.com',
  navigationMode: 'classic',
  userLightningPreference: false
}

function makeResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: '001xx000003ABCD',
    name: 'Test',
    type: 'ApexClass',
    ...overrides
  }
}

describe('KEY_PREFIX_MAP', () => {
  it('should map common Salesforce key prefixes', () => {
    expect(KEY_PREFIX_MAP['001']).toBe('Account')
    expect(KEY_PREFIX_MAP['003']).toBe('Contact')
    expect(KEY_PREFIX_MAP['005']).toBe('User')
    expect(KEY_PREFIX_MAP['500']).toBe('Case')
  })
})

describe('buildNavigationUrl', () => {
  describe('setup shortcuts', () => {
    it('should return absolute url for SetupShortcut results', () => {
      const result = makeResult({ type: 'SetupShortcut', url: 'https://example.com/setup' })
      expect(buildNavigationUrl(result, lightningCtx)).toBe('https://example.com/setup')
    })
  })

  describe('null guards', () => {
    it('should return null when sfHost is null', () => {
      const ctx = { ...lightningCtx, sfHost: null }
      expect(buildNavigationUrl(makeResult(), ctx)).toBeNull()
    })

    it('should return null when result has no id', () => {
      const result = makeResult({ id: '' })
      expect(buildNavigationUrl(result, lightningCtx)).toBeNull()
    })
  })

  describe('Lightning URLs', () => {
    it('should build ApexClass url', () => {
      const result = makeResult({ type: 'ApexClass', id: '01pxxx' })
      const url = buildNavigationUrl(result, lightningCtx)
      expect(url).toBe('https://test.my.salesforce.com/lightning/setup/ApexClasses/page?address=%2F01pxxx')
    })

    it('should build ApexTrigger url', () => {
      const result = makeResult({ type: 'ApexTrigger', id: '01qxxx' })
      const url = buildNavigationUrl(result, lightningCtx)
      expect(url).toContain('ApexTriggers')
    })

    it('should build Flow url', () => {
      const result = makeResult({ type: 'Flow', id: '301xxx' })
      const url = buildNavigationUrl(result, lightningCtx)
      expect(url).toContain('flowBuilder.app?flowId=301xxx')
    })

    it('should build CustomObject list url', () => {
      const result = makeResult({
        type: 'CustomObject',
        id: '01Ixxx',
        metadata: { QualifiedApiName: 'Account' }
      })
      const url = buildNavigationUrl(result, lightningCtx)
      expect(url).toBe('https://test.my.salesforce.com/lightning/o/Account/list')
    })

    it('should build CustomField url with ObjectManager path', () => {
      const result = makeResult({
        type: 'CustomField',
        id: '00Nxxx',
        metadata: { ObjectApiName: 'Account', DurableId: 'Account.00Nxxx' }
      })
      const url = buildNavigationUrl(result, lightningCtx)
      expect(url).toContain('ObjectManager/Account/FieldsAndRelationships/00Nxxx/view')
    })

    it('should build PermissionSet url', () => {
      const result = makeResult({ type: 'PermissionSet', id: '0PSxxx' })
      const url = buildNavigationUrl(result, lightningCtx)
      expect(url).toContain('PermSets')
    })

    it('should build Profile url', () => {
      const result = makeResult({ type: 'Profile', id: '00exxx' })
      const url = buildNavigationUrl(result, lightningCtx)
      expect(url).toContain('EnhancedProfiles')
    })

    it('should return null for ProfileSubMenu (tab-only)', () => {
      const result = makeResult({ type: 'ProfileSubMenu' })
      expect(buildNavigationUrl(result, lightningCtx)).toBeNull()
    })

    it('should build CustomLabel url', () => {
      const result = makeResult({ type: 'CustomLabel', id: '101xxx' })
      const url = buildNavigationUrl(result, lightningCtx)
      expect(url).toContain('ExternalStrings')
    })

    it('should build User url via setup host', () => {
      const result = makeResult({ type: 'User', id: '005xxx' })
      const url = buildNavigationUrl(result, lightningCtx)
      expect(url).toContain('ManageUsers')
      expect(url).toContain('005xxx')
    })

    it('should build Queue url', () => {
      const result = makeResult({ type: 'Queue', id: '00Gxxx' })
      const url = buildNavigationUrl(result, lightningCtx)
      expect(url).toContain('Queues')
    })

    it('should build Report url', () => {
      const result = makeResult({ type: 'Report', id: '00Oxxx' })
      const url = buildNavigationUrl(result, lightningCtx)
      expect(url).toContain('/lightning/r/Report/00Oxxx/view')
    })

    it('should build default Lightning url for unknown types', () => {
      const result = makeResult({ type: 'SomeNewType' as any, id: 'xxx123' })
      const url = buildNavigationUrl(result, lightningCtx)
      expect(url).toContain('/lightning/r/SomeNewType/xxx123/view')
    })

    it('should build ObjectPermission url with profile and object', () => {
      const result = makeResult({
        type: 'ObjectPermission',
        id: '0PP001',
        metadata: { profileId: '00e001', objectRef: 'Account' }
      })
      const url = buildNavigationUrl(result, lightningCtx)
      expect(url).toContain('Profiles/page')
      expect(url).toContain('ObjectsAndTabs')
    })

    it('should build CustomMetadataType url', () => {
      const result = makeResult({
        type: 'CustomMetadataType',
        id: 'm01xxx',
        metadata: { _isTypeDefinition: true, Id: 'm01xxx' }
      })
      const url = buildNavigationUrl(result, lightningCtx)
      expect(url).toContain('CustomMetadata')
    })

    it('should build CustomSetting definition url', () => {
      const result = makeResult({
        type: 'CustomSetting',
        id: '01Nxxx',
        metadata: { _isSettingDefinition: true, DurableId: '01Nxxx' }
      })
      const url = buildNavigationUrl(result, lightningCtx)
      expect(url).toContain('CustomSettings')
      expect(url).toContain('viewCustomSettings')
    })
  })

  describe('Classic URLs', () => {
    it('should build ApexClass url as direct ID', () => {
      const result = makeResult({ type: 'ApexClass', id: '01pxxx' })
      const url = buildNavigationUrl(result, classicCtx)
      expect(url).toBe('https://test.my.salesforce.com/01pxxx')
    })

    it('should build User url as direct ID', () => {
      const result = makeResult({ type: 'User', id: '005xxx' })
      const url = buildNavigationUrl(result, classicCtx)
      expect(url).toBe('https://test.my.salesforce.com/005xxx')
    })

    it('should build Flow url (same in classic and lightning)', () => {
      const result = makeResult({ type: 'Flow', id: '301xxx' })
      const url = buildNavigationUrl(result, classicCtx)
      expect(url).toContain('flowBuilder.app?flowId=301xxx')
    })

    it('should build CustomObject url with KeyPrefix', () => {
      const result = makeResult({
        type: 'CustomObject',
        id: '01Ixxx',
        metadata: { KeyPrefix: '00a', QualifiedApiName: 'MyObj__c' }
      })
      const url = buildNavigationUrl(result, classicCtx)
      expect(url).toBe('https://test.my.salesforce.com/00a')
    })

    it('should build CustomObject url with DurableId starting with 01I', () => {
      const result = makeResult({
        type: 'CustomObject',
        id: '01Ixxx',
        metadata: { DurableId: '01Ixxx', QualifiedApiName: 'MyObj__c' }
      })
      const url = buildNavigationUrl(result, classicCtx)
      expect(url).toBe('https://test.my.salesforce.com/01Ixxx')
    })

    it('should build CustomObject url with LayoutFieldList fallback', () => {
      const result = makeResult({
        type: 'CustomObject',
        id: '01Ixxx',
        metadata: { QualifiedApiName: 'MyObj__c' }
      })
      const url = buildNavigationUrl(result, classicCtx)
      expect(url).toContain('LayoutFieldList?type=MyObj__c')
    })

    it('should build CustomField classic url', () => {
      const result = makeResult({
        type: 'CustomField',
        id: '00Nxxx',
        metadata: { DurableId: 'Account.00Nxxx' }
      })
      const url = buildNavigationUrl(result, classicCtx)
      expect(url).toBe('https://test.my.salesforce.com/00Nxxx')
    })

    it('should return null for ProfileSubMenu in classic', () => {
      const result = makeResult({ type: 'ProfileSubMenu' })
      expect(buildNavigationUrl(result, classicCtx)).toBeNull()
    })

    it('should build classic Report/Dashboard url', () => {
      const result = makeResult({ type: 'Report', id: '00Oxxx' })
      const url = buildNavigationUrl(result, classicCtx)
      expect(url).toBe('https://test.my.salesforce.com/00Oxxx')
    })

    it('should build classic CustomSetting definition url', () => {
      const result = makeResult({
        type: 'CustomSetting',
        id: '01Nxxx',
        metadata: { _isSettingDefinition: true, DurableId: '01Nxxx' }
      })
      const url = buildNavigationUrl(result, classicCtx)
      expect(url).toContain('viewCustomSettings.apexp?id=01Nxxx')
    })
  })
})

describe('buildIdNavigationUrl', () => {
  it('should return null when sfHost is null', () => {
    expect(buildIdNavigationUrl('001xxx', { ...lightningCtx, sfHost: null })).toBeNull()
  })

  it('should build direct URL to record', () => {
    expect(buildIdNavigationUrl('001xxx', lightningCtx)).toBe('https://test.my.salesforce.com/001xxx')
  })
})

describe('buildActionUrl', () => {
  it('should return null when sfHost is null', () => {
    const result = makeResult({ metadata: { DurableId: '01Ixxx', QualifiedApiName: 'Account' } })
    expect(buildActionUrl(result, 'fields', { ...lightningCtx, sfHost: null })).toBeNull()
  })

  it('should build ApexPage preview url', () => {
    const result = makeResult({ type: 'ApexPage', name: 'TestPage' })
    const url = buildActionUrl(result, 'preview', lightningCtx)
    expect(url).toBe('https://test.my.salesforce.com/apex/TestPage')
  })

  it('should include namespace in ApexPage preview url', () => {
    const result = makeResult({ type: 'ApexPage', name: 'TestPage', namespace: 'ns' })
    const url = buildActionUrl(result, 'preview', lightningCtx)
    expect(url).toBe('https://test.my.salesforce.com/apex/ns__TestPage')
  })

  it('should return null when no DurableId for non-preview actions', () => {
    const result = makeResult({ type: 'CustomObject', metadata: {} })
    expect(buildActionUrl(result, 'fields', lightningCtx)).toBeNull()
  })

  describe('Lightning actions', () => {
    const result = makeResult({
      type: 'CustomObject',
      metadata: { DurableId: '01Ixxx', QualifiedApiName: 'Account' }
    })

    it('should build list url', () => {
      const url = buildActionUrl(result, 'list', lightningCtx)
      expect(url).toContain('/lightning/o/Account/list')
    })

    it('should build fields url', () => {
      const url = buildActionUrl(result, 'fields', lightningCtx)
      expect(url).toContain('ObjectManager/01Ixxx/FieldsAndRelationships/view')
    })

    it('should build layouts url', () => {
      const url = buildActionUrl(result, 'layouts', lightningCtx)
      expect(url).toContain('ObjectManager/01Ixxx/PageLayouts/view')
    })

    it('should build recordtypes url', () => {
      const url = buildActionUrl(result, 'recordtypes', lightningCtx)
      expect(url).toContain('ObjectManager/01Ixxx/RecordTypes/view')
    })

    it('should build validationrules url', () => {
      const url = buildActionUrl(result, 'validationrules', lightningCtx)
      expect(url).toContain('ObjectManager/01Ixxx/ValidationRules/view')
    })

    it('should build details url', () => {
      const url = buildActionUrl(result, 'details', lightningCtx)
      expect(url).toContain('ObjectManager/01Ixxx/Details/view')
    })

    it('should return null for unknown action', () => {
      expect(buildActionUrl(result, 'unknown' as any, lightningCtx)).toBeNull()
    })
  })

  describe('Classic actions', () => {
    const result = makeResult({
      type: 'CustomObject',
      metadata: { DurableId: '01Ixxx', QualifiedApiName: 'Account', KeyPrefix: '001' }
    })

    it('should build list url with KeyPrefix', () => {
      const url = buildActionUrl(result, 'list', classicCtx)
      expect(url).toBe('https://test.my.salesforce.com/001')
    })

    it('should build list url without KeyPrefix', () => {
      const noPrefix = makeResult({
        type: 'CustomObject',
        metadata: { DurableId: '01Ixxx', QualifiedApiName: 'MyObj__c' }
      })
      const url = buildActionUrl(noPrefix, 'list', classicCtx)
      expect(url).toContain('LayoutFieldList?type=MyObj__c')
    })

    it('should redirect to DurableId page for custom objects', () => {
      const url = buildActionUrl(result, 'fields', classicCtx)
      expect(url).toBe('https://test.my.salesforce.com/01Ixxx')
    })

    it('should build fields url for standard objects with setupid', () => {
      const stdResult = makeResult({
        type: 'CustomObject',
        metadata: { DurableId: 'Account', QualifiedApiName: 'Account' }
      })
      const url = buildActionUrl(stdResult, 'fields', classicCtx)
      expect(url).toContain('LayoutFieldList?type=Account&setupid=AccountFields')
    })

    it('should return null for unknown classic action', () => {
      const stdResult = makeResult({
        type: 'CustomObject',
        metadata: { DurableId: 'Account', QualifiedApiName: 'Account' }
      })
      expect(buildActionUrl(stdResult, 'unknown' as any, classicCtx)).toBeNull()
    })
  })
})
