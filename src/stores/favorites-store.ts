// Favorites store - pinned items shown on the modal home screen

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PersistStorage } from 'zustand/middleware'
import {
  STORAGE_KEYS,
  PENDING_FAVORITES_KEY,
  favoritesKey,
  storageGet,
  storageSet,
  storageRemove
} from '~lib/storage-service'
import { logger } from '~lib/logger'

export interface FavoriteItem {
  id: string
  name: string
  type: string
  url: string
  description?: string
  pinnedAt: number
}

interface FavoritesState {
  items: FavoriteItem[]
}

interface FavoritesActions {
  /** Add an item to favorites. No-op if already pinned. */
  addFavorite: (item: Omit<FavoriteItem, 'pinnedAt'>) => void
  /** Remove an item from favorites by id. */
  removeFavorite: (id: string) => void
  /** Check if an item is pinned. */
  isFavorite: (id: string) => boolean
  /** Toggle favorite status. Returns new pinned state. */
  toggleFavorite: (item: Omit<FavoriteItem, 'pinnedAt'>) => boolean
  /** Clear all favorites. */
  clearFavorites: () => void
}

export type FavoritesStore = FavoritesState & FavoritesActions

const MAX_FAVORITES = 20

// Writes/reads no-op while persist name is still the pending placeholder (sfHost unknown).
const chromeFavoritesStorage: PersistStorage<Partial<FavoritesState>> = {
  getItem: async (name) => {
    if (name === PENDING_FAVORITES_KEY) return null
    const value = await storageGet<Partial<FavoritesState>>(name)
    if (!value) return null
    return { state: value }
  },
  setItem: async (name, value) => {
    if (name === PENDING_FAVORITES_KEY) return
    await storageSet(name, value.state)
  },
  removeItem: async (name) => {
    if (name === PENDING_FAVORITES_KEY) return
    await storageRemove(name)
  }
}

export const useFavoritesStore = create<FavoritesStore>()(
  persist(
    (set, get) => ({
      items: [],

      addFavorite: (item) =>
        set((state) => {
          if (state.items.some((i) => i.id === item.id)) return state
          const newItem: FavoriteItem = { ...item, pinnedAt: Date.now() }
          const updated = [newItem, ...state.items].slice(0, MAX_FAVORITES)
          return { items: updated }
        }),

      removeFavorite: (id) =>
        set((state) => ({
          items: state.items.filter((i) => i.id !== id)
        })),

      isFavorite: (id) => get().items.some((i) => i.id === id),

      toggleFavorite: (item) => {
        const current = get()
        if (current.items.some((i) => i.id === item.id)) {
          set({ items: current.items.filter((i) => i.id !== item.id) })
          return false
        }
        const newItem: FavoriteItem = { ...item, pinnedAt: Date.now() }
        set({ items: [newItem, ...current.items].slice(0, MAX_FAVORITES) })
        return true
      },

      clearFavorites: () => set({ items: [] })
    }),
    {
      name: PENDING_FAVORITES_KEY,
      storage: chromeFavoritesStorage,
      partialize: ({ items }) => ({ items }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        items: (persistedState as { items?: FavoriteItem[] } | undefined)?.items ?? []
      })
    }
  )
)

let currentFavoritesHost: string | null = null

/**
 * Bind the favorites store to a specific Salesforce host. Mirrors setHistoryOrgScope:
 * isolates favorites across orgs, migrates legacy global key on first scope.
 */
export async function setFavoritesOrgScope(host: string): Promise<void> {
  if (!host) return
  if (currentFavoritesHost === host) return
  currentFavoritesHost = host

  const scopedKey = favoritesKey(host)

  try {
    const scopedExisting = await storageGet<Partial<FavoritesState>>(scopedKey)
    if (!scopedExisting) {
      const legacy = await storageGet<Partial<FavoritesState>>(STORAGE_KEYS.FAVORITES)
      if (legacy && Array.isArray(legacy.items) && legacy.items.length > 0) {
        await storageSet(scopedKey, legacy)
        await storageRemove(STORAGE_KEYS.FAVORITES)
        logger.info('favorites:migrated legacy global key', { host, count: legacy.items.length })
      }
    }
  } catch (error) {
    logger.error('favorites:migration failed', { host, error })
  }

  useFavoritesStore.persist.setOptions({ name: scopedKey })
  await useFavoritesStore.persist.rehydrate()
}

/** Test-only helper: forget the bound host so setFavoritesOrgScope can be re-applied. */
export function _resetFavoritesOrgScope(): void {
  currentFavoritesHost = null
}
