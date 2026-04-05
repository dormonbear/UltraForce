import {
  markTypeUnsupported,
  markTypesChecked,
  getUnsupportedTypes,
  needsPermissionCheck,
  clearUnsupportedTypesCache
} from './unsupported-types'
import { STORAGE_KEYS, storageGet, storageSet, storageRemove } from './storage-service'

vi.mock('./storage-service', async () => {
  const actual = await vi.importActual<typeof import('./storage-service')>('./storage-service')
  return {
    ...actual,
    storageGet: vi.fn(),
    storageSet: vi.fn(),
    storageRemove: vi.fn()
  }
})

const CHECK_EXPIRY_MS = 24 * 60 * 60 * 1000

describe('unsupported-types', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.useRealTimers()
    vi.mocked(storageGet).mockResolvedValue(undefined)
    vi.mocked(storageSet).mockResolvedValue(undefined)
    vi.mocked(storageRemove).mockResolvedValue(undefined)
    await clearUnsupportedTypesCache()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('markTypeUnsupported', () => {
    it('adds a new type to empty state', async () => {
      vi.mocked(storageGet).mockResolvedValue({})

      await markTypeUnsupported('example.salesforce.com', 'Flow')

      expect(storageSet).toHaveBeenCalledWith(STORAGE_KEYS.UNSUPPORTED_TYPES, {
        'example.salesforce.com': {
          types: ['Flow'],
          checkedAt: 0
        }
      })
    })

    it('does not duplicate existing type', async () => {
      vi.mocked(storageGet).mockResolvedValue({
        'example.salesforce.com': { types: ['Flow'], checkedAt: 0 }
      })

      await markTypeUnsupported('example.salesforce.com', 'Flow')

      expect(storageSet).not.toHaveBeenCalled()
    })
  })

  describe('markTypesChecked', () => {
    it('overwrites state with new types and timestamp', async () => {
      const now = 1_800_000_000_000
      vi.spyOn(Date, 'now').mockReturnValue(now)
      vi.mocked(storageGet).mockResolvedValue({})

      await markTypesChecked('host.test', ['ApexClass', 'Profile'])

      expect(storageSet).toHaveBeenCalledWith(STORAGE_KEYS.UNSUPPORTED_TYPES, {
        'host.test': {
          types: ['ApexClass', 'Profile'],
          checkedAt: now
        }
      })
    })

    it('stores session hash when provided', async () => {
      const now = 1_800_000_000_001
      vi.spyOn(Date, 'now').mockReturnValue(now)
      vi.mocked(storageGet).mockResolvedValue({})

      await markTypesChecked('host.test', ['CustomObject'], 'abcdefgh-extra')

      expect(storageSet).toHaveBeenCalledWith(STORAGE_KEYS.UNSUPPORTED_TYPES, {
        'host.test': {
          types: ['CustomObject'],
          checkedAt: now,
          sessionHash: 'abcdefgh'
        }
      })
    })
  })

  describe('getUnsupportedTypes', () => {
    it('returns types for known host', async () => {
      vi.mocked(storageGet).mockResolvedValue({
        'my.host': { types: ['X', 'Y'], checkedAt: 1 }
      })

      const types = await getUnsupportedTypes('my.host')

      expect(types).toEqual(['X', 'Y'])
    })

    it('returns empty array for unknown host', async () => {
      vi.mocked(storageGet).mockResolvedValue({})

      const types = await getUnsupportedTypes('unknown.host')

      expect(types).toEqual([])
    })
  })

  describe('needsPermissionCheck', () => {
    it('returns true for unknown host', async () => {
      vi.mocked(storageGet).mockResolvedValue({})

      const needs = await needsPermissionCheck('new.host')

      expect(needs).toBe(true)
    })

    it('returns true when check is expired (>24h)', async () => {
      const now = 1_800_000_000_000
      vi.spyOn(Date, 'now').mockReturnValue(now)
      vi.mocked(storageGet).mockResolvedValue({
        'stale.host': { types: [], checkedAt: now - CHECK_EXPIRY_MS - 1 }
      })

      const needs = await needsPermissionCheck('stale.host')

      expect(needs).toBe(true)
    })

    it('returns false when check is recent', async () => {
      const now = 1_800_000_000_000
      vi.spyOn(Date, 'now').mockReturnValue(now)
      vi.mocked(storageGet).mockResolvedValue({
        'recent.host': { types: ['Flow'], checkedAt: now - 60_000 }
      })

      const needs = await needsPermissionCheck('recent.host')

      expect(needs).toBe(false)
    })

    it('returns true when session changed', async () => {
      const now = 1_800_000_000_000
      vi.spyOn(Date, 'now').mockReturnValue(now)
      vi.mocked(storageGet).mockResolvedValue({
        'sess.host': {
          types: [],
          checkedAt: now,
          sessionHash: '11111111'
        }
      })

      const needs = await needsPermissionCheck('sess.host', '22222222-rest')

      expect(needs).toBe(true)
    })
  })

  describe('clearUnsupportedTypesCache', () => {
    it('clears cache and storage', async () => {
      vi.mocked(storageGet).mockResolvedValue({
        'h1': { types: ['A'], checkedAt: 1 }
      })
      await getUnsupportedTypes('h1')
      vi.mocked(storageGet).mockClear()

      await clearUnsupportedTypesCache()

      expect(storageRemove).toHaveBeenCalledWith(STORAGE_KEYS.UNSUPPORTED_TYPES)
      await getUnsupportedTypes('h1')
      expect(storageGet).toHaveBeenCalled()
    })
  })
})
