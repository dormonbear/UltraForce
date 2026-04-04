import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MetadataCache } from './metadata-cache'

describe('MetadataCache', () => {
  let cache: MetadataCache

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    chrome.storage.local.get.mockReset()
    chrome.storage.local.set.mockReset()
    chrome.storage.local.remove.mockReset()
    chrome.storage.local.get.mockResolvedValue({})
    chrome.storage.local.set.mockResolvedValue(undefined)
    chrome.storage.local.remove.mockResolvedValue(undefined)

    // Reset singleton by accessing private static field
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(MetadataCache as any).instance = undefined
    cache = MetadataCache.getInstance()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = MetadataCache.getInstance()
      const instance2 = MetadataCache.getInstance()
      expect(instance1).toBe(instance2)
    })
  })

  describe('get', () => {
    it('should return null for cache miss', async () => {
      chrome.storage.local.get.mockResolvedValue({})

      const result = await cache.get('org123', 'ApexClass')
      expect(result).toBeNull()
    })

    it('should return cached data when fresh (within 24h TTL)', async () => {
      const mockData = [{ Id: '001', Name: 'MyClass' }]
      const cacheKey = 'metadata_org123_ApexClass'

      chrome.storage.local.get.mockResolvedValue({
        [cacheKey]: {
          data: mockData,
          timestamp: Date.now() - 60 * 1000, // 1 minute ago
          version: '1.2',
          orgId: 'org123',
          metadataType: 'ApexClass',
          hash: 'abc123'
        }
      })

      const result = await cache.get('org123', 'ApexClass')
      expect(result).toEqual(mockData)
    })

    it('should return null and delete when TTL expired (>24h)', async () => {
      const cacheKey = 'metadata_org123_ApexClass'
      const TTL = 24 * 60 * 60 * 1000

      chrome.storage.local.get.mockResolvedValue({
        [cacheKey]: {
          data: [{ Id: '001' }],
          timestamp: Date.now() - TTL - 1000, // 24h + 1s ago
          version: '1.2',
          orgId: 'org123',
          metadataType: 'ApexClass',
          hash: 'abc'
        }
      })

      const result = await cache.get('org123', 'ApexClass')
      expect(result).toBeNull()
      expect(chrome.storage.local.remove).toHaveBeenCalledWith(cacheKey)
    })

    it('should return data and trigger background refresh when stale (>2h but <24h)', async () => {
      const cacheKey = 'metadata_org123_ApexClass'
      const REFRESH_THRESHOLD = 2 * 60 * 60 * 1000
      const mockData = [{ Id: '001' }]

      chrome.storage.local.get.mockResolvedValue({
        [cacheKey]: {
          data: mockData,
          timestamp: Date.now() - REFRESH_THRESHOLD - 1000, // 2h + 1s ago
          version: '1.2',
          orgId: 'org123',
          metadataType: 'ApexClass',
          hash: 'abc'
        }
      })

      // Spy on document.dispatchEvent to detect refresh trigger
      const dispatchSpy = vi.spyOn(document, 'dispatchEvent')

      const result = await cache.get('org123', 'ApexClass')
      expect(result).toEqual(mockData)

      // Advance timer to trigger the background refresh setTimeout
      vi.advanceTimersByTime(1100)

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'metadataRefreshRequest',
          detail: { orgId: 'org123', metadataType: 'ApexClass' }
        })
      )

      dispatchSpy.mockRestore()
    })

    it('should return null when version mismatch', async () => {
      const cacheKey = 'metadata_org123_ApexClass'

      chrome.storage.local.get.mockResolvedValue({
        [cacheKey]: {
          data: [{ Id: '001' }],
          timestamp: Date.now(),
          version: '0.9', // Outdated version
          orgId: 'org123',
          metadataType: 'ApexClass',
          hash: 'abc'
        }
      })

      const result = await cache.get('org123', 'ApexClass')
      expect(result).toBeNull()
    })

    it('should return null on storage error', async () => {
      chrome.storage.local.get.mockRejectedValue(new Error('Storage error'))

      const result = await cache.get('org123', 'ApexClass')
      expect(result).toBeNull()
    })
  })

  describe('set', () => {
    it('should store data in chrome.storage.local', async () => {
      const data = [{ Id: '001', Name: 'Test' }]

      await cache.set('org123', 'ApexClass', data)

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata_org123_ApexClass: expect.objectContaining({
            data,
            version: '1.2',
            orgId: 'org123',
            metadataType: 'ApexClass'
          })
        })
      )
    })

    it('should strip Value field for CustomLabel type', async () => {
      const data = [
        { Id: '001', Name: 'MyLabel', Value: 'Some long value text', MasterLabel: 'My Label' }
      ]

      await cache.set('org123', 'CustomLabel', data)

      const setCall = chrome.storage.local.set.mock.calls[0][0]
      const storedData = setCall.metadata_org123_CustomLabel.data
      expect(storedData[0]).not.toHaveProperty('Value')
      expect(storedData[0]).toHaveProperty('Name', 'MyLabel')
    })

    it('should handle quota exceeded by cleaning old entries and retrying', async () => {
      // First set call fails with quota error
      chrome.storage.local.set
        .mockRejectedValueOnce(new Error('QUOTA_BYTES_PER_ITEM quota exceeded'))
        .mockResolvedValueOnce(undefined) // retry succeeds

      // getStats needs data for cleanup
      chrome.storage.local.get.mockResolvedValue({
        metadata_org123_OldType: {
          data: [],
          timestamp: Date.now() - 20 * 60 * 60 * 1000,
          version: '1.2',
          orgId: 'org123',
          metadataType: 'OldType',
          hash: 'old'
        }
      })

      await cache.set('org123', 'ApexClass', [{ Id: '001' }])

      // Should have called remove for cleanup
      expect(chrome.storage.local.remove).toHaveBeenCalled()
      // Should have retried set
      expect(chrome.storage.local.set).toHaveBeenCalledTimes(2)
    })
  })

  describe('clear', () => {
    it('should remove all metadata_ prefixed keys', async () => {
      chrome.storage.local.get.mockResolvedValue({
        metadata_org1_ApexClass: {},
        metadata_org1_Flow: {},
        ultraforce_search_settings: {},
        metadata_org2_User: {}
      })

      await cache.clear()

      expect(chrome.storage.local.remove).toHaveBeenCalledWith([
        'metadata_org1_ApexClass',
        'metadata_org1_Flow',
        'metadata_org2_User'
      ])
    })

    it('should not call remove when no cache entries exist', async () => {
      chrome.storage.local.get.mockResolvedValue({
        ultraforce_search_settings: {}
      })

      await cache.clear()

      expect(chrome.storage.local.remove).not.toHaveBeenCalled()
    })
  })

  describe('delete', () => {
    it('should remove specific cache entry', async () => {
      await cache.delete('org123', 'ApexClass')

      expect(chrome.storage.local.remove).toHaveBeenCalledWith('metadata_org123_ApexClass')
    })
  })

  describe('triggerBackgroundRefresh', () => {
    it('should deduplicate concurrent refresh calls for same key', async () => {
      const cacheKey = 'metadata_org123_ApexClass'
      const REFRESH_THRESHOLD = 2 * 60 * 60 * 1000
      const mockData = [{ Id: '001' }]

      chrome.storage.local.get.mockResolvedValue({
        [cacheKey]: {
          data: mockData,
          timestamp: Date.now() - REFRESH_THRESHOLD - 1000,
          version: '1.2',
          orgId: 'org123',
          metadataType: 'ApexClass',
          hash: 'abc'
        }
      })

      const dispatchSpy = vi.spyOn(document, 'dispatchEvent')

      // Call get twice -- both should trigger refresh for same key
      await cache.get('org123', 'ApexClass')
      await cache.get('org123', 'ApexClass')

      vi.advanceTimersByTime(1100)

      // Should only dispatch once due to deduplication
      const refreshEvents = dispatchSpy.mock.calls.filter(
        (call) => (call[0] as CustomEvent).type === 'metadataRefreshRequest'
      )
      expect(refreshEvents).toHaveLength(1)

      dispatchSpy.mockRestore()
    })
  })

  describe('getStats', () => {
    it('should return stats for all cache entries', async () => {
      chrome.storage.local.get.mockResolvedValue({
        metadata_org1_ApexClass: {
          data: [{ Id: '001' }, { Id: '002' }],
          timestamp: Date.now() - 3600000,
          version: '1.2',
          orgId: 'org1',
          metadataType: 'ApexClass',
          hash: 'abc'
        },
        ultraforce_search_settings: { some: 'settings' }
      })

      const stats = await cache.getStats()
      expect(stats.totalEntries).toBe(1)
      expect(stats.entries).toHaveLength(1)
      expect(stats.entries[0].orgId).toBe('org1')
      expect(stats.entries[0].metadataType).toBe('ApexClass')
      expect(stats.entries[0].itemCount).toBe(2)
    })

    it('should return empty stats when no cache entries', async () => {
      chrome.storage.local.get.mockResolvedValue({})

      const stats = await cache.getStats()
      expect(stats.totalEntries).toBe(0)
      expect(stats.entries).toHaveLength(0)
    })
  })
})
