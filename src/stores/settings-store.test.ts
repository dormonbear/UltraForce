import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSettingsStore, SETTINGS_DEFAULTS } from './settings-store'

describe('settings-store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    chrome.storage.local.get.mockResolvedValue({})
    chrome.storage.local.set.mockResolvedValue(undefined)
    chrome.storage.local.remove.mockResolvedValue(undefined)
    useSettingsStore.setState(SETTINGS_DEFAULTS)
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

  describe('subscriptions', () => {
    it('should notify subscribers on state change', () => {
      const listener = vi.fn()
      const unsub = useSettingsStore.subscribe(listener)

      useSettingsStore.getState().setFuzzySearch(false)

      expect(listener).toHaveBeenCalledTimes(1)
      unsub()
    })

    it('should not notify after unsubscribe', () => {
      const listener = vi.fn()
      const unsub = useSettingsStore.subscribe(listener)
      unsub()

      useSettingsStore.getState().setFuzzySearch(false)

      expect(listener).not.toHaveBeenCalled()
    })
  })
})
