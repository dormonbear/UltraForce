import { trackApiRequest, getApiStats, resetAllStats } from './api-stats'
import { STORAGE_KEYS } from './storage-service'

describe('api-stats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    chrome.storage.local.get.mockResolvedValue({})
    chrome.storage.local.set.mockResolvedValue(undefined)
    chrome.storage.local.remove.mockResolvedValue(undefined)
  })

  describe('trackApiRequest', () => {
    it('should create new stats when none exist', async () => {
      await trackApiRequest()
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          [STORAGE_KEYS.API_STATS]: expect.objectContaining({
            totalRequests: 1,
            requestLog: expect.arrayContaining([expect.any(Number)])
          })
        })
      )
    })

    it('should increment existing stats', async () => {
      const existing = { totalRequests: 5, requestLog: [Date.now()] }
      chrome.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.API_STATS]: existing
      })

      await trackApiRequest()
      const saved = (chrome.storage.local.set as any).mock.calls[0][0][STORAGE_KEYS.API_STATS]
      expect(saved.totalRequests).toBe(6)
      expect(saved.requestLog).toHaveLength(2)
    })

    it('should prune request logs older than 30 days', async () => {
      const now = Date.now()
      const oldTimestamp = now - 31 * 24 * 60 * 60 * 1000
      const recentTimestamp = now - 1000
      const existing = { totalRequests: 2, requestLog: [oldTimestamp, recentTimestamp] }
      chrome.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.API_STATS]: existing
      })

      await trackApiRequest()
      const saved = (chrome.storage.local.set as any).mock.calls[0][0][STORAGE_KEYS.API_STATS]
      expect(saved.requestLog).toHaveLength(2) // recentTimestamp + new one
      expect(saved.requestLog).not.toContain(oldTimestamp)
    })

    it('should handle storage set failure silently', async () => {
      chrome.storage.local.set.mockRejectedValue(new Error('quota'))
      await expect(trackApiRequest()).resolves.toBeUndefined()
    })

    it('should handle missing fields in stored data', async () => {
      chrome.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.API_STATS]: {}
      })
      await trackApiRequest()
      const saved = (chrome.storage.local.set as any).mock.calls[0][0][STORAGE_KEYS.API_STATS]
      expect(saved.totalRequests).toBe(1)
      expect(saved.requestLog).toHaveLength(1)
    })
  })

  describe('getApiStats', () => {
    it('should return zero stats when nothing stored', async () => {
      const stats = await getApiStats()
      expect(stats).toEqual({ total: 0, last24h: 0, lastMonth: 0 })
    })

    it('should compute last24h and lastMonth from requestLog', async () => {
      const now = Date.now()
      const oneHourAgo = now - 60 * 60 * 1000
      const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000
      const existing = {
        totalRequests: 10,
        requestLog: [oneHourAgo, threeDaysAgo]
      }
      chrome.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.API_STATS]: existing
      })

      const stats = await getApiStats()
      expect(stats.total).toBe(10)
      expect(stats.last24h).toBe(1)
      expect(stats.lastMonth).toBe(2)
    })
  })

  describe('resetAllStats', () => {
    it('should remove stats from storage', async () => {
      await resetAllStats()
      expect(chrome.storage.local.remove).toHaveBeenCalledWith(STORAGE_KEYS.API_STATS)
    })
  })
})
