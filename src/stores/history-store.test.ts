import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useHistoryStore, calculateFrecency, sortByFrecency, type HistoryItem } from './history-store'

vi.mock('~lib/storage-service', () => ({
  STORAGE_KEYS: { HISTORY: 'ultraforce_history' },
  storageGet: vi.fn().mockResolvedValue(undefined),
  storageSet: vi.fn().mockResolvedValue(undefined),
  storageRemove: vi.fn().mockResolvedValue(undefined)
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
