import { STORAGE_KEYS, storageGet, storageSet, storageRemove, type ApiStatsData } from './storage-service'

async function loadStats(): Promise<ApiStatsData> {
  const stored = await storageGet<ApiStatsData>(STORAGE_KEYS.API_STATS)
  if (!stored) {
    return { totalRequests: 0, requestLog: [] }
  }
  return {
    totalRequests: stored.totalRequests || 0,
    requestLog: stored.requestLog || []
  }
}

async function saveStats(stats: ApiStatsData): Promise<void> {
  try {
    await storageSet(STORAGE_KEYS.API_STATS, stats)
  } catch {
    // Ignore storage errors for stats
  }
}

export async function trackApiRequest(): Promise<void> {
  const stats = await loadStats()
  const now = Date.now()

  stats.totalRequests++
  stats.requestLog.push(now)

  // Keep only last 30 days of logs to prevent storage bloat
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000
  stats.requestLog = stats.requestLog.filter(t => t > thirtyDaysAgo)

  await saveStats(stats)
}

export interface ApiStatsDisplay {
  total: number
  last24h: number
  lastMonth: number
}

export async function getApiStats(): Promise<ApiStatsDisplay> {
  const stats = await loadStats()
  const now = Date.now()
  const oneDayAgo = now - 24 * 60 * 60 * 1000
  const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000

  const last24h = stats.requestLog.filter(t => t > oneDayAgo).length
  const lastMonth = stats.requestLog.filter(t => t > oneMonthAgo).length

  return {
    total: stats.totalRequests,
    last24h,
    lastMonth
  }
}

export async function resetAllStats(): Promise<void> {
  await storageRemove(STORAGE_KEYS.API_STATS)
}
