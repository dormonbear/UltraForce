import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./auth', () => ({
  sfRest: vi.fn(),
  API_VERSION: '62.0'
}))

vi.mock('./salesforce-api', () => ({
  isApiAvailable: vi.fn().mockReturnValue(true)
}))

vi.mock('./url-builder', () => ({
  getSetupHost: vi.fn((host: string | null) => {
    if (!host) return null
    return host.replace('.my.salesforce.com', '.my.salesforce-setup.com')
  }),
  buildSetupUrl: vi.fn((host: string | null, path: string) => {
    if (!host) return null
    const setupHost = host.replace('.my.salesforce.com', '.my.salesforce-setup.com')
    return `https://${setupHost}${path}`
  }),
  shouldUseLightning: vi.fn().mockReturnValue(true)
}))

vi.mock('./logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

import {
  fetchRecordTypeId,
  getCurrentUserId,
  getCurrentUserProfileId,
  getUserLightningPreference,
  getLayoutAssignment,
  resolveObjectApiNameFromRecord,
  _resetCaches
} from './record-context'
import { sfRest } from './auth'
import { isApiAvailable } from './salesforce-api'

const TEST_HOST = 'myorg.my.salesforce.com'

describe('record-context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _resetCaches()
  })

  describe('fetchRecordTypeId', () => {
    it('should return record type ID from sfRest', async () => {
      vi.mocked(sfRest).mockResolvedValueOnce({ RecordTypeId: '012xxx' })
      const result = await fetchRecordTypeId(TEST_HOST, 'Account', '001xxx')
      expect(result).toBe('012xxx')
    })

    it('should return null when sfRest throws', async () => {
      vi.mocked(sfRest).mockRejectedValueOnce(new Error('fail'))
      const result = await fetchRecordTypeId(TEST_HOST, 'Account', '001xxx')
      expect(result).toBeNull()
    })

    it('should return null when no RecordTypeId in response', async () => {
      vi.mocked(sfRest).mockResolvedValueOnce({})
      const result = await fetchRecordTypeId(TEST_HOST, 'Account', '001xxx')
      expect(result).toBeNull()
    })
  })

  describe('getCurrentUserId', () => {
    it('should return user ID from anonymous Apex execution', async () => {
      vi.mocked(sfRest).mockResolvedValueOnce({
        exceptionMessage: 'System.TypeException: 005xx000001234'
      })
      const result = await getCurrentUserId(TEST_HOST)
      expect(result).toBe('005xx000001234')
    })

    it('should return null when API is not available', async () => {
      vi.mocked(isApiAvailable).mockReturnValueOnce(false)
      const result = await getCurrentUserId(TEST_HOST)
      expect(result).toBeNull()
    })

    it('should cache user ID across calls', async () => {
      vi.mocked(sfRest).mockResolvedValueOnce({
        exceptionMessage: 'System.TypeException: 005xx000001234'
      })
      await getCurrentUserId(TEST_HOST)
      const result = await getCurrentUserId(TEST_HOST)
      expect(result).toBe('005xx000001234')
      expect(sfRest).toHaveBeenCalledTimes(1)
    })
  })

  describe('getCurrentUserProfileId', () => {
    it('should return profile ID from User query', async () => {
      // First call: getCurrentUserId
      vi.mocked(sfRest).mockResolvedValueOnce({
        exceptionMessage: 'System.TypeException: 005xx000001234'
      })
      // Second call: profile query
      vi.mocked(sfRest).mockResolvedValueOnce({
        records: [{ ProfileId: '00exx000001234' }]
      })
      const result = await getCurrentUserProfileId(TEST_HOST)
      expect(result).toBe('00exx000001234')
    })
  })

  describe('getUserLightningPreference', () => {
    it('should return boolean preference', async () => {
      // getCurrentUserId
      vi.mocked(sfRest).mockResolvedValueOnce({
        exceptionMessage: 'System.TypeException: 005xx000001234'
      })
      // preference query
      vi.mocked(sfRest).mockResolvedValueOnce({
        records: [{ UserPreferencesLightningExperiencePreferred: true }]
      })
      const result = await getUserLightningPreference(TEST_HOST)
      expect(result).toBe(true)
    })

    it('should default to true when user ID not available', async () => {
      vi.mocked(isApiAvailable).mockReturnValueOnce(false)
      const result = await getUserLightningPreference(TEST_HOST)
      expect(result).toBe(true)
    })
  })

  describe('getLayoutAssignment', () => {
    it('should return layout ID and object durable ID', async () => {
      // EntityDefinition query
      vi.mocked(sfRest).mockResolvedValueOnce({
        records: [{ DurableId: 'Account' }]
      })
      // ProfileLayout query
      vi.mocked(sfRest).mockResolvedValueOnce({
        records: [{ LayoutId: '00hxx000001234' }]
      })
      const result = await getLayoutAssignment(TEST_HOST, 'Account', '00exx000001234', null)
      expect(result).toEqual({ layoutId: '00hxx000001234', objectDurableId: 'Account' })
    })

    it('should return null when EntityDefinition not found', async () => {
      vi.mocked(sfRest).mockResolvedValueOnce({ records: [] })
      const result = await getLayoutAssignment(TEST_HOST, 'Unknown', '00exx', null)
      expect(result).toBeNull()
    })
  })

  describe('resolveObjectApiNameFromRecord', () => {
    it('should resolve from KEY_PREFIX_MAP for known prefix', async () => {
      const result = await resolveObjectApiNameFromRecord(TEST_HOST, '001xxx')
      expect(result).toBe('Account')
      expect(sfRest).not.toHaveBeenCalled()
    })

    it('should call sfRest global describe for unknown prefix', async () => {
      vi.mocked(sfRest).mockResolvedValueOnce({
        sobjects: [
          { keyPrefix: 'a00', name: 'MyCustomObj__c' },
          { keyPrefix: '001', name: 'Account' }
        ]
      })
      const result = await resolveObjectApiNameFromRecord(TEST_HOST, 'a00xxx')
      expect(result).toBe('MyCustomObj__c')
    })

    it('should return null for unknown prefix when describe fails', async () => {
      vi.mocked(sfRest).mockRejectedValueOnce(new Error('fail'))
      const result = await resolveObjectApiNameFromRecord(TEST_HOST, 'zzzxxx')
      expect(result).toBeNull()
    })
  })
})
