import { STORAGE_KEYS, storageGet, storageSet, storageRemove, type UnsupportedTypesState } from './storage-service'

const CHECK_EXPIRY_MS = 24 * 60 * 60 * 1000 // 24 hours

let cache: UnsupportedTypesState | null = null

/**
 * Session fingerprint: a 32-bit FNV-1a digest of the full sid, hex-encoded.
 *
 * A Salesforce sid is `<orgId>!<token>` (background/index.ts:184 splits on
 * '!' to read the org ID). The old `substring(0, 8)` scheme stored the org-ID
 * prefix in plaintext - identical for every session of the same org - so it
 * could not detect a session change. A digest of the full sid is
 * session-specific (the token rotates on every login) and does not disclose
 * the org ID. 8 hex chars = 32 bits; a collision would only skip one recheck,
 * bounded by the 24h TTL.
 */
export function hashSession(sessionKey: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < sessionKey.length; i++) {
    hash ^= sessionKey.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

async function loadState(): Promise<UnsupportedTypesState> {
  if (cache) return cache
  const state = await storageGet<UnsupportedTypesState>(STORAGE_KEYS.UNSUPPORTED_TYPES)
  cache = state ?? {}
  return cache
}

async function saveState(state: UnsupportedTypesState): Promise<void> {
  cache = state
  try {
    await storageSet(STORAGE_KEYS.UNSUPPORTED_TYPES, state)
  } catch {
    // Ignore storage errors
  }
}

export async function markTypeUnsupported(host: string, metadataType: string): Promise<void> {
  const state = await loadState()
  const hostState = state[host] || { types: [], checkedAt: 0 }
  if (!hostState.types.includes(metadataType)) {
    hostState.types.push(metadataType)
    state[host] = hostState
    await saveState(state)
  }
}

export async function markTypesChecked(host: string, unsupportedTypes: string[], sessionKey?: string): Promise<void> {
  const state = await loadState()
  state[host] = {
    types: unsupportedTypes,
    checkedAt: Date.now(),
    sessionHash: sessionKey ? hashSession(sessionKey) : undefined
  }
  await saveState(state)
}

export async function getUnsupportedTypes(host: string): Promise<string[]> {
  const state = await loadState()
  return state[host]?.types || []
}

export async function needsPermissionCheck(host: string, sessionKey?: string): Promise<boolean> {
  const state = await loadState()
  const hostState = state[host]
  if (!hostState) return true
  if (Date.now() - hostState.checkedAt > CHECK_EXPIRY_MS) return true
  // Session changed - need to recheck
  if (sessionKey && hostState.sessionHash && hashSession(sessionKey) !== hostState.sessionHash) {
    return true
  }
  return false
}

export async function clearUnsupportedTypesCache(): Promise<void> {
  cache = null
  await storageRemove(STORAGE_KEYS.UNSUPPORTED_TYPES)
}
