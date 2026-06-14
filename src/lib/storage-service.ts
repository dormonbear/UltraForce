// Centralized storage service - single typed gateway for chrome.storage.local

import type { NavigationMode, CustomCommand } from '~types'
import { logger } from './logger'

// --- Storage key constants ---

export const STORAGE_KEYS = {
  SEARCH_SETTINGS: 'ultraforce_search_settings',
  UNSUPPORTED_TYPES: 'ultraforce_unsupported_types',
  API_STATS: 'ultraforce_api_stats',
  VERSION_CHECK: 'ultraforce_version_check',
  ERROR_LOGS: 'ultraforce_error_logs',
  HISTORY: 'ultraforce_history',
  FAVORITES: 'ultraforce_favorites',
  LEGACY_SETTINGS: 'settings'
} as const

// Placeholder names used by stores before sfHost is known; storage layer no-ops on these.
export const PENDING_HISTORY_KEY = 'ultraforce_history__pending'
export const PENDING_FAVORITES_KEY = 'ultraforce_favorites__pending'

/** Builds the dynamic cache key for a metadata type in an org. */
export function metadataCacheKey(orgId: string, metadataType: string): string {
  return `metadata_${orgId}_${metadataType}`
}

/** Builds the per-org history persistence key. Host (sfHost) is preferred over orgId since it is known earlier. */
export function historyKey(host: string): string {
  return `ultraforce_history__${host}`
}

/** Builds the per-org favorites persistence key. */
export function favoritesKey(host: string): string {
  return `ultraforce_favorites__${host}`
}

// --- Value interfaces ---

export interface SearchSettings {
  selectedTypes?: string[]
  shortcutKey?: string
  closeOnNavigate?: boolean
  navigationMode?: NavigationMode
  fuzzySearch?: boolean
  maxResults?: number
  maxResultsPerType?: number
  hideManagedPackage?: boolean
  customCommands?: Record<string, CustomCommand>
  autoLoadFields?: boolean
}

export interface UnsupportedTypesState {
  [host: string]: {
    types: string[]
    checkedAt: number
    sessionHash?: string
  }
}

export interface ApiStatsData {
  totalRequests: number
  requestLog: number[]
}

export interface VersionCheckState {
  lastVersion: string
  hasShownNotification: boolean
}

export interface ErrorLogEntry {
  errorId: string
  message: string
  stack?: string
  componentStack?: string
  url: string
  userAgent: string
  timestamp?: number
}

export interface LegacySettings {
  searchLimit: number
  autoSearch: boolean
  showDebug: boolean
}

// --- Storage operations ---

/** Reads a value from chrome.storage.local by key. Returns undefined if not found. */
export async function storageGet<T>(key: string): Promise<T | undefined> {
  try {
    const result = await chrome.storage.local.get([key])
    return result[key] as T | undefined
  } catch (error) {
    logger.error('storage:get failed', { key, error })
    return undefined
  }
}

/** Writes a value to chrome.storage.local. Throws on failure so callers can handle quota errors. */
export async function storageSet(key: string, value: unknown): Promise<void> {
  await chrome.storage.local.set({ [key]: value })
}

/** Removes one or more keys from chrome.storage.local. */
export async function storageRemove(keys: string | string[]): Promise<void> {
  try {
    await chrome.storage.local.remove(keys)
  } catch (error) {
    logger.error('storage:remove failed', { keys, error })
  }
}

/** Reads all entries from chrome.storage.local (for cache scans). */
export async function storageGetAll(): Promise<Record<string, unknown>> {
  try {
    return await chrome.storage.local.get(null)
  } catch (error) {
    logger.error('storage:getAll failed', { error })
    return {}
  }
}

// --- Change listeners ---

type StorageChangeCallback = (
  changes: { [key: string]: chrome.storage.StorageChange },
  areaName: string
) => void

/** Adds a listener for chrome.storage.local changes. Filters to local area only. */
export function onStorageChanged(callback: StorageChangeCallback): void {
  const wrappedCallback = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string
  ) => {
    if (areaName === 'local') {
      callback(changes, areaName)
    }
  }
  listenerMap.set(callback, wrappedCallback)
  chrome.storage.onChanged.addListener(wrappedCallback)
}

/** Removes a previously registered storage change listener. */
export function offStorageChanged(callback: StorageChangeCallback): void {
  const wrappedCallback = listenerMap.get(callback)
  if (wrappedCallback) {
    chrome.storage.onChanged.removeListener(wrappedCallback)
    listenerMap.delete(callback)
  }
}

const listenerMap = new WeakMap<StorageChangeCallback, StorageChangeCallback>()
