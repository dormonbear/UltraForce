import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  useHistoryStore,
  setHistoryOrgScope,
  _resetHistoryOrgScope,
  calculateFrecency,
  sortByFrecency,
  type HistoryItem
} from './history-store'

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
  STORAGE_KEYS: { HISTORY: 'ultraforce_history' },
  PENDING_HISTORY_KEY: 'ultraforce_history__pending',
  historyKey: (host: string) => `ultraforce_history__${host}`,
  storageGet: (k: string) => storageGetMock(k),
  storageSet: (k: string, v: unknown) => storageSetMock(k, v),
  storageRemove: (k: string | string[]) => storageRemoveMock(k)
}))

function makeItem(overrides: Partial<HistoryItem> = {}): HistoryItem {
  return {
    id: 'test-id',
    name: 'Test Item',
    type: 'ApexClass',
    url: 'https://example.com/test',
    visitCount: 1,
    lastVisitedAt: Date.now(),
    firstVisitedAt: Date.now(),
    ...overrides
  }
}

describe('history-store', () => {
  beforeEach(() => {
    useHistoryStore.setState({ items: [] })
    fakeStore.clear()
    storageGetMock.mockClear()
    storageSetMock.mockClear()
    storageRemoveMock.mockClear()
    _resetHistoryOrgScope()
  })

  describe('recordVisit', () => {
    it('should add a new item', () => {
      useHistoryStore.getState().recordVisit({
        id: '001xxx',
        name: 'Acme',
        type: 'Account',
        url: 'https://org.salesforce.com/001xxx'
      })

      const { items } = useHistoryStore.getState()
      expect(items).toHaveLength(1)
      expect(items[0].id).toBe('001xxx')
      expect(items[0].name).toBe('Acme')
      expect(items[0].visitCount).toBe(1)
    })

    it('should increment visitCount for existing item', () => {
      useHistoryStore.getState().recordVisit({
        id: '001xxx',
        name: 'Acme',
        type: 'Account',
        url: 'https://org.salesforce.com/001xxx'
      })
      useHistoryStore.getState().recordVisit({
        id: '001xxx',
        name: 'Acme Corp',
        type: 'Account',
        url: 'https://org.salesforce.com/001xxx'
      })

      const { items } = useHistoryStore.getState()
      expect(items).toHaveLength(1)
      expect(items[0].visitCount).toBe(2)
      expect(items[0].name).toBe('Acme Corp')
    })

    it('should treat same id with different type as separate items', () => {
      useHistoryStore.getState().recordVisit({
        id: '001xxx',
        name: 'Acme',
        type: 'Account',
        url: '/001xxx'
      })
      useHistoryStore.getState().recordVisit({
        id: '001xxx',
        name: 'Acme Layout',
        type: 'SetupShortcut',
        url: '/setup/001xxx'
      })

      expect(useHistoryStore.getState().items).toHaveLength(2)
    })

    it('should trim to MAX_HISTORY_ITEMS', () => {
      for (let i = 0; i < 210; i++) {
        useHistoryStore.getState().recordVisit({
          id: `id-${i}`,
          name: `Item ${i}`,
          type: 'ApexClass',
          url: `/item-${i}`
        })
      }

      expect(useHistoryStore.getState().items.length).toBeLessThanOrEqual(200)
    })
  })

  describe('removeItem', () => {
    it('should remove an item by id', () => {
      useHistoryStore.setState({
        items: [makeItem({ id: 'a' }), makeItem({ id: 'b' })]
      })

      useHistoryStore.getState().removeItem('a')
      expect(useHistoryStore.getState().items).toHaveLength(1)
      expect(useHistoryStore.getState().items[0].id).toBe('b')
    })
  })

  describe('clearHistory', () => {
    it('should clear all items', () => {
      useHistoryStore.setState({
        items: [makeItem({ id: 'a' }), makeItem({ id: 'b' })]
      })

      useHistoryStore.getState().clearHistory()
      expect(useHistoryStore.getState().items).toHaveLength(0)
    })
  })

  describe('setHistoryOrgScope', () => {
    const HOST_A = 'a--stg.sandbox.my.salesforce.com'
    const HOST_B = 'b.my.salesforce.com'

    it('isolates items across hosts', async () => {
      await setHistoryOrgScope(HOST_A)
      useHistoryStore.getState().recordVisit({
        id: 'stg-1',
        name: 'Stg item',
        type: 'Account',
        url: `https://${HOST_A}/stg-1`
      })
      // Allow the persist middleware to flush asynchronously.
      await new Promise((r) => setTimeout(r, 0))

      _resetHistoryOrgScope()
      await setHistoryOrgScope(HOST_B)
      expect(useHistoryStore.getState().items).toHaveLength(0)

      useHistoryStore.getState().recordVisit({
        id: 'live-1',
        name: 'Live item',
        type: 'Account',
        url: `https://${HOST_B}/live-1`
      })
      await new Promise((r) => setTimeout(r, 0))

      _resetHistoryOrgScope()
      await setHistoryOrgScope(HOST_A)
      const items = useHistoryStore.getState().items
      expect(items).toHaveLength(1)
      expect(items[0].id).toBe('stg-1')
    })

    it('migrates legacy global key on first scope', async () => {
      fakeStore.set('ultraforce_history', { items: [makeItem({ id: 'legacy' })] })

      await setHistoryOrgScope(HOST_A)

      expect(fakeStore.get(`ultraforce_history__${HOST_A}`)).toBeDefined()
      expect(fakeStore.get('ultraforce_history')).toBeUndefined()
      expect(useHistoryStore.getState().items[0]?.id).toBe('legacy')
    })

    it('does not migrate when scoped key already exists', async () => {
      fakeStore.set('ultraforce_history', { items: [makeItem({ id: 'legacy' })] })
      fakeStore.set(`ultraforce_history__${HOST_A}`, { items: [makeItem({ id: 'scoped' })] })

      await setHistoryOrgScope(HOST_A)

      expect(fakeStore.get('ultraforce_history')).toBeDefined()
      expect(useHistoryStore.getState().items[0]?.id).toBe('scoped')
    })

    it('no-ops on empty host', async () => {
      await setHistoryOrgScope('')
      expect(storageGetMock).not.toHaveBeenCalled()
    })
  })

  describe('frecency refresh on re-open', () => {
    it('moves a re-visited low-frecency item ahead of a stale high-count item', () => {
      const store = useHistoryStore.getState()
      const now = Date.now()
      useHistoryStore.setState({
        items: [
          { id: 'stale', name: 'Stale', type: 'ApexClass', url: 'u1', visitCount: 10, lastVisitedAt: now - 30 * 864e5, firstVisitedAt: now - 60 * 864e5 },
          { id: 'fresh', name: 'Fresh', type: 'ApexClass', url: 'u2', visitCount: 1, lastVisitedAt: now - 20 * 864e5, firstVisitedAt: now - 20 * 864e5 }
        ]
      })
      store.recordVisit({ id: 'fresh', name: 'Fresh', type: 'ApexClass', url: 'u2' })
      const items = useHistoryStore.getState().items
      const sorted = sortByFrecency(items)
      expect(sorted[0].id).toBe('fresh')
    })

    it('keeps description when recordVisit omits it', () => {
      const store = useHistoryStore.getState()
      store.recordVisit({ id: 'a', name: 'A', type: 'User', url: 'u', description: 'first@x.com | Admin' })
      store.recordVisit({ id: 'a', name: 'A', type: 'User', url: 'u' })
      const item = useHistoryStore.getState().items.find((i) => i.id === 'a')
      expect(item?.description).toBe('first@x.com | Admin')
      expect(item?.visitCount).toBe(2)
    })

    it('treats same id with different type as distinct entries', () => {
      const store = useHistoryStore.getState()
      store.recordVisit({ id: 'x', name: 'X', type: 'ApexClass', url: 'u1' })
      store.recordVisit({ id: 'x', name: 'X', type: 'Flow', url: 'u2' })
      expect(useHistoryStore.getState().items).toHaveLength(2)
    })
  })

  describe('org scope isolation', () => {
    it('writes to a host-scoped key after setHistoryOrgScope', async () => {
      await setHistoryOrgScope('orgA.my.salesforce.com')
      useHistoryStore.getState().recordVisit({ id: 'a', name: 'A', type: 'User', url: 'u' })
      await Promise.resolve()
      expect(storageSetMock).toHaveBeenCalledWith(
        'ultraforce_history__orgA.my.salesforce.com',
        expect.objectContaining({ items: expect.any(Array) })
      )
    })

    it('clears in-memory items when switching to an org with no persisted data', async () => {
      await setHistoryOrgScope('orgA.my.salesforce.com')
      useHistoryStore.getState().recordVisit({ id: 'a', name: 'A', type: 'User', url: 'u' })
      _resetHistoryOrgScope()
      await setHistoryOrgScope('orgB.my.salesforce.com')
      expect(useHistoryStore.getState().items).toEqual([])
    })
  })
})

describe('frecency', () => {
  describe('calculateFrecency', () => {
    it('should score recent items higher', () => {
      const now = Date.now()
      const recent = makeItem({ visitCount: 1, lastVisitedAt: now })
      const old = makeItem({ visitCount: 1, lastVisitedAt: now - 30 * 24 * 60 * 60 * 1000 })

      expect(calculateFrecency(recent, now)).toBeGreaterThan(calculateFrecency(old, now))
    })

    it('should score frequent items higher', () => {
      const now = Date.now()
      const frequent = makeItem({ visitCount: 10, lastVisitedAt: now })
      const rare = makeItem({ visitCount: 1, lastVisitedAt: now })

      expect(calculateFrecency(frequent, now)).toBeGreaterThan(calculateFrecency(rare, now))
    })

    it('should balance frequency and recency', () => {
      const now = Date.now()
      const oldFrequent = makeItem({
        visitCount: 20,
        lastVisitedAt: now - 14 * 24 * 60 * 60 * 1000
      })
      const recentRare = makeItem({ visitCount: 1, lastVisitedAt: now })

      // 20 visits * 0.25 decay (2 half-lives) = 5
      // 1 visit * 1.0 decay = 1
      expect(calculateFrecency(oldFrequent, now)).toBeGreaterThan(calculateFrecency(recentRare, now))
    })
  })

  describe('sortByFrecency', () => {
    it('should sort items by frecency score descending', () => {
      const now = Date.now()
      const items = [
        makeItem({ id: 'old', visitCount: 1, lastVisitedAt: now - 30 * 24 * 60 * 60 * 1000 }),
        makeItem({ id: 'frequent', visitCount: 10, lastVisitedAt: now }),
        makeItem({ id: 'recent', visitCount: 2, lastVisitedAt: now })
      ]

      const sorted = sortByFrecency(items, now)
      expect(sorted[0].id).toBe('frequent')
      expect(sorted[1].id).toBe('recent')
      expect(sorted[2].id).toBe('old')
    })
  })
})
