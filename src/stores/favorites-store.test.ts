import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  useFavoritesStore,
  setFavoritesOrgScope,
  _resetFavoritesOrgScope,
  type FavoriteItem
} from './favorites-store'

const fakeStore = new Map<string, unknown>()
const storageGetMock = vi.fn(async (key: string) => fakeStore.get(key))
const storageSetMock = vi.fn(async (key: string, value: unknown) => {
  fakeStore.set(key, value)
})
const storageRemoveMock = vi.fn(async (keys: string | string[]) => {
  const list = Array.isArray(keys) ? keys : [keys]
  list.forEach((k) => fakeStore.delete(k))
})

vi.mock('~lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

vi.mock('~lib/storage-service', () => ({
  STORAGE_KEYS: { FAVORITES: 'ultraforce_favorites' },
  PENDING_FAVORITES_KEY: 'ultraforce_favorites__pending',
  favoritesKey: (host: string) => `ultraforce_favorites__${host}`,
  storageGet: (k: string) => storageGetMock(k),
  storageSet: (k: string, v: unknown) => storageSetMock(k, v),
  storageRemove: (k: string | string[]) => storageRemoveMock(k)
}))

function makeFavorite(overrides: Partial<FavoriteItem> = {}): FavoriteItem {
  return {
    id: 'test-id',
    name: 'Test Item',
    type: 'ApexClass',
    url: 'https://example.com/test',
    pinnedAt: Date.now(),
    ...overrides
  }
}

describe('favorites-store', () => {
  beforeEach(() => {
    useFavoritesStore.setState({ items: [] })
    fakeStore.clear()
    storageGetMock.mockClear()
    storageSetMock.mockClear()
    storageRemoveMock.mockClear()
    _resetFavoritesOrgScope()
  })

  describe('addFavorite', () => {
    it('should add a new favorite', () => {
      useFavoritesStore.getState().addFavorite({
        id: '001',
        name: 'Account',
        type: 'CustomObject',
        url: '/setup/Account'
      })

      const { items } = useFavoritesStore.getState()
      expect(items).toHaveLength(1)
      expect(items[0].id).toBe('001')
      expect(items[0].pinnedAt).toBeGreaterThan(0)
    })

    it('should not duplicate existing favorites', () => {
      useFavoritesStore.getState().addFavorite({
        id: '001',
        name: 'Account',
        type: 'CustomObject',
        url: '/setup/Account'
      })
      useFavoritesStore.getState().addFavorite({
        id: '001',
        name: 'Account Updated',
        type: 'CustomObject',
        url: '/setup/Account'
      })

      expect(useFavoritesStore.getState().items).toHaveLength(1)
    })

    it('should prepend new favorites', () => {
      useFavoritesStore.getState().addFavorite({
        id: '001',
        name: 'First',
        type: 'CustomObject',
        url: '/1'
      })
      useFavoritesStore.getState().addFavorite({
        id: '002',
        name: 'Second',
        type: 'CustomObject',
        url: '/2'
      })

      const { items } = useFavoritesStore.getState()
      expect(items[0].id).toBe('002')
      expect(items[1].id).toBe('001')
    })

    it('should limit to MAX_FAVORITES', () => {
      for (let i = 0; i < 25; i++) {
        useFavoritesStore.getState().addFavorite({
          id: `id-${i}`,
          name: `Item ${i}`,
          type: 'ApexClass',
          url: `/item-${i}`
        })
      }

      expect(useFavoritesStore.getState().items.length).toBeLessThanOrEqual(20)
    })
  })

  describe('removeFavorite', () => {
    it('should remove a favorite by id', () => {
      useFavoritesStore.setState({
        items: [makeFavorite({ id: 'a' }), makeFavorite({ id: 'b' })]
      })

      useFavoritesStore.getState().removeFavorite('a')
      expect(useFavoritesStore.getState().items).toHaveLength(1)
      expect(useFavoritesStore.getState().items[0].id).toBe('b')
    })
  })

  describe('isFavorite', () => {
    it('should return true for pinned items', () => {
      useFavoritesStore.setState({
        items: [makeFavorite({ id: 'pinned' })]
      })

      expect(useFavoritesStore.getState().isFavorite('pinned')).toBe(true)
      expect(useFavoritesStore.getState().isFavorite('not-pinned')).toBe(false)
    })
  })

  describe('toggleFavorite', () => {
    it('should pin an unpinned item and return true', () => {
      const result = useFavoritesStore.getState().toggleFavorite({
        id: '001',
        name: 'Account',
        type: 'CustomObject',
        url: '/setup/Account'
      })

      expect(result).toBe(true)
      expect(useFavoritesStore.getState().items).toHaveLength(1)
    })

    it('should unpin a pinned item and return false', () => {
      useFavoritesStore.setState({
        items: [makeFavorite({ id: '001' })]
      })

      const result = useFavoritesStore.getState().toggleFavorite({
        id: '001',
        name: 'Account',
        type: 'CustomObject',
        url: '/setup/Account'
      })

      expect(result).toBe(false)
      expect(useFavoritesStore.getState().items).toHaveLength(0)
    })
  })

  describe('clearFavorites', () => {
    it('should clear all favorites', () => {
      useFavoritesStore.setState({
        items: [makeFavorite({ id: 'a' }), makeFavorite({ id: 'b' })]
      })

      useFavoritesStore.getState().clearFavorites()
      expect(useFavoritesStore.getState().items).toHaveLength(0)
    })
  })

  describe('setFavoritesOrgScope', () => {
    const HOST_A = 'a--stg.sandbox.my.salesforce.com'
    const HOST_B = 'b.my.salesforce.com'

    it('isolates favorites across hosts', async () => {
      await setFavoritesOrgScope(HOST_A)
      useFavoritesStore.getState().addFavorite({
        id: 'stg-fav',
        name: 'Stg pinned',
        type: 'CustomObject',
        url: `https://${HOST_A}/stg-fav`
      })
      await new Promise((r) => setTimeout(r, 0))

      _resetFavoritesOrgScope()
      await setFavoritesOrgScope(HOST_B)
      expect(useFavoritesStore.getState().items).toHaveLength(0)
    })

    it('migrates legacy global key on first scope', async () => {
      fakeStore.set('ultraforce_favorites', { items: [makeFavorite({ id: 'legacy' })] })

      await setFavoritesOrgScope(HOST_A)

      expect(fakeStore.get(`ultraforce_favorites__${HOST_A}`)).toBeDefined()
      expect(fakeStore.get('ultraforce_favorites')).toBeUndefined()
      expect(useFavoritesStore.getState().items[0]?.id).toBe('legacy')
    })

    it('does not migrate when scoped key already exists', async () => {
      fakeStore.set('ultraforce_favorites', { items: [makeFavorite({ id: 'legacy' })] })
      fakeStore.set(`ultraforce_favorites__${HOST_A}`, { items: [makeFavorite({ id: 'scoped' })] })

      await setFavoritesOrgScope(HOST_A)

      expect(fakeStore.get('ultraforce_favorites')).toBeDefined()
      expect(useFavoritesStore.getState().items[0]?.id).toBe('scoped')
    })
  })
})
