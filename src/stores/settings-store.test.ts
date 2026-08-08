import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useSettingsStore, SETTINGS_DEFAULTS, applyManagedPolicy } from './settings-store'
import { readManagedPolicy, subscribeManagedPolicy } from '../lib/managed-policy'

// vitest-chrome does not type chrome storage areas as mocks; tests are excluded
// from tsc (tsconfig.json) and these casts are test-only
const managedGet = chrome.storage.managed.get as unknown as ReturnType<typeof vi.fn>
const localGet = chrome.storage.local.get as unknown as ReturnType<typeof vi.fn>
const localSet = chrome.storage.local.set as unknown as ReturnType<typeof vi.fn>
const localRemove = chrome.storage.local.remove as unknown as ReturnType<typeof vi.fn>
const storeState = useSettingsStore.getState

describe('settings-store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    managedGet.mockReset()
    managedGet.mockResolvedValue({})
    localGet.mockResolvedValue({})
    localSet.mockResolvedValue(undefined)
    localRemove.mockResolvedValue(undefined)
    useSettingsStore.setState(SETTINGS_DEFAULTS)
  })

  afterEach(async () => {
    // Reset the managed-policy module cache so tests do not leak policy
    managedGet.mockReset()
    await readManagedPolicy()
  })

  describe('defaults', () => {
    it('should have correct default values', () => {
      const state = useSettingsStore.getState()

      expect(state.selectedTypes).toEqual(['CustomObject', 'CustomField'])
      expect(state.shortcutKey).toBe('b')
      expect(state.closeOnNavigate).toBe(true)
      expect(state.autoLoadFields).toBe(true)
      expect(state.navigationMode).toBe('auto')
      expect(state.fuzzySearch).toBe(true)
      expect(state.hideManagedPackage).toBe(true)
      expect(state.maxResultsPerType).toBe(50)
      expect(state.customCommands).toEqual({})
    })
  })

  describe('actions', () => {
    it('should update settings via updateSettings', () => {
      useSettingsStore.getState().updateSettings({ shortcutKey: 'k' })

      expect(useSettingsStore.getState().shortcutKey).toBe('k')
    })

    it('should update partial settings without overwriting others', () => {
      useSettingsStore.getState().updateSettings({ shortcutKey: 'k' })

      expect(useSettingsStore.getState().closeOnNavigate).toBe(true)
      expect(useSettingsStore.getState().fuzzySearch).toBe(true)
    })

    it('should set navigation mode', () => {
      useSettingsStore.getState().setNavigationMode('classic')

      expect(useSettingsStore.getState().navigationMode).toBe('classic')
    })

    it('should set fuzzy search', () => {
      useSettingsStore.getState().setFuzzySearch(false)

      expect(useSettingsStore.getState().fuzzySearch).toBe(false)
    })

    it('should set selected types', () => {
      useSettingsStore.getState().setSelectedTypes(['ApexClass', 'ApexTrigger'])

      expect(useSettingsStore.getState().selectedTypes).toEqual(['ApexClass', 'ApexTrigger'])
    })

    it('should set custom commands', () => {
      const commands = {
        x: {
          key: 'x',
          description: 'test',
          soql: 'SELECT Id FROM Account',
          useToolingApi: false,
          isBuiltin: false as const,
          nameField: 'Name'
        }
      }
      useSettingsStore.getState().setCustomCommands(commands)

      expect(useSettingsStore.getState().customCommands).toEqual(commands)
    })
  })

  describe('managed policy', () => {
    it('policy value overrides a persisted user value and blocks action writes', async () => {
      managedGet.mockResolvedValue({ navigationMode: 'classic' })
      const values = await readManagedPolicy()
      applyManagedPolicy(values)

      useSettingsStore.getState().updateSettings({ navigationMode: 'auto' })
      expect(useSettingsStore.getState().navigationMode).toBe('classic')
    })

    it('policy wins over code defaults', async () => {
      managedGet.mockResolvedValue({ navigationMode: 'classic' })
      const values = await readManagedPolicy()
      applyManagedPolicy(values)

      expect(useSettingsStore.getState().navigationMode).toBe('classic')
      expect(useSettingsStore.getState().managedKeys).toEqual(['navigationMode'])
    })

    it('blocks direct setState writes from other modules', async () => {
      managedGet.mockResolvedValue({ navigationMode: 'lightning' })
      const values = await readManagedPolicy()
      applyManagedPolicy(values)

      useSettingsStore.setState({ navigationMode: 'classic' })
      expect(useSettingsStore.getState().navigationMode).toBe('lightning')
    })

    it('settings reset cannot override policy-controlled keys', async () => {
      managedGet.mockResolvedValue({ navigationMode: 'classic', hideManagedPackage: false })
      const values = await readManagedPolicy()
      applyManagedPolicy(values)

      // A replace-style reset with a full state object must keep policy values
      // and the managedKeys marker while resetting everything else
      const snapshot = useSettingsStore.getState()
      useSettingsStore.setState({ ...SETTINGS_DEFAULTS } as unknown as typeof snapshot, true)
      const state = useSettingsStore.getState()
      expect(state.navigationMode).toBe('classic')
      expect(state.hideManagedPackage).toBe(false)
      expect(state.managedKeys).toEqual(['navigationMode', 'hideManagedPackage'])
      // Non-policy keys reset normally
      expect(state.shortcutKey).toBe('b')
      expect(state.fuzzySearch).toBe(true)
      // Restore actions (they live in state and a replace reset drops them)
      useSettingsStore.setState(snapshot)
    })

    it('hydration merge applies policy over persisted user values', async () => {
      managedGet.mockResolvedValue({ navigationMode: 'classic' })
      await readManagedPolicy()

      const merge = useSettingsStore.persist.getOptions().merge!
      const merged = merge({ navigationMode: 'auto', shortcutKey: 'm' }, {
        ...SETTINGS_DEFAULTS
      } as unknown as ReturnType<typeof storeState>)
      expect(merged.navigationMode).toBe('classic')
      expect(merged.shortcutKey).toBe('m')
      expect(merged.hideManagedPackage).toBe(true)
    })

    it('applies live managed policy changes without a restart', () => {
      let registeredListener:
        | ((changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void)
        | undefined
      chrome.storage.onChanged.addListener = vi.fn((fn) => {
        registeredListener = fn
      }) as unknown as typeof chrome.storage.onChanged.addListener
      chrome.storage.onChanged.removeListener = vi.fn() as unknown as typeof chrome.storage.onChanged.removeListener

      const unsub = subscribeManagedPolicy(applyManagedPolicy)
      registeredListener!({ navigationMode: { newValue: 'classic' } }, 'managed')

      expect(useSettingsStore.getState().navigationMode).toBe('classic')
      expect(useSettingsStore.getState().managedKeys).toEqual(['navigationMode'])
      unsub()
    })

    it('unmanaged Chrome (empty area) keeps today behaviour exactly', async () => {
      managedGet.mockResolvedValue({})

      const values = await readManagedPolicy()
      expect(values).toEqual({})

      useSettingsStore.getState().updateSettings({ navigationMode: 'classic' })
      expect(useSettingsStore.getState().navigationMode).toBe('classic')
      expect(useSettingsStore.getState().managedKeys).toEqual([])
    })

    it('unmanaged Chrome (rejected area) degrades silently', async () => {
      managedGet.mockRejectedValue(new Error('not managed'))

      await expect(readManagedPolicy()).resolves.toEqual({})

      useSettingsStore.getState().setNavigationMode('lightning')
      expect(useSettingsStore.getState().navigationMode).toBe('lightning')
    })
  })
})
