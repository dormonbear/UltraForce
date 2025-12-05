import { logger } from './logger'

const CACHE_CONFIG = {
  TTL: 24 * 60 * 60 * 1000,
  REFRESH_THRESHOLD: 2 * 60 * 60 * 1000,
  MAX_CACHE_SIZE: 10 * 1024 * 1024,
  VERSION: '1.1'
}

interface CacheItem {
  data: any[]
  timestamp: number
  version: string
  orgId: string
  metadataType: string
  hash: string
}

function getCacheKey(orgId: string, metadataType: string): string {
  return `metadata_${orgId}_${metadataType}`
}

function generateDataHash(data: any[]): string {
  const str = JSON.stringify(data.map((item) => ({ id: item.Id, name: item.Name })))
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return hash.toString(16)
}

export class MetadataCache {
  private static instance: MetadataCache
  private refreshPromises = new Map<string, Promise<any[]>>()

  private constructor() {}

  static getInstance(): MetadataCache {
    if (!MetadataCache.instance) {
      MetadataCache.instance = new MetadataCache()
    }
    return MetadataCache.instance
  }

  async get(orgId: string, metadataType: string): Promise<any[] | null> {
    try {
      const key = getCacheKey(orgId, metadataType)
      const result = await chrome.storage.local.get(key)
      const cacheItem: CacheItem | undefined = result[key]

      if (!cacheItem) return null

      if (cacheItem.version !== CACHE_CONFIG.VERSION) {
        await this.delete(orgId, metadataType)
        return null
      }

      const age = Date.now() - cacheItem.timestamp

      if (age > CACHE_CONFIG.TTL) {
        await this.delete(orgId, metadataType)
        return null
      }

      if (age > CACHE_CONFIG.REFRESH_THRESHOLD) {
        this.triggerBackgroundRefresh(orgId, metadataType)
      }

      return cacheItem.data
    } catch (error) {
      logger.error('cache:get', { orgId, metadataType, error })
      return null
    }
  }

  async set(orgId: string, metadataType: string, data: any[]): Promise<void> {
    try {
      const key = getCacheKey(orgId, metadataType)
      const cacheItem: CacheItem = {
        data,
        timestamp: Date.now(),
        version: CACHE_CONFIG.VERSION,
        orgId,
        metadataType,
        hash: generateDataHash(data)
      }

      await chrome.storage.local.set({ [key]: cacheItem })
      await this.cleanupIfNeeded()
    } catch (error) {
      logger.error('cache:set', { orgId, metadataType, error })
    }
  }

  async delete(orgId: string, metadataType: string): Promise<void> {
    try {
      await chrome.storage.local.remove(getCacheKey(orgId, metadataType))
    } catch (error) {
      logger.error('cache:delete', { orgId, metadataType, error })
    }
  }

  async clear(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(null)
      const keysToRemove = Object.keys(result).filter((key) => key.startsWith('metadata_'))
      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove)
      }
    } catch (error) {
      logger.error('cache:clear', { error })
    }
  }

  async getStats(): Promise<{
    totalEntries: number
    totalSize: number
    entries: Array<{
      key: string
      orgId: string
      metadataType: string
      itemCount: number
      age: number
      size: number
    }>
  }> {
    try {
      const result = await chrome.storage.local.get(null)
      const cacheEntries = Object.entries(result)
        .filter(([key]) => key.startsWith('metadata_'))
        .map(([key, value]: [string, any]) => {
          const cacheItem = value as CacheItem
          return {
            key,
            orgId: cacheItem.orgId,
            metadataType: cacheItem.metadataType,
            itemCount: cacheItem.data.length,
            age: Date.now() - cacheItem.timestamp,
            size: JSON.stringify(value).length
          }
        })

      return {
        totalEntries: cacheEntries.length,
        totalSize: cacheEntries.reduce((sum, entry) => sum + entry.size, 0),
        entries: cacheEntries.sort((a, b) => b.age - a.age)
      }
    } catch (error) {
      logger.error('cache:stats', { error })
      return { totalEntries: 0, totalSize: 0, entries: [] }
    }
  }

  private triggerBackgroundRefresh(orgId: string, metadataType: string): void {
    const key = `${orgId}_${metadataType}`
    if (this.refreshPromises.has(key)) return

    const refreshPromise = new Promise<any[]>((resolve) => {
      setTimeout(() => {
        try {
          document.dispatchEvent(
            new CustomEvent('metadataRefreshRequest', { detail: { orgId, metadataType } })
          )
        } finally {
          this.refreshPromises.delete(key)
        }
        resolve([])
      }, 1000)
    })

    this.refreshPromises.set(key, refreshPromise)
  }

  private async cleanupIfNeeded(): Promise<void> {
    try {
      const stats = await this.getStats()
      if (stats.totalSize <= CACHE_CONFIG.MAX_CACHE_SIZE) return

      const sortedEntries = stats.entries.sort((a, b) => b.age - a.age)
      let currentSize = stats.totalSize

      for (const entry of sortedEntries) {
        if (currentSize <= CACHE_CONFIG.MAX_CACHE_SIZE * 0.8) break
        await chrome.storage.local.remove(entry.key)
        currentSize -= entry.size
      }
    } catch (error) {
      logger.error('cache:cleanup', { error })
    }
  }

  async warmup(orgId: string, metadataTypes: string[]): Promise<void> {
    document.dispatchEvent(
      new CustomEvent('metadataWarmupRequest', { detail: { orgId, metadataTypes } })
    )
  }
}
