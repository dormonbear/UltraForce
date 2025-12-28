const STORAGE_KEY = 'ultraforce_unsupported_types'

interface UnsupportedTypesState {
  [host: string]: string[]
}

let cache: UnsupportedTypesState | null = null

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
  const types = state[host] || []
  if (!types.includes(metadataType)) {
    types.push(metadataType)
    state[host] = types
    await saveState(state)
  }
}

export async function getUnsupportedTypes(host: string): Promise<string[]> {
  const state = await loadState()
  return state[host] || []
}
