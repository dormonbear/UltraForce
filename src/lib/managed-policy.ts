// Enterprise managed policy - read-only settings controlled by chrome.storage.managed.
// Admins force-install the extension and push a policy JSON (declared in
// managed_schema.json at the extension root). Every key here is a permanent
// compatibility commitment: keep the set small and validate strictly.

import type { NavigationMode } from '~types'
import { logger } from './logger'

/** Settings keys that enterprise policy can control. Mirrors managed_schema.json properties. */
export const MANAGED_POLICY_KEYS = ['navigationMode', 'hideManagedPackage', 'maxResultsPerType'] as const

export type ManagedPolicyKey = (typeof MANAGED_POLICY_KEYS)[number]

export interface ManagedPolicyValues {
  navigationMode?: NavigationMode
  hideManagedPackage?: boolean
  maxResultsPerType?: number
}

const MAX_RESULTS_MIN = 10
const MAX_RESULTS_MAX = 500

const validators: Record<ManagedPolicyKey, (value: unknown) => boolean> = {
  navigationMode: (value): value is NavigationMode => value === 'auto' || value === 'lightning' || value === 'classic',
  hideManagedPackage: (value): value is boolean => typeof value === 'boolean',
  maxResultsPerType: (value): value is number =>
    typeof value === 'number' && Number.isInteger(value) && value >= MAX_RESULTS_MIN && value <= MAX_RESULTS_MAX
}

let currentPolicy: ManagedPolicyValues = {}

/** Latest validated policy values. Empty object when no policy is present. */
export function getManagedPolicyValues(): ManagedPolicyValues {
  return currentPolicy
}

/** Whether a settings key is currently controlled by an active policy value. */
export function isManagedSetting(key: ManagedPolicyKey): boolean {
  return currentPolicy[key] !== undefined
}

function validateValues(raw: Record<string, unknown>): ManagedPolicyValues {
  const values: ManagedPolicyValues = {}
  for (const key of MANAGED_POLICY_KEYS) {
    const value = raw[key]
    if (value === undefined) continue
    if (validators[key](value)) {
      ;(values as Record<string, unknown>)[key] = value
    } else {
      logger.warn('managed policy: ignoring invalid value', { key, value })
    }
  }
  return values
}

/**
 * Reads the managed policy from chrome.storage.managed.
 * In unmanaged Chrome this area may resolve to an empty object or reject;
 * both degrade silently to no policy. Never throws.
 */
export async function readManagedPolicy(): Promise<ManagedPolicyValues> {
  try {
    const raw = await chrome.storage.managed.get(null)
    if (!raw || typeof raw !== 'object') {
      currentPolicy = {}
      return {}
    }
    const values = validateValues(raw as Record<string, unknown>)
    currentPolicy = values
    return values
  } catch (error) {
    logger.debug('managed policy: area unavailable, running unmanaged', { error })
    currentPolicy = {}
    return {}
  }
}

type ManagedChangeListener = (values: ManagedPolicyValues) => void

/**
 * Subscribes to live policy changes (chrome.storage.onChanged, managed area only).
 * Returns an unsubscribe function. Removed policy keys unlock the setting.
 */
export function subscribeManagedPolicy(onChange: ManagedChangeListener): () => void {
  const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
    if (areaName !== 'managed') return
    const next: Record<string, unknown> = { ...currentPolicy }
    let changed = false
    for (const key of MANAGED_POLICY_KEYS) {
      const change = changes[key]
      if (!change) continue
      if (change.newValue === undefined) {
        if (key in next) {
          delete next[key]
          changed = true
        }
      } else if (validators[key](change.newValue)) {
        next[key] = change.newValue
        changed = true
      } else {
        logger.warn('managed policy: ignoring invalid change', { key, value: change.newValue })
      }
    }
    if (!changed) return
    currentPolicy = validateValues(next)
    onChange(currentPolicy)
  }
  chrome.storage.onChanged.addListener(listener)
  return () => {
    chrome.storage.onChanged.removeListener(listener)
  }
}
