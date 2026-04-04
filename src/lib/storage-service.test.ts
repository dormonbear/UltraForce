import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  STORAGE_KEYS,
  metadataCacheKey,
  storageGet,
  storageSet,
  storageRemove,
  storageGetAll,
  onStorageChanged,
  offStorageChanged
} from './storage-service'

describe('storage-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    chrome.storage.local.get.mockResolvedValue({})
    chrome.storage.local.set.mockResolvedValue(undefined)
    chrome.storage.local.remove.mockResolvedValue(undefined)
  })

  describe('STORAGE_KEYS', () => {
    it('should export all expected key constants', () => {
      expect(STORAGE_KEYS.SEARCH_SETTINGS).toBe('ultraforce_search_settings')
      expect(STORAGE_KEYS.UNSUPPORTED_TYPES).toBe('ultraforce_unsupported_types')
      expect(STORAGE_KEYS.API_STATS).toBe('ultraforce_api_stats')
      expect(STORAGE_KEYS.VERSION_CHECK).toBe('ultraforce_version_check')
      expect(STORAGE_KEYS.ERROR_LOGS).toBe('ultraforce_error_logs')
      expect(STORAGE_KEYS.LEGACY_SETTINGS).toBe('settings')
    })
  })

  describe('metadataCacheKey', () => {
    it('should build dynamic cache key from orgId and type', () => {
      expect(metadataCacheKey('org123', 'ApexClass')).toBe('metadata_org123_ApexClass')
    })

    it('should handle various orgId and type combinations', () => {
      expect(metadataCacheKey('00D000000000001', 'Flow')).toBe('metadata_00D000000000001_Flow')
      expect(metadataCacheKey('org', 'CustomObject')).toBe('metadata_org_CustomObject')
    })
  })

  describe('storageGet', () => {
    it('should return value for existing key', async () => {
      chrome.storage.local.get.mockResolvedValue({
        ultraforce_api_stats: { totalRequests: 42, requestLog: [] }
      })

      const result = await storageGet<{ totalRequests: number }>('ultraforce_api_stats')

      expect(chrome.storage.local.get).toHaveBeenCalledWith(['ultraforce_api_stats'])
      expect(result).toEqual({ totalRequests: 42, requestLog: [] })
    })

    it('should return undefined for missing key', async () => {
      chrome.storage.local.get.mockResolvedValue({})

      const result = await storageGet('nonexistent_key')

      expect(result).toBeUndefined()
    })

    it('should return undefined on storage error', async () => {
      chrome.storage.local.get.mockRejectedValue(new Error('quota exceeded'))

      const result = await storageGet('some_key')

      expect(result).toBeUndefined()
    })
  })

  describe('storageSet', () => {
    it('should write value to chrome.storage.local', async () => {
      await storageSet('ultraforce_api_stats', { totalRequests: 1, requestLog: [] })

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        ultraforce_api_stats: { totalRequests: 1, requestLog: [] }
      })
    })

    it('should throw on storage error so callers can handle quota', async () => {
      chrome.storage.local.set.mockRejectedValue(new Error('quota exceeded'))

      await expect(storageSet('key', 'value')).rejects.toThrow('quota exceeded')
    })
  })

  describe('storageRemove', () => {
    it('should remove single key', async () => {
      await storageRemove('ultraforce_api_stats')

      expect(chrome.storage.local.remove).toHaveBeenCalledWith('ultraforce_api_stats')
    })

    it('should remove multiple keys', async () => {
      await storageRemove(['key1', 'key2'])

      expect(chrome.storage.local.remove).toHaveBeenCalledWith(['key1', 'key2'])
    })

    it('should not throw on storage error', async () => {
      chrome.storage.local.remove.mockRejectedValue(new Error('error'))

      await expect(storageRemove('key')).resolves.toBeUndefined()
    })
  })

  describe('storageGetAll', () => {
    it('should return all storage entries', async () => {
      const allData = {
        metadata_org1_ApexClass: { data: [] },
        ultraforce_search_settings: { fuzzySearch: true }
      }
      chrome.storage.local.get.mockResolvedValue(allData)

      const result = await storageGetAll()

      expect(chrome.storage.local.get).toHaveBeenCalledWith(null)
      expect(result).toEqual(allData)
    })

    it('should return empty object on error', async () => {
      chrome.storage.local.get.mockRejectedValue(new Error('error'))

      const result = await storageGetAll()

      expect(result).toEqual({})
    })
  })

  describe('onStorageChanged / offStorageChanged', () => {
    it('should register listener on chrome.storage.onChanged', () => {
      const callback = vi.fn()
      chrome.storage.onChanged.addListener = vi.fn()

      onStorageChanged(callback)

      expect(chrome.storage.onChanged.addListener).toHaveBeenCalledWith(expect.any(Function))
    })

    it('should filter to local area only', () => {
      const callback = vi.fn()
      let registeredListener: Function

      chrome.storage.onChanged.addListener = vi.fn((fn) => {
        registeredListener = fn
      })

      onStorageChanged(callback)

      // Simulate local change
      registeredListener!({ key: { newValue: 'v' } }, 'local')
      expect(callback).toHaveBeenCalledTimes(1)

      // Simulate sync change - should be filtered out
      registeredListener!({ key: { newValue: 'v' } }, 'sync')
      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('should unregister listener via offStorageChanged', () => {
      const callback = vi.fn()
      let registeredWrapper: Function

      chrome.storage.onChanged.addListener = vi.fn((fn) => {
        registeredWrapper = fn
      })
      chrome.storage.onChanged.removeListener = vi.fn()

      onStorageChanged(callback)
      offStorageChanged(callback)

      expect(chrome.storage.onChanged.removeListener).toHaveBeenCalledWith(registeredWrapper!)
    })

    it('should handle offStorageChanged for unregistered callback gracefully', () => {
      chrome.storage.onChanged.removeListener = vi.fn()

      offStorageChanged(vi.fn())

      expect(chrome.storage.onChanged.removeListener).not.toHaveBeenCalled()
    })
  })
})
