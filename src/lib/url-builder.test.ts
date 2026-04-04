import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getSetupHost,
  buildSetupUrl,
  shouldUseLightning,
  getCurrentRecordFromUrl,
  resolveSetupShortcutPath
} from './url-builder'
import type { SetupShortcut } from './setup-shortcuts'

describe('url-builder', () => {
  describe('getSetupHost', () => {
    it('should return null for null input', () => {
      expect(getSetupHost(null)).toBeNull()
    })

    it('should convert .my.salesforce.com to .my.salesforce-setup.com', () => {
      expect(getSetupHost('myorg.my.salesforce.com')).toBe('myorg.my.salesforce-setup.com')
    })

    it('should convert .lightning.force.com to .my.salesforce-setup.com', () => {
      expect(getSetupHost('myorg.lightning.force.com')).toBe('myorg.my.salesforce-setup.com')
    })

    it('should convert Chinese domain .my.sfcrmproducts.cn', () => {
      expect(getSetupHost('myorg.my.sfcrmproducts.cn')).toBe('myorg.setup.sfcrmproducts.cn')
    })

    it('should convert Chinese domain .my.sfcrmapps.cn', () => {
      expect(getSetupHost('myorg.my.sfcrmapps.cn')).toBe('myorg.setup.sfcrmapps.cn')
    })

    it('should convert .lightning.sfcrmproducts.cn', () => {
      expect(getSetupHost('myorg.lightning.sfcrmproducts.cn')).toBe('myorg.setup.sfcrmproducts.cn')
    })

    it('should convert .lightning.sfcrmapps.cn', () => {
      expect(getSetupHost('myorg.lightning.sfcrmapps.cn')).toBe('myorg.setup.sfcrmapps.cn')
    })

    it('should convert sandbox Chinese domains', () => {
      expect(getSetupHost('myorg.sandbox.my.sfcrmproducts.cn')).toBe('myorg.sandbox.setup.sfcrmproducts.cn')
      expect(getSetupHost('myorg.sandbox.my.sfcrmapps.cn')).toBe('myorg.sandbox.setup.sfcrmapps.cn')
    })
  })

  describe('buildSetupUrl', () => {
    it('should return full https URL for valid host and path', () => {
      expect(buildSetupUrl('myorg.my.salesforce.com', '/lightning/setup/ApexClasses/home')).toBe(
        'https://myorg.my.salesforce-setup.com/lightning/setup/ApexClasses/home'
      )
    })

    it('should return null when host is null', () => {
      expect(buildSetupUrl(null, '/path')).toBeNull()
    })
  })

  describe('shouldUseLightning', () => {
    beforeEach(() => {
      vi.stubGlobal('window', {
        location: {
          href: 'https://myorg.my.salesforce.com/home/home.jsp',
          hostname: 'myorg.my.salesforce.com',
          pathname: '/home/home.jsp'
        }
      })
    })

    it('should return true when mode is lightning', () => {
      expect(shouldUseLightning('lightning', null)).toBe(true)
    })

    it('should return false when mode is classic', () => {
      expect(shouldUseLightning('classic', null)).toBe(false)
    })

    it('should return true when mode is auto and user prefers lightning', () => {
      expect(shouldUseLightning('auto', true)).toBe(true)
    })

    it('should return false when mode is auto and user prefers classic', () => {
      expect(shouldUseLightning('auto', false)).toBe(false)
    })

    it('should detect Lightning from URL when auto mode and no preference', () => {
      vi.stubGlobal('window', {
        location: {
          href: 'https://myorg.lightning.force.com/lightning/page',
          hostname: 'myorg.lightning.force.com',
          pathname: '/lightning/page'
        }
      })
      expect(shouldUseLightning('auto', null)).toBe(true)
    })

    it('should detect Classic from URL patterns when auto mode and no preference', () => {
      vi.stubGlobal('window', {
        location: {
          href: 'https://myorg.my.salesforce.com/home/home.jsp',
          hostname: 'myorg.my.salesforce.com',
          pathname: '/home/home.jsp'
        }
      })
      expect(shouldUseLightning('auto', null)).toBe(false)
    })

    it('should detect lex=off as classic', () => {
      vi.stubGlobal('window', {
        location: {
          href: 'https://myorg.my.salesforce.com/page?lex=off',
          hostname: 'myorg.my.salesforce.com',
          pathname: '/page'
        }
      })
      expect(shouldUseLightning('auto', null)).toBe(false)
    })
  })

  describe('getCurrentRecordFromUrl', () => {
    it('should extract object and record ID from Lightning URL', () => {
      vi.stubGlobal('window', {
        location: { pathname: '/lightning/r/Account/001xx000003GYQAAA4/view' }
      })
      const result = getCurrentRecordFromUrl()
      expect(result.objectApiName).toBe('Account')
      expect(result.recordId).toBe('001xx000003GYQAAA4')
    })

    it('should extract record ID from Classic URL', () => {
      vi.stubGlobal('window', {
        location: { pathname: '/001xx000003GYQAAA4' }
      })
      const result = getCurrentRecordFromUrl()
      expect(result.objectApiName).toBeNull()
      expect(result.recordId).toBe('001xx000003GYQAAA4')
    })

    it('should return nulls for non-record URL', () => {
      vi.stubGlobal('window', {
        location: { pathname: '/home/home.jsp' }
      })
      const result = getCurrentRecordFromUrl()
      expect(result.objectApiName).toBeNull()
      expect(result.recordId).toBeNull()
    })
  })

  describe('resolveSetupShortcutPath', () => {
    const usersShortcut: SetupShortcut = {
      id: 'users',
      name: 'Users',
      description: 'User Management',
      path: '/lightning/setup/ManageUsers/home'
    }

    const otherShortcut: SetupShortcut = {
      id: 'apex-classes',
      name: 'Apex Classes',
      description: 'Custom Code',
      path: '/lightning/setup/ApexClasses/home'
    }

    it('should return the shortcut path for normal domains', () => {
      expect(resolveSetupShortcutPath(usersShortcut, 'myorg.my.salesforce.com')).toBe(
        '/lightning/setup/ManageUsers/home'
      )
    })

    it('should use ManageUsersLightning for sfcrmproducts.cn domains', () => {
      expect(resolveSetupShortcutPath(usersShortcut, 'myorg.my.sfcrmproducts.cn')).toBe(
        '/lightning/setup/ManageUsersLightning/home'
      )
    })

    it('should use ManageUsersLightning for sfcrmapps.cn domains', () => {
      expect(resolveSetupShortcutPath(usersShortcut, 'myorg.my.sfcrmapps.cn')).toBe(
        '/lightning/setup/ManageUsersLightning/home'
      )
    })

    it('should return normal path for non-users shortcut on Chinese domains', () => {
      expect(resolveSetupShortcutPath(otherShortcut, 'myorg.my.sfcrmproducts.cn')).toBe(
        '/lightning/setup/ApexClasses/home'
      )
    })

    it('should return normal path when sfHost is null', () => {
      expect(resolveSetupShortcutPath(usersShortcut, null)).toBe('/lightning/setup/ManageUsers/home')
    })
  })
})
