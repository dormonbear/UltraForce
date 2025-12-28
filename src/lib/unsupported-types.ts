const STORAGE_KEY = 'ultraforce_unsupported_types'
const CHECK_EXPIRY_MS = 24 * 60 * 60 * 1000 // 24 hours

interface HostState {
  types: string[]
  checkedAt: number
  sessionHash?: string
}

interface UnsupportedTypesState {
  [host: string]: HostState
}

let cache: UnsupportedTypesState | null = null

function hashSession(sessionKey: string): string {
  // Use first 8 chars of session (contains org ID) as identifier
  return sessionKey.substring(0, 8)
}

async function loadState(): Promise<UnsupportedTypesState> {
  if (cache) return cache
  try {
    const result = await chrome.storage.local.get([STORAGE_KEY])
    cache = result[STORAGE_KEY] || {}
    return cache
  } catch {
    return {}
  }
}

async function saveState(state: UnsupportedTypesState): Promise<void> {
  cache = state
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: state })
  } catch {
    // ignore
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
