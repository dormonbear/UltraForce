// Settings store - single source of truth for user preferences
// Replaces the 3-way duplication: WM state + SearchModal state + chrome.storage

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PersistStorage } from 'zustand/middleware'
import type { NavigationMode, CustomCommand } from '~types'
import { STORAGE_KEYS, storageGet, storageSet, storageRemove } from '~lib/storage-service'

export interface SettingsState {
  selectedTypes: string[]
  shortcutKey: string
  closeOnNavigate: boolean
  autoLoadFields: boolean
  navigationMode: NavigationMode
  fuzzySearch: boolean
  hideManagedPackage: boolean
  maxResultsPerType: number
  customCommands: Record<string, CustomCommand>
}

interface SettingsActions {
  updateSettings: (partial: Partial<SettingsState>) => void
  setNavigationMode: (mode: NavigationMode) => void
  setFuzzySearch: (value: boolean) => void
  setSelectedTypes: (types: string[]) => void
  setCustomCommands: (commands: Record<string, CustomCommand>) => void
}

export type SettingsStore = SettingsState & SettingsActions

export const SETTINGS_DEFAULTS: SettingsState = {
  selectedTypes: ['CustomObject', 'CustomField'],
  shortcutKey: 'b',
  closeOnNavigate: true,
  autoLoadFields: true,
  navigationMode: 'auto',
  fuzzySearch: true,
  hideManagedPackage: true,
  maxResultsPerType: 50,
  customCommands: {}
}

/**
 * Chrome storage adapter for zustand persist middleware.
 * Reads/writes raw objects (not JSON strings) for backward compatibility
 * with existing consumers that read from chrome.storage.local directly.
 */
const chromeSettingsStorage: PersistStorage<Partial<SettingsState>> = {
  getItem: async (name) => {
    const value = await storageGet<Partial<SettingsState>>(name)
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

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...SETTINGS_DEFAULTS,

      updateSettings: (partial) => set(partial),
      setNavigationMode: (mode) => set({ navigationMode: mode }),
      setFuzzySearch: (value) => set({ fuzzySearch: value }),
      setSelectedTypes: (types) => set({ selectedTypes: types }),
      setCustomCommands: (commands) => set({ customCommands: commands })
    }),
    {
      name: STORAGE_KEYS.SEARCH_SETTINGS,
      storage: chromeSettingsStorage,
      partialize: ({
        selectedTypes,
        shortcutKey,
        closeOnNavigate,
        autoLoadFields,
        navigationMode,
        fuzzySearch,
        hideManagedPackage,
        maxResultsPerType,
        customCommands
      }) => ({
        selectedTypes,
        shortcutKey,
        closeOnNavigate,
        autoLoadFields,
        navigationMode,
        fuzzySearch,
        hideManagedPackage,
        maxResultsPerType,
        customCommands
      })
    }
  )
)
