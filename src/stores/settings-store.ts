// Settings store - single source of truth for user preferences
// Replaces the 3-way duplication: WM state + SearchModal state + chrome.storage
//
// Enterprise managed policy (chrome.storage.managed) sits on top of this store:
// policy values override persisted user values and code defaults, and every
// write path is guarded so a policy-controlled setting is read-only. See
// src/lib/managed-policy.ts and managed_schema.json at the extension root.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PersistStorage } from 'zustand/middleware'
import type { NavigationMode, CustomCommand } from '~types'
import { STORAGE_KEYS, storageGet, storageSet, storageRemove } from '~lib/storage-service'
import {
  MANAGED_POLICY_KEYS,
  getManagedPolicyValues,
  readManagedPolicy,
  subscribeManagedPolicy,
  type ManagedPolicyKey,
  type ManagedPolicyValues
} from '~lib/managed-policy'

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
  /** Settings keys currently locked by enterprise policy (derived, never persisted) */
  managedKeys: ManagedPolicyKey[]
}

interface SettingsActions {
  updateSettings: (partial: Partial<SettingsState>) => void
  setNavigationMode: (mode: NavigationMode) => void
  setFuzzySearch: (value: boolean) => void
  setSelectedTypes: (types: string[]) => void
  setCustomCommands: (commands: Record<string, CustomCommand>) => void
}

type SettingsStore = SettingsState & SettingsActions

export const SETTINGS_DEFAULTS: SettingsState = {
  selectedTypes: ['CustomObject', 'CustomField'],
  shortcutKey: 'b',
  closeOnNavigate: true,
  autoLoadFields: true,
  navigationMode: 'auto',
  fuzzySearch: true,
  hideManagedPackage: true,
  maxResultsPerType: 50,
  customCommands: {},
  managedKeys: []
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

/**
 * Replaces every policy-controlled key present in a partial with the current
 * policy value. Applied to all write paths (actions, external setState,
 * hydration merge) so policy cannot be overridden by the UI, a persisted
 * user value, or a settings reset. No-op when no policy is active.
 */
function withPolicyOverrides(partial: Partial<SettingsStore>): Partial<SettingsStore> {
  const policy = getManagedPolicyValues()
  const overridden: Record<string, unknown> = { ...partial }
  for (const key of MANAGED_POLICY_KEYS) {
    if (key in partial && policy[key] !== undefined) {
      overridden[key] = policy[key]
    }
  }
  // Re-derive the managedKeys marker so a full-state replace (settings reset)
  // cannot drop it while policy values are still active
  const managedKeys = MANAGED_POLICY_KEYS.filter((key) => policy[key] !== undefined)
  if (managedKeys.length > 0) {
    overridden.managedKeys = managedKeys
  }
  return overridden as Partial<SettingsStore>
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, _get, api) => {
      // Guard the public setState too: window-manager and other callers write
      // settings through it directly and must not override policy
      const rawSetState = api.setState
      api.setState = (partial, replace) => {
        const next: SettingsStore | Partial<SettingsStore> | ((state: SettingsStore) => Partial<SettingsStore>) =
          typeof partial === 'function' ? (state) => withPolicyOverrides(partial(state)) : withPolicyOverrides(partial)
        return (rawSetState as (partial: typeof next, replace?: boolean) => void)(next, replace)
      }

      const guardedSet = (partial: Partial<SettingsStore>, replace?: boolean) =>
        (set as (partial: Partial<SettingsStore>, replace?: boolean) => void)(withPolicyOverrides(partial), replace)

      return {
        ...SETTINGS_DEFAULTS,

        updateSettings: (partial) => guardedSet(partial),
        setNavigationMode: (mode) => guardedSet({ navigationMode: mode }),
        setFuzzySearch: (value) => guardedSet({ fuzzySearch: value }),
        setSelectedTypes: (types) => guardedSet({ selectedTypes: types }),
        setCustomCommands: (commands) => guardedSet({ customCommands: commands })
      }
    },
    {
      name: STORAGE_KEYS.SEARCH_SETTINGS,
      storage: chromeSettingsStorage,
      // Policy wins over a persisted user value even when hydration lands
      // after the initial policy read (and on any manual rehydrate)
      merge: (persistedState, currentState) => {
        const policy = getManagedPolicyValues()
        const policyOverrides: Record<string, unknown> = {}
        for (const key of MANAGED_POLICY_KEYS) {
          if (policy[key] !== undefined) {
            policyOverrides[key] = policy[key]
          }
        }
        return {
          ...currentState,
          ...(persistedState as Partial<SettingsState> | undefined),
          ...policyOverrides,
          managedKeys: currentState.managedKeys ?? []
        }
      },
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

/**
 * Applies validated policy values to the store and updates the managedKeys
 * marker used by the UI to disable policy-controlled fields.
 */
export function applyManagedPolicy(values: ManagedPolicyValues): void {
  const updates: Record<string, unknown> = {
    managedKeys: MANAGED_POLICY_KEYS.filter((key) => values[key] !== undefined)
  }
  for (const key of MANAGED_POLICY_KEYS) {
    if (values[key] !== undefined) {
      updates[key] = values[key]
    }
  }
  useSettingsStore.setState(updates as Partial<SettingsStore>)
}

// Wire live policy: apply the initial read, then keep state in sync with
// chrome.storage.onChanged (managed area) without a browser restart.
void readManagedPolicy().then((values) => {
  applyManagedPolicy(values)
  subscribeManagedPolicy(applyManagedPolicy)
})
