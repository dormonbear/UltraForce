// Favorites store - pinned items shown on the modal home screen

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PersistStorage } from 'zustand/middleware'
import { STORAGE_KEYS, storageGet, storageSet, storageRemove } from '~lib/storage-service'

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

const chromeFavoritesStorage: PersistStorage<Partial<FavoritesState>> = {
  getItem: async (name) => {
    const value = await storageGet<Partial<FavoritesState>>(name)
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
      name: STORAGE_KEYS.FAVORITES,
      storage: chromeFavoritesStorage,
      partialize: ({ items }) => ({ items })
    }
  )
)
