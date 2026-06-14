// History store - tracks recently visited items with frecency scoring
// Frecency = frequency * recency decay, inspired by Firefox's URL bar algorithm

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PersistStorage } from 'zustand/middleware'
import {
  STORAGE_KEYS,
  PENDING_HISTORY_KEY,
  historyKey,
  storageGet,
  storageSet,
  storageRemove
} from '~lib/storage-service'
import { logger } from '~lib/logger'

export interface HistoryItem {
  id: string
  name: string
  type: string
  url: string
  description?: string
  visitCount: number
  lastVisitedAt: number
  firstVisitedAt: number
}

interface HistoryState {
  items: HistoryItem[]
}

interface HistoryActions {
  /** Record a visit to an item. Creates or updates the entry. */
  recordVisit: (item: Omit<HistoryItem, 'visitCount' | 'lastVisitedAt' | 'firstVisitedAt'>) => void
  /** Remove a single item from history. */
  removeItem: (id: string) => void
  /** Clear all history. */
  clearHistory: () => void
}

export type HistoryStore = HistoryState & HistoryActions

const MAX_HISTORY_ITEMS = 200
const DECAY_HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

/**
 * Calculate frecency score for ranking.
 * Higher score = more relevant (visited often + visited recently).
 */
export function calculateFrecency(item: HistoryItem, now: number = Date.now()): number {
  const ageMs = now - item.lastVisitedAt
  const decayFactor = Math.pow(0.5, ageMs / DECAY_HALF_LIFE_MS)
  return item.visitCount * decayFactor
}

/** Sort items by frecency score (highest first). */
export function sortByFrecency(items: HistoryItem[], now: number = Date.now()): HistoryItem[] {
  return [...items].sort((a, b) => calculateFrecency(b, now) - calculateFrecency(a, now))
}

/** Sort items by last visit time (most recent first). */
export function sortByLastVisited(items: HistoryItem[]): HistoryItem[] {
  return [...items].sort((a, b) => b.lastVisitedAt - a.lastVisitedAt)
}

// Writes/reads no-op while persist name is still the pending placeholder (sfHost unknown).
// Once setHistoryOrgScope() is called the placeholder is swapped for a host-scoped key.
const chromeHistoryStorage: PersistStorage<Partial<HistoryState>> = {
  getItem: async (name) => {
    if (name === PENDING_HISTORY_KEY) return null
    const value = await storageGet<Partial<HistoryState>>(name)
    if (!value) return null
    return { state: value }
  },
  setItem: async (name, value) => {
    if (name === PENDING_HISTORY_KEY) return
    await storageSet(name, value.state)
  },
  removeItem: async (name) => {
    if (name === PENDING_HISTORY_KEY) return
    await storageRemove(name)
  }
}

export const useHistoryStore = create<HistoryStore>()(
  persist(
    (set) => ({
      items: [],

      recordVisit: (item) =>
        set((state) => {
          const now = Date.now()
          const existing = state.items.find((i) => i.id === item.id && i.type === item.type)

          let updated: HistoryItem[]
          if (existing) {
            updated = state.items.map((i) =>
              i.id === item.id && i.type === item.type
                ? {
                    ...i,
                    name: item.name,
                    url: item.url,
                    description: item.description ?? i.description,
                    visitCount: i.visitCount + 1,
                    lastVisitedAt: now
                  }
                : i
            )
          } else {
            const newItem: HistoryItem = {
              ...item,
              visitCount: 1,
              lastVisitedAt: now,
              firstVisitedAt: now
            }
            updated = [newItem, ...state.items]
          }

          // Trim to max size, keeping highest frecency items
          if (updated.length > MAX_HISTORY_ITEMS) {
            updated = sortByFrecency(updated, now).slice(0, MAX_HISTORY_ITEMS)
          }

          return { items: updated }
        }),

      removeItem: (id) =>
        set((state) => ({
          items: state.items.filter((i) => i.id !== id)
        })),

      clearHistory: () => set({ items: [] })
    }),
    {
      name: PENDING_HISTORY_KEY,
      storage: chromeHistoryStorage,
      partialize: ({ items }) => ({ items }),
      // Force items to come entirely from the new scope. Without this, switching
      // to an unpersisted org would leave the previous org's items in memory
      // (default merge keeps currentState fields when persistedState is empty).
      merge: (persistedState, currentState) => ({
        ...currentState,
        items: (persistedState as { items?: HistoryItem[] } | undefined)?.items ?? []
      })
    }
  )
)

let currentHistoryHost: string | null = null

/**
 * Bind the history store to a specific Salesforce host. Must be called once the
 * sfHost is known (typically from WindowManager.loadSession). Subsequent reads
 * and writes use a host-scoped storage key, isolating recents across orgs.
 *
 * Performs a one-time migration: if the legacy global key exists and the
 * host-scoped key does not, the legacy data is moved into the current host's
 * key. This preserves single-org users' existing history.
 */
export async function setHistoryOrgScope(host: string): Promise<void> {
  if (!host) return
  if (currentHistoryHost === host) return
  currentHistoryHost = host

  const scopedKey = historyKey(host)

  // One-time migration from legacy global key.
  try {
    const scopedExisting = await storageGet<Partial<HistoryState>>(scopedKey)
    if (!scopedExisting) {
      const legacy = await storageGet<Partial<HistoryState>>(STORAGE_KEYS.HISTORY)
      if (legacy && Array.isArray(legacy.items) && legacy.items.length > 0) {
        await storageSet(scopedKey, legacy)
        await storageRemove(STORAGE_KEYS.HISTORY)
        logger.info('history:migrated legacy global key', { host, count: legacy.items.length })
      }
    }
  } catch (error) {
    logger.error('history:migration failed', { host, error })
  }

  // setOptions must come before rehydrate; the custom merge handles clearing
  // items when the new scope has no persisted data.
  useHistoryStore.persist.setOptions({ name: scopedKey })
  await useHistoryStore.persist.rehydrate()
}

/** Test-only helper: forget the bound host so setHistoryOrgScope can be re-applied. */
export function _resetHistoryOrgScope(): void {
  currentHistoryHost = null
}
