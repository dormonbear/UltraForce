import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  useHistoryStore,
  setHistoryOrgScope,
  _resetHistoryOrgScope,
  type HistoryItem
} from './history-store'
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
  STORAGE_KEYS: { HISTORY: 'ultraforce_history', FAVORITES: 'ultraforce_favorites' },
  PENDING_HISTORY_KEY: 'ultraforce_history__pending',
  PENDING_FAVORITES_KEY: 'ultraforce_favorites__pending',
  historyKey: (host: string) => `ultraforce_history__${host}`,
  favoritesKey: (host: string) => `ultraforce_favorites__${host}`,
  storageGet: (k: string) => storageGetMock(k),
  storageSet: (k: string, v: unknown) => storageSetMock(k, v),
  storageRemove: (k: string | string[]) => storageRemoveMock(k)
}))

const HOST_A = 'a--stg.sandbox.my.salesforce.com'
const HOST_B = 'b.my.salesforce.com'

// Let the persist middleware flush its async setItem before asserting.
const flush = () => new Promise((r) => setTimeout(r, 0))

function makeHistoryItem(overrides: Partial<HistoryItem> = {}): HistoryItem {
  return {
    id: 'h-id',
    name: 'History Item',
    type: 'Account',
    url: 'https://example.com/h',
    visitCount: 1,
    lastVisitedAt: Date.now(),
    firstVisitedAt: Date.now(),
    ...overrides
  }
}

function makeFavoriteItem(overrides: Partial<FavoriteItem> = {}): FavoriteItem {
  return {
    id: 'f-id',
    name: 'Favorite Item',
    type: 'ApexClass',
    url: 'https://example.com/f',
    pinnedAt: Date.now(),
    ...overrides
  }
}

describe('org isolation integration: history + favorites', () => {
  beforeEach(() => {
    useHistoryStore.setState({ items: [] })
    useFavoritesStore.setState({ items: [] })
    fakeStore.clear()
    storageGetMock.mockClear()
    storageSetMock.mockClear()
    storageRemoveMock.mockClear()
    _resetHistoryOrgScope()
    _resetFavoritesOrgScope()
  })

  describe('history isolation across two hosts', () => {
    it('keeps each host data separate and restores host A on switch back', async () => {
      // Scope to host A and record a visit.
      await setHistoryOrgScope(HOST_A)
      useHistoryStore.getState().recordVisit({
        id: 'a-item',
        name: 'A Account',
        type: 'Account',
        url: `https://${HOST_A}/a-item`
      })
      await flush()

      // Switch to host B: A's data must be invisible (custom merge replaces items).
      _resetHistoryOrgScope()
      await setHistoryOrgScope(HOST_B)
      expect(useHistoryStore.getState().items).toHaveLength(0)

      // Record a different visit under B.
      useHistoryStore.getState().recordVisit({
        id: 'b-item',
        name: 'B Account',
        type: 'Account',
        url: `https://${HOST_B}/b-item`
      })
      await flush()

      // Switch back to A: A's item restored, B's not present.
      _resetHistoryOrgScope()
      await setHistoryOrgScope(HOST_A)
      const items = useHistoryStore.getState().items
      expect(items).toHaveLength(1)
      expect(items[0].id).toBe('a-item')
      expect(items.some((i) => i.id === 'b-item')).toBe(false)

      // Sanity: B still owns its own item in storage.
      const bPersisted = fakeStore.get(`ultraforce_history__${HOST_B}`) as { items: HistoryItem[] }
      expect(bPersisted.items.map((i) => i.id)).toEqual(['b-item'])
    })
  })

  describe('favorites isolation across two hosts', () => {
    it('keeps each host favorites separate and restores host A on switch back', async () => {
      await setFavoritesOrgScope(HOST_A)
      useFavoritesStore.getState().addFavorite({
        id: 'a-fav',
        name: 'A Class',
        type: 'ApexClass',
        url: `https://${HOST_A}/a-fav`
      })
      await flush()

      _resetFavoritesOrgScope()
      await setFavoritesOrgScope(HOST_B)
      expect(useFavoritesStore.getState().items).toHaveLength(0)

      useFavoritesStore.getState().addFavorite({
        id: 'b-fav',
        name: 'B Class',
        type: 'ApexClass',
        url: `https://${HOST_B}/b-fav`
      })
      await flush()

      _resetFavoritesOrgScope()
      await setFavoritesOrgScope(HOST_A)
      const items = useFavoritesStore.getState().items
      expect(items).toHaveLength(1)
      expect(items[0].id).toBe('a-fav')
      expect(items.some((i) => i.id === 'b-fav')).toBe(false)

      const bPersisted = fakeStore.get(`ultraforce_favorites__${HOST_B}`) as { items: FavoriteItem[] }
      expect(bPersisted.items.map((i) => i.id)).toEqual(['b-fav'])
    })
  })

  describe('legacy global key migration on first scope', () => {
    it('migrates legacy history into host A scoped key and removes the legacy key', async () => {
      fakeStore.set('ultraforce_history', { items: [makeHistoryItem({ id: 'legacy-h' })] })

      await setHistoryOrgScope(HOST_A)

      const scoped = fakeStore.get(`ultraforce_history__${HOST_A}`) as { items: HistoryItem[] }
      expect(scoped.items.map((i) => i.id)).toEqual(['legacy-h'])
      expect(fakeStore.get('ultraforce_history')).toBeUndefined()
      expect(useHistoryStore.getState().items[0]?.id).toBe('legacy-h')
    })

    it('migrates legacy favorites into host A scoped key and removes the legacy key', async () => {
      fakeStore.set('ultraforce_favorites', { items: [makeFavoriteItem({ id: 'legacy-f' })] })

      await setFavoritesOrgScope(HOST_A)

      const scoped = fakeStore.get(`ultraforce_favorites__${HOST_A}`) as { items: FavoriteItem[] }
      expect(scoped.items.map((i) => i.id)).toEqual(['legacy-f'])
      expect(fakeStore.get('ultraforce_favorites')).toBeUndefined()
      expect(useFavoritesStore.getState().items[0]?.id).toBe('legacy-f')
    })
  })

  describe('history and favorites scopes are independent', () => {
    it('scoping history to host A does not bind or alter favorites', async () => {
      // Seed favorites for host B and bind favorites to B.
      await setFavoritesOrgScope(HOST_B)
      useFavoritesStore.getState().addFavorite({
        id: 'b-fav',
        name: 'B Class',
        type: 'ApexClass',
        url: `https://${HOST_B}/b-fav`
      })
      await flush()

      // Now scope history to a different host A.
      await setHistoryOrgScope(HOST_A)
      useHistoryStore.getState().recordVisit({
        id: 'a-item',
        name: 'A Account',
        type: 'Account',
        url: `https://${HOST_A}/a-item`
      })
      await flush()

      // Favorites remain on B, untouched by the history scope change.
      expect(useFavoritesStore.getState().items.map((i) => i.id)).toEqual(['b-fav'])
      // History reflects host A only.
      expect(useHistoryStore.getState().items.map((i) => i.id)).toEqual(['a-item'])

      // Each persisted under its own host-scoped key, no cross-contamination.
      expect(fakeStore.get(`ultraforce_favorites__${HOST_B}`)).toBeDefined()
      expect(fakeStore.get(`ultraforce_history__${HOST_A}`)).toBeDefined()
      expect(fakeStore.get(`ultraforce_history__${HOST_B}`)).toBeUndefined()
      expect(fakeStore.get(`ultraforce_favorites__${HOST_A}`)).toBeUndefined()
    })
  })
})
