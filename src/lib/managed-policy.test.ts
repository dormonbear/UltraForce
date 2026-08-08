import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  MANAGED_POLICY_KEYS,
  getManagedPolicyValues,
  isManagedSetting,
  readManagedPolicy,
  subscribeManagedPolicy
} from './managed-policy'

// vitest-chrome does not type the managed area as a mock; tests are excluded
// from tsc (tsconfig.json) and this cast is test-only
const managedGet = chrome.storage.managed.get as unknown as ReturnType<typeof vi.fn>

describe('managed-policy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    managedGet.mockResolvedValue({})
  })

  afterEach(() => {
    // Reset the module-level cache so tests do not leak policy into each other
    void readManagedPolicy()
  })

  describe('readManagedPolicy', () => {
    it('returns {} when the managed area is empty (unmanaged Chrome)', async () => {
      managedGet.mockResolvedValue({})

      await expect(readManagedPolicy()).resolves.toEqual({})
      expect(getManagedPolicyValues()).toEqual({})
    })

    it('degrades silently when storage.managed rejects', async () => {
      managedGet.mockRejectedValue(new Error('not managed'))

      await expect(readManagedPolicy()).resolves.toEqual({})
      expect(getManagedPolicyValues()).toEqual({})
    })

    it('degrades silently when storage.managed resolves undefined', async () => {
      managedGet.mockResolvedValue(undefined)

      await expect(readManagedPolicy()).resolves.toEqual({})
      expect(getManagedPolicyValues()).toEqual({})
    })

    it('returns validated policy values', async () => {
      managedGet.mockResolvedValue({
        navigationMode: 'classic',
        hideManagedPackage: false,
        maxResultsPerType: 100
      })

      await expect(readManagedPolicy()).resolves.toEqual({
        navigationMode: 'classic',
        hideManagedPackage: false,
        maxResultsPerType: 100
      })
    })

    it('drops invalid values and keeps the remaining valid ones', async () => {
      managedGet.mockResolvedValue({
        navigationMode: 'nightly',
        hideManagedPackage: 'yes',
        maxResultsPerType: 25,
        someUnknownKey: 'ignored'
      })

      const values = await readManagedPolicy()
      expect(values).toEqual({ maxResultsPerType: 25 })
    })

    it('rejects out-of-range maxResultsPerType values', async () => {
      managedGet.mockResolvedValue({ maxResultsPerType: 5 })

      await expect(readManagedPolicy()).resolves.toEqual({})
    })

    it('tracks controlled keys via isManagedSetting', async () => {
      managedGet.mockResolvedValue({ navigationMode: 'lightning' })

      await readManagedPolicy()
      expect(isManagedSetting('navigationMode')).toBe(true)
      expect(isManagedSetting('hideManagedPackage')).toBe(false)
      expect(isManagedSetting('maxResultsPerType')).toBe(false)
    })
  })

  describe('subscribeManagedPolicy', () => {
    let registeredListener:
      | ((changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void)
      | undefined

    beforeEach(() => {
      chrome.storage.onChanged.addListener = vi.fn((fn) => {
        registeredListener = fn
      }) as typeof chrome.storage.onChanged.addListener
      chrome.storage.onChanged.removeListener = vi.fn()
    })

    it('applies valid changes from the managed area only', () => {
      const onChange = vi.fn()
      const unsub = subscribeManagedPolicy(onChange)

      registeredListener!({ navigationMode: { newValue: 'classic' } }, 'local')
      expect(onChange).not.toHaveBeenCalled()

      registeredListener!({ navigationMode: { newValue: 'classic' } }, 'managed')
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ navigationMode: 'classic' }))

      unsub()
      expect(chrome.storage.onChanged.removeListener).toHaveBeenCalledWith(registeredListener)
    })

    it('merges changes into the current policy and unlocks removed keys', () => {
      const onChange = vi.fn()
      subscribeManagedPolicy(onChange)

      registeredListener!({ hideManagedPackage: { newValue: true } }, 'managed')
      expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ hideManagedPackage: true }))

      registeredListener!({ hideManagedPackage: { newValue: undefined, oldValue: true } }, 'managed')
      expect(onChange).toHaveBeenLastCalledWith({})
      expect(isManagedSetting('hideManagedPackage')).toBe(false)
    })

    it('ignores invalid change values', () => {
      const onChange = vi.fn()
      subscribeManagedPolicy(onChange)

      registeredListener!({ navigationMode: { newValue: 'wat' } }, 'managed')
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  it('MANAGED_POLICY_KEYS matches the settings store surface', () => {
    expect(MANAGED_POLICY_KEYS).toEqual(['navigationMode', 'hideManagedPackage', 'maxResultsPerType'])
  })
})
