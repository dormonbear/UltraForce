// History store - tracks recently visited items with frecency scoring
// Frecency = frequency * recency decay, inspired by Firefox's URL bar algorithm

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PersistStorage } from 'zustand/middleware'
import { STORAGE_KEYS, storageGet, storageSet, storageRemove } from '~lib/storage-service'

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

const chromeHistoryStorage: PersistStorage<Partial<HistoryState>> = {
  getItem: async (name) => {
    const value = await storageGet<Partial<HistoryState>>(name)
    if (!value) return null
    return { state: value }
  },
  setItem: async (name, value) => {
    await storageSet(name, value.state)
  },
  removeItem: async (name) => {
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
      name: STORAGE_KEYS.HISTORY,
      storage: chromeHistoryStorage,
      partialize: ({ items }) => ({ items })
    }
  )
)
