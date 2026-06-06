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

    it('should build classic layouts url for standard objects', () => {
      const stdResult = makeResult({
        type: 'CustomObject',
        metadata: { DurableId: 'Account', QualifiedApiName: 'Account' }
      })
      const url = buildActionUrl(stdResult, 'layouts', classicCtx)
      expect(url).toBe(
        'https://test.my.salesforce.com/ui/setup/layout/PageLayouts?type=Account&setupid=AccountLayouts'
      )
    })

    it('should build classic recordtypes url for standard objects', () => {
      const stdResult = makeResult({
        type: 'CustomObject',
        metadata: { DurableId: 'Account', QualifiedApiName: 'Account' }
      })
      const url = buildActionUrl(stdResult, 'recordtypes', classicCtx)
      expect(url).toBe(
        'https://test.my.salesforce.com/setup/ui/recordtypeselect.jsp?type=Account&setupid=AccountRecords'
      )
    })

    it('should build classic validationrules url for standard objects', () => {
      const stdResult = makeResult({
        type: 'CustomObject',
        metadata: { DurableId: 'Account', QualifiedApiName: 'Account' }
      })
      const url = buildActionUrl(stdResult, 'validationrules', classicCtx)
      expect(url).toBe(
        'https://test.my.salesforce.com/p/setup/vr/listvr.jsp?type=Account&setupid=AccountValidationRules'
      )
    })

    it('should build classic details url for standard objects', () => {
      const stdResult = makeResult({
        type: 'CustomObject',
        metadata: { DurableId: 'Account', QualifiedApiName: 'Account' }
      })
      const url = buildActionUrl(stdResult, 'details', classicCtx)
      expect(url).toBe(
        'https://test.my.salesforce.com/p/setup/layout/LayoutFieldList?type=Account&setupid=AccountFields'
      )
    })
  })

  describe('China domain forces Lightning actions', () => {
    const chinaCtx: NavigationContext = {
      sfHost: 'mycompany.my.sfcrmproducts.cn',
      navigationMode: 'classic',
      userLightningPreference: false
    }

    it('should use Lightning ObjectManager url on China domain even in classic mode', () => {
      const result = makeResult({
        type: 'CustomObject',
        metadata: { DurableId: '01Ixxx', QualifiedApiName: 'Account' }
      })
      const url = buildActionUrl(result, 'fields', chinaCtx)
      expect(url).toBe(
        'https://mycompany.my.sfcrmproducts.cn/lightning/setup/ObjectManager/01Ixxx/FieldsAndRelationships/view'
      )
    })
  })
})

describe('buildNavigationUrl additional Lightning branches', () => {
  it('should build ApexPage url', () => {
    const result = makeResult({ type: 'ApexPage', id: '066xxx' })
    const url = buildNavigationUrl(result, lightningCtx)
    expect(url).toBe('https://test.my.salesforce.com/lightning/setup/ApexPages/page?address=%2F066xxx')
  })

  it('should build ApexComponent url', () => {
    const result = makeResult({ type: 'ApexComponent', id: '077xxx' })
    const url = buildNavigationUrl(result, lightningCtx)
    expect(url).toBe('https://test.my.salesforce.com/lightning/setup/ApexComponents/page?address=%2F077xxx')
  })

  it('should build LightningComponentBundle url', () => {
    const result = makeResult({ type: 'LightningComponentBundle', id: '0Rbxxx' })
    const url = buildNavigationUrl(result, lightningCtx)
    expect(url).toBe(
      'https://test.my.salesforce.com/lightning/setup/LightningComponentBundles/page?address=%2F0Rbxxx'
    )
  })

  it('should build AuraDefinitionBundle url', () => {
    const result = makeResult({ type: 'AuraDefinitionBundle', id: '0Abxxx' })
    const url = buildNavigationUrl(result, lightningCtx)
    expect(url).toBe('https://test.my.salesforce.com/lightning/setup/AuraBundles/page?address=%2F0Abxxx')
  })

  it('should fall back to generic record view when CustomField lacks object/field info', () => {
    const result = makeResult({ type: 'CustomField', id: '00Nxxx', metadata: {} })
    const url = buildNavigationUrl(result, lightningCtx)
    expect(url).toBe('https://test.my.salesforce.com/lightning/r/CustomField/00Nxxx/view')
  })

  it('should build FieldPermission url', () => {
    const result = makeResult({
      type: 'FieldPermission',
      id: 'fp001',
      metadata: { profileId: '00e001', SobjectType: 'Account' }
    })
    const url = buildNavigationUrl(result, lightningCtx)
    expect(url).toBe(
      'https://test.my.salesforce-setup.com/lightning/setup/Profiles/page?address=%2F00e001%3Fs%3DFieldPermissions%26o%3DAccount'
    )
  })

  it('should build CustomPermissionAccess url', () => {
    const result = makeResult({ type: 'CustomPermissionAccess', id: 'cp001', metadata: { profileId: '00e001' } })
    const url = buildNavigationUrl(result, lightningCtx)
    expect(url).toBe(
      'https://test.my.salesforce-setup.com/lightning/setup/Profiles/page?address=%2F00e001%3Fs%3DCustomPermissions'
    )
  })

  it('should build ApexClassAccess url', () => {
    const result = makeResult({ type: 'ApexClassAccess', id: 'ac001', metadata: { profileId: '00e001' } })
    const url = buildNavigationUrl(result, lightningCtx)
    expect(url).toBe(
      'https://test.my.salesforce-setup.com/lightning/setup/Profiles/page?address=%2F00e001%3Fs%3DApexClassAccess'
    )
  })

  it('should build VFPageAccess url', () => {
    const result = makeResult({ type: 'VFPageAccess', id: 'vf001', metadata: { profileId: '00e001' } })
    const url = buildNavigationUrl(result, lightningCtx)
    expect(url).toBe(
      'https://test.my.salesforce-setup.com/lightning/setup/Profiles/page?address=%2F00e001%3Fs%3DApexPageAccess'
    )
  })

  it('should build ConnectedAppAccess url', () => {
    const result = makeResult({ type: 'ConnectedAppAccess', id: 'ca001', metadata: { profileId: '00e001' } })
    const url = buildNavigationUrl(result, lightningCtx)
    expect(url).toBe(
      'https://test.my.salesforce-setup.com/lightning/setup/Profiles/page?address=%2F00e001%3Fs%3DConnectedAppSettings'
    )
  })

  it('should build AssignedAppAccess url', () => {
    const result = makeResult({ type: 'AssignedAppAccess', id: 'aa001', metadata: { profileId: '00e001' } })
    const url = buildNavigationUrl(result, lightningCtx)
    expect(url).toBe(
      'https://test.my.salesforce-setup.com/lightning/setup/Profiles/page?address=%2F00e001%3Fs%3DObjectsAndTabs'
    )
  })

  it('should build ProfileSetupLink url', () => {
    const result = makeResult({
      type: 'ProfileSetupLink',
      id: 'psl001',
      metadata: { profileId: '00e001', section: 'LoginIpRanges' }
    })
    const url = buildNavigationUrl(result, lightningCtx)
    expect(url).toBe(
      'https://test.my.salesforce-setup.com/lightning/setup/Profiles/page?address=%2F00e001%3Fs%3DLoginIpRanges'
    )
  })

  it('should build CustomMetadataType record url for non-type-definition', () => {
    const result = makeResult({
      type: 'CustomMetadataType',
      id: 'm01xxx',
      metadata: { Id: 'm01record' }
    })
    const url = buildNavigationUrl(result, lightningCtx)
    expect(url).toBe(
      'https://test.my.salesforce-setup.com/lightning/setup/CustomMetadata/page?address=%2Fm01record'
    )
  })

  it('should build CustomSetting record url for non-definition', () => {
    const result = makeResult({
      type: 'CustomSetting',
      id: '01Nrecord',
      metadata: { DurableId: '01Ndurable' }
    })
    const url = buildNavigationUrl(result, lightningCtx)
    expect(url).toBe(
      'https://test.my.salesforce-setup.com/lightning/setup/CustomSettings/page?address=%2F01Nrecord'
    )
  })

  it('should build CustomQuery url', () => {
    const result = makeResult({ type: 'CustomQuery', id: '001xxx' })
    const url = buildNavigationUrl(result, lightningCtx)
    expect(url).toBe('https://test.my.salesforce.com/lightning/r/sObject/001xxx/view')
  })

  it('should build Group url', () => {
    const result = makeResult({ type: 'Group', id: '00Gxxx' })
    const url = buildNavigationUrl(result, lightningCtx)
    expect(url).toBe(
      'https://test.my.salesforce-setup.com/lightning/setup/PublicGroups/page?address=%2Fsetup%2Fown%2Fgroupdetail.jsp%3Fid%3D00Gxxx'
    )
  })

  it('should build Dashboard url', () => {
    const result = makeResult({ type: 'Dashboard', id: '01Zxxx' })
    const url = buildNavigationUrl(result, lightningCtx)
    expect(url).toBe('https://test.my.salesforce.com/lightning/r/Dashboard/01Zxxx/view')
  })
})

describe('buildNavigationUrl additional Classic branches', () => {
  it('should build ObjectPermission classic url', () => {
    const result = makeResult({
      type: 'ObjectPermission',
      id: 'op001',
      metadata: { profileId: '00e001', objectRef: 'Account' }
    })
    const url = buildNavigationUrl(result, classicCtx)
    expect(url).toBe('https://test.my.salesforce.com/00e001?s=ObjectsAndTabs&o=Account')
  })

  it('should build ObjectPermission classic url falling back to name', () => {
    const result = makeResult({
      type: 'ObjectPermission',
      id: 'op001',
      name: 'Contact',
      metadata: { profileId: '00e001' }
    })
    const url = buildNavigationUrl(result, classicCtx)
    expect(url).toBe('https://test.my.salesforce.com/00e001?s=ObjectsAndTabs&o=Contact')
  })

  it('should build FieldPermission classic url', () => {
    const result = makeResult({
      type: 'FieldPermission',
      id: 'fp001',
      metadata: { profileId: '00e001', SobjectType: 'Account' }
    })
    const url = buildNavigationUrl(result, classicCtx)
    expect(url).toBe('https://test.my.salesforce.com/00e001?s=FieldPermissions&o=Account')
  })

  it('should build CustomPermissionAccess classic url', () => {
    const result = makeResult({ type: 'CustomPermissionAccess', id: 'cp001', metadata: { profileId: '00e001' } })
    const url = buildNavigationUrl(result, classicCtx)
    expect(url).toBe('https://test.my.salesforce.com/00e001?s=CustomPermissions')
  })

  it('should build ApexClassAccess classic url', () => {
    const result = makeResult({ type: 'ApexClassAccess', id: 'ac001', metadata: { profileId: '00e001' } })
    const url = buildNavigationUrl(result, classicCtx)
    expect(url).toBe('https://test.my.salesforce.com/00e001?s=ApexClassAccess')
  })

  it('should build VFPageAccess classic url', () => {
    const result = makeResult({ type: 'VFPageAccess', id: 'vf001', metadata: { profileId: '00e001' } })
    const url = buildNavigationUrl(result, classicCtx)
    expect(url).toBe('https://test.my.salesforce.com/00e001?s=ApexPageAccess')
  })

  it('should build ConnectedAppAccess classic url', () => {
    const result = makeResult({ type: 'ConnectedAppAccess', id: 'ca001', metadata: { profileId: '00e001' } })
    const url = buildNavigationUrl(result, classicCtx)
    expect(url).toBe('https://test.my.salesforce.com/00e001?s=ConnectedAppSettings')
  })

  it('should build AssignedAppAccess classic url', () => {
    const result = makeResult({ type: 'AssignedAppAccess', id: 'aa001', metadata: { profileId: '00e001' } })
    const url = buildNavigationUrl(result, classicCtx)
    expect(url).toBe('https://test.my.salesforce.com/00e001?s=ObjectsAndTabs')
  })

  it('should build ProfileSetupLink classic url', () => {
    const result = makeResult({
      type: 'ProfileSetupLink',
      id: 'psl001',
      metadata: { profileId: '00e001', section: 'LoginIpRanges' }
    })
    const url = buildNavigationUrl(result, classicCtx)
    expect(url).toBe('https://test.my.salesforce.com/00e001?s=LoginIpRanges')
  })

  it('should fall back to result id when CustomField has no DurableId', () => {
    const result = makeResult({ type: 'CustomField', id: '00Nfallback', metadata: {} })
    const url = buildNavigationUrl(result, classicCtx)
    expect(url).toBe('https://test.my.salesforce.com/00Nfallback')
  })

  it('should build CustomLabel classic url', () => {
    const result = makeResult({ type: 'CustomLabel', id: '101xxx' })
    const url = buildNavigationUrl(result, classicCtx)
    expect(url).toBe('https://test.my.salesforce.com/101xxx')
  })

  it('should build CustomMetadataType classic url', () => {
    const result = makeResult({
      type: 'CustomMetadataType',
      id: 'm01xxx',
      metadata: { Id: 'm01record' }
    })
    const url = buildNavigationUrl(result, classicCtx)
    expect(url).toBe('https://test.my.salesforce.com/m01record')
  })

  it('should build CustomSetting classic record url for non-definition', () => {
    const result = makeResult({
      type: 'CustomSetting',
      id: '01Nrecord',
      metadata: { DurableId: '01Ndurable' }
    })
    const url = buildNavigationUrl(result, classicCtx)
    expect(url).toBe('https://test.my.salesforce.com/01Nrecord')
  })

  it('should build CustomQuery classic url', () => {
    const result = makeResult({ type: 'CustomQuery', id: '001xxx' })
    const url = buildNavigationUrl(result, classicCtx)
    expect(url).toBe('https://test.my.salesforce.com/001xxx')
  })

  it('should build Queue classic url', () => {
    const result = makeResult({ type: 'Queue', id: '00Gxxx' })
    const url = buildNavigationUrl(result, classicCtx)
    expect(url).toBe('https://test.my.salesforce.com/p/own/Queue/d?id=00Gxxx&setupid=Queues')
  })

  it('should build Group classic url', () => {
    const result = makeResult({ type: 'Group', id: '00Gxxx' })
    const url = buildNavigationUrl(result, classicCtx)
    expect(url).toBe('https://test.my.salesforce.com/setup/own/groupdetail.jsp?id=00Gxxx&setupid=PublicGroups')
  })

  it('should build default classic url for unknown types', () => {
    const result = makeResult({ type: 'SomeNewType' as any, id: 'xxx123' })
    const url = buildNavigationUrl(result, classicCtx)
    expect(url).toBe('https://test.my.salesforce.com/xxx123')
  })
})
