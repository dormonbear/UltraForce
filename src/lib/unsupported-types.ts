const STORAGE_KEY = 'ultraforce_unsupported_types'

interface UnsupportedTypesStore {
  [orgHost: string]: string[]
}

let memoryCache: UnsupportedTypesStore = {}

async function loadStore(): Promise<UnsupportedTypesStore> {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEY])
    return result[STORAGE_KEY] || {}
  } catch {
    return {}
  }
}

async function saveStore(store: UnsupportedTypesStore): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: store })
  } catch {
    // Ignore storage errors
  }
}

export async function markTypeUnsupported(orgHost: string, metadataType: string): Promise<void> {
  if (!memoryCache[orgHost]) {
    memoryCache = await loadStore()
  }
  if (!memoryCache[orgHost]) {
    memoryCache[orgHost] = []
  }
  if (!memoryCache[orgHost].includes(metadataType)) {
    memoryCache[orgHost].push(metadataType)
    await saveStore(memoryCache)
  }
}

export async function getUnsupportedTypes(orgHost: string): Promise<string[]> {
  if (!memoryCache[orgHost]) {
    memoryCache = await loadStore()
  }
  return memoryCache[orgHost] || []
}

export async function isTypeSupported(orgHost: string, metadataType: string): Promise<boolean> {
  const unsupported = await getUnsupportedTypes(orgHost)
  return !unsupported.includes(metadataType)
}

export async function clearUnsupportedTypes(orgHost: string): Promise<void> {
  memoryCache = await loadStore()
  delete memoryCache[orgHost]
  await saveStore(memoryCache)
}

export async function clearAllUnsupportedTypes(): Promise<void> {
  memoryCache = {}
  try {
    await chrome.storage.local.remove([STORAGE_KEY])
  } catch {
    // Ignore
  }
}
