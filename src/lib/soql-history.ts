const SOQL_HISTORY_KEY = 'ultraforce_soql_history'
const MAX_HISTORY_SIZE = 50

export interface SOQLHistoryItem {
  query: string
  timestamp: number
  resultCount?: number
}

export async function getSOQLHistory(): Promise<SOQLHistoryItem[]> {
  try {
    const result = await chrome.storage.local.get([SOQL_HISTORY_KEY])
    return result[SOQL_HISTORY_KEY] || []
  } catch {
    return []
  }
}

export async function addSOQLHistory(query: string, resultCount?: number): Promise<void> {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) return

  try {
    const history = await getSOQLHistory()

    const existingIndex = history.findIndex(
      (item) => item.query.toLowerCase() === trimmedQuery.toLowerCase()
    )
    if (existingIndex !== -1) {
      history.splice(existingIndex, 1)
    }

    history.unshift({
      query: trimmedQuery,
      timestamp: Date.now(),
      resultCount
    })

    if (history.length > MAX_HISTORY_SIZE) {
      history.length = MAX_HISTORY_SIZE
    }

    await chrome.storage.local.set({ [SOQL_HISTORY_KEY]: history })
  } catch {
    // ignore
  }
}

export async function removeSOQLHistoryItem(query: string): Promise<void> {
  try {
    const history = await getSOQLHistory()
    const filtered = history.filter(
      (item) => item.query.toLowerCase() !== query.toLowerCase()
    )
    await chrome.storage.local.set({ [SOQL_HISTORY_KEY]: filtered })
  } catch {
    // ignore
  }
}

export async function clearSOQLHistory(): Promise<void> {
  try {
    await chrome.storage.local.remove(SOQL_HISTORY_KEY)
  } catch {
    // ignore
  }
}

export function formatHistoryTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`

  const date = new Date(timestamp)
  return date.toLocaleDateString()
}
