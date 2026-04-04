import { describe, it, expect, vi } from 'vitest'

vi.mock('./url-builder', () => ({
  getSetupHost: vi.fn((host: string | null) => {
    if (!host) return null
    return host
      .replace('.my.salesforce.com', '.my.salesforce-setup.com')
      .replace('.lightning.force.com', '.my.salesforce-setup.com')
  }),
  buildSetupUrl: vi.fn((host: string | null, path: string) => {
    if (!host) return null
    const setupHost = host
      .replace('.my.salesforce.com', '.my.salesforce-setup.com')
      .replace('.lightning.force.com', '.my.salesforce-setup.com')
    return `https://${setupHost}${path}`
  }),
  shouldUseLightning: vi.fn()
}))

vi.mock('./logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

import { buildNavigationUrl, buildIdNavigationUrl, buildActionUrl, KEY_PREFIX_MAP } from './navigation'
import type { NavigationContext } from './navigation'
import type { SearchResult } from '~types'
import { shouldUseLightning } from './url-builder'

const TEST_HOST = 'myorg.my.salesforce.com'

function makeContext(overrides: Partial<NavigationContext> = {}): NavigationContext {
  return {
    sfHost: TEST_HOST,
    navigationMode: 'auto',
    userLightningPreference: null,
    ...overrides
  }
}

describe('navigation', () => {
  describe('KEY_PREFIX_MAP', () => {
    it('should map 001 to Account', () => {
      expect(KEY_PREFIX_MAP['001']).toBe('Account')
    })

    it('should map 003 to Contact', () => {
      expect(KEY_PREFIX_MAP['003']).toBe('Contact')
    })

    it('should map 005 to User', () => {
      expect(KEY_PREFIX_MAP['005']).toBe('User')
    })

    it('should map 500 to Case', () => {
      expect(KEY_PREFIX_MAP['500']).toBe('Case')
    })
  })

  describe('buildNavigationUrl', () => {
    it('should return result.url for SetupShortcut type', () => {
      const result: SearchResult = {
        id: 'apex-classes',
        name: 'Apex Classes',
        type: 'SetupShortcut',
        url: 'https://myorg.my.salesforce-setup.com/lightning/setup/ApexClasses/home'
      }
      const url = buildNavigationUrl(result, makeContext())
      expect(url).toBe(result.url)
    })

    it('should return null when sfHost is null', () => {
      const result: SearchResult = { id: '01pxx', name: 'MyClass', type: 'ApexClass' }
      const url = buildNavigationUrl(result, makeContext({ sfHost: null }))
      expect(url).toBeNull()
    })

    it('should build Lightning URL for ApexClass', () => {
      vi.mocked(shouldUseLightning).mockReturnValue(true)
      const result: SearchResult = { id: '01pxx', name: 'MyClass', type: 'ApexClass' }
      const url = buildNavigationUrl(result, makeContext())
      expect(url).toContain('/lightning/setup/ApexClasses/page?address=')
      expect(url).toContain(result.id)
    })

    it('should build Classic URL for ApexClass', () => {
      vi.mocked(shouldUseLightning).mockReturnValue(false)
      const result: SearchResult = { id: '01pxx', name: 'MyClass', type: 'ApexClass' }
      const url = buildNavigationUrl(result, makeContext())
      expect(url).toBe(`https://${TEST_HOST}/01pxx`)
    })

    it('should build Lightning URL for Flow', () => {
      vi.mocked(shouldUseLightning).mockReturnValue(true)
      const result: SearchResult = { id: '301xx', name: 'MyFlow', type: 'Flow' }
      const url = buildNavigationUrl(result, makeContext())
      expect(url).toContain('flowBuilder.app?flowId=301xx')
    })

    it('should build Lightning URL for CustomObject with list view', () => {
      vi.mocked(shouldUseLightning).mockReturnValue(true)
      const result: SearchResult = {
        id: '01Ixx',
        name: 'MyObj__c',
        type: 'CustomObject',
        metadata: { QualifiedApiName: 'MyObj__c' }
      }
      const url = buildNavigationUrl(result, makeContext())
      expect(url).toContain('/lightning/o/MyObj__c/list')
    })

    it('should build Lightning URL for User with setup host', () => {
      vi.mocked(shouldUseLightning).mockReturnValue(true)
      const result: SearchResult = { id: '005xx', name: 'Test User', type: 'User' }
      const url = buildNavigationUrl(result, makeContext())
      expect(url).toContain('salesforce-setup.com')
      expect(url).toContain('ManageUsers')
    })

    it('should build Lightning URL for Report', () => {
      vi.mocked(shouldUseLightning).mockReturnValue(true)
      const result: SearchResult = { id: '00Oxx', name: 'MyReport', type: 'Report' }
      const url = buildNavigationUrl(result, makeContext())
      expect(url).toContain('/lightning/r/Report/00Oxx/view')
    })

    it('should build Classic URL for Report', () => {
      vi.mocked(shouldUseLightning).mockReturnValue(false)
      const result: SearchResult = { id: '00Oxx', name: 'MyReport', type: 'Report' }
      const url = buildNavigationUrl(result, makeContext())
      expect(url).toBe(`https://${TEST_HOST}/00Oxx`)
    })

    it('should build Lightning default URL for unknown types', () => {
      vi.mocked(shouldUseLightning).mockReturnValue(true)
      const result: SearchResult = { id: 'abcxx', name: 'Something', type: 'SomeType' }
      const url = buildNavigationUrl(result, makeContext())
      expect(url).toContain('/lightning/r/SomeType/abcxx/view')
    })

    it('should build Classic default URL for unknown types', () => {
      vi.mocked(shouldUseLightning).mockReturnValue(false)
      const result: SearchResult = { id: 'abcxx', name: 'Something', type: 'SomeType' }
      const url = buildNavigationUrl(result, makeContext())
      expect(url).toBe(`https://${TEST_HOST}/abcxx`)
    })
  })

  describe('buildIdNavigationUrl', () => {
    it('should build direct URL from ID', () => {
      const url = buildIdNavigationUrl('001xx', makeContext())
      expect(url).toBe(`https://${TEST_HOST}/001xx`)
    })

    it('should return null when sfHost is null', () => {
      const url = buildIdNavigationUrl('001xx', makeContext({ sfHost: null }))
      expect(url).toBeNull()
    })
  })

  describe('buildActionUrl', () => {
    it('should build preview URL for ApexPage', () => {
      vi.mocked(shouldUseLightning).mockReturnValue(true)
      const result: SearchResult = {
        id: '066xx',
        name: 'MyPage',
        type: 'ApexPage',
        metadata: { DurableId: '066xx' }
      }
      const url = buildActionUrl(result, 'preview', makeContext())
      expect(url).toContain('/apex/MyPage')
    })

    it('should build preview URL for namespaced ApexPage', () => {
      vi.mocked(shouldUseLightning).mockReturnValue(true)
      const result: SearchResult = {
        id: '066xx',
        name: 'MyPage',
        type: 'ApexPage',
        namespace: 'ns',
        metadata: { DurableId: '066xx' }
      }
      const url = buildActionUrl(result, 'preview', makeContext())
      expect(url).toContain('/apex/ns__MyPage')
    })

    it('should build Lightning fields URL for CustomObject', () => {
      vi.mocked(shouldUseLightning).mockReturnValue(true)
      const result: SearchResult = {
        id: '01Ixx',
        name: 'MyObj__c',
        type: 'CustomObject',
        metadata: { DurableId: '01Ixx', QualifiedApiName: 'MyObj__c' }
      }
      const url = buildActionUrl(result, 'fields', makeContext())
      expect(url).toContain('/lightning/setup/ObjectManager/01Ixx/FieldsAndRelationships/view')
    })

    it('should build Classic fields URL for standard object', () => {
      vi.mocked(shouldUseLightning).mockReturnValue(false)
      const result: SearchResult = {
        id: 'Account',
        name: 'Account',
        type: 'CustomObject',
        metadata: { DurableId: 'Account', QualifiedApiName: 'Account' }
      }
      const url = buildActionUrl(result, 'fields', makeContext())
      expect(url).toContain('LayoutFieldList?type=Account')
    })

    it('should build Classic URL for custom object with 01I DurableId', () => {
      vi.mocked(shouldUseLightning).mockReturnValue(false)
      const result: SearchResult = {
        id: '01Ixx',
        name: 'MyObj__c',
        type: 'CustomObject',
        metadata: { DurableId: '01Ixx', QualifiedApiName: 'MyObj__c' }
      }
      const url = buildActionUrl(result, 'fields', makeContext())
      expect(url).toBe(`https://${TEST_HOST}/01Ixx`)
    })

    it('should return null when sfHost is null', () => {
      const result: SearchResult = {
        id: '01Ixx',
        name: 'MyObj__c',
        type: 'CustomObject',
        metadata: { DurableId: '01Ixx', QualifiedApiName: 'MyObj__c' }
      }
      const url = buildActionUrl(result, 'fields', makeContext({ sfHost: null }))
      expect(url).toBeNull()
    })

    it('should return null when DurableId missing for non-preview action', () => {
      vi.mocked(shouldUseLightning).mockReturnValue(true)
      const result: SearchResult = {
        id: '01Ixx',
        name: 'MyObj__c',
        type: 'CustomObject',
        metadata: {}
      }
      const url = buildActionUrl(result, 'fields', makeContext())
      expect(url).toBeNull()
    })
  })
})
