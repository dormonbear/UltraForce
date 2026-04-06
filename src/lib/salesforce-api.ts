// Salesforce API facade - thin re-export layer + API availability and permission checking
// Delegates to search-orchestrator, custom-command, metadata-types, and metadata-fetcher

import { MetadataCache } from './metadata-cache'
import { getSession, API_VERSION } from './auth'
import { logger } from './logger'
import { normalizeHost } from './domain-utils'
import {
  getUnsupportedTypes as getUnsupportedTypesRaw,
  markTypesChecked,
  needsPermissionCheck,
  clearUnsupportedTypesCache
} from './unsupported-types'
import {
  buildSearchIndex,
  clearSearchIndex,
  clearAllSearchIndexes
} from './fuzzy-search'
import { getMetadataWithCache, fetchMetadataFromAPI } from './metadata-fetcher'
import { METADATA_TYPES } from './metadata-types'

// Re-exports from extracted modules
export { METADATA_TYPES, type SearchOptions } from './metadata-types'
export type {
  SfApexRecord,
  SfEntityDefinition,
  SfFieldDefinition,
  SfFlow,
  SfUser,
  SfPermissionSet,
  SfProfile,
  SfBundleRecord,
  SfReport,
  SfDashboard,
  SfCustomLabel,
  SfCustomMetadataType,
  SfCustomSetting,
  SfQueue,
  SfGroup
} from './metadata-types'
export {
  fetchAllPages,
  fetchMetadataFromAPI,
  fetchFieldsForObject,
  getMetadataWithCache,
  ensureCMDTRecordIndex,
  ensureCustomSettingRecordIndex,
  ensureFieldIndex,
  ensureMetadataIndex,
  fetchRecordsForCMDT,
  fetchRecordsForCustomSetting
} from './metadata-fetcher'
export { searchSalesforceMetadata } from './search-orchestrator'
export { executeCustomCommand, type CustomCommandOptions } from './custom-command'

// --- API availability ---

const apiAvailabilityCache = new Map<string, { available: boolean; sessionHash: string }>()

function getSessionHash(sessionKey: string): string {
  return sessionKey.substring(0, 8)
}

export function isApiAvailable(sfHost: string, sessionKey?: string): boolean {
  const host = normalizeHost(sfHost)
  const cached = apiAvailabilityCache.get(host)
  if (!cached) return true
  if (sessionKey && cached.sessionHash !== getSessionHash(sessionKey)) {
    return true
  }
  return cached.available
}

function markApiAvailability(sfHost: string, available: boolean, sessionKey: string): void {
  const host = normalizeHost(sfHost)
  apiAvailabilityCache.set(host, { available, sessionHash: getSessionHash(sessionKey) })
}

export async function validateSalesforceSession(sfHost: string): Promise<boolean> {
  try {
    const session = await getSession(sfHost)
    if (!session) {
      return false
    }

    const host = normalizeHost(session.hostname)
    const endpoint = `https://${host}/services/data/v${API_VERSION}/sobjects/`
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.key}`,
        'Content-Type': 'application/json'
      }
    })

    const available = response.ok
    markApiAvailability(sfHost, available, session.key)
    return available
  } catch {
    return false
  }
}

// --- Permission checking ---

const PERMISSION_CHECK_MAP: Record<string, { object: string; useRestApi: boolean }> = {
  ApexClass: { object: 'ApexClass', useRestApi: false },
  ApexTrigger: { object: 'ApexTrigger', useRestApi: false },
  ApexPage: { object: 'ApexPage', useRestApi: false },
  ApexComponent: { object: 'ApexComponent', useRestApi: false },
  LightningComponentBundle: { object: 'LightningComponentBundle', useRestApi: false },
  AuraDefinitionBundle: { object: 'AuraDefinitionBundle', useRestApi: false },
  CustomObject: { object: 'EntityDefinition', useRestApi: true },
  Flow: { object: 'Flow', useRestApi: false },
  User: { object: 'User', useRestApi: true },
  PermissionSet: { object: 'PermissionSet', useRestApi: false },
  PermissionSetGroup: { object: 'PermissionSetGroup', useRestApi: false },
  CustomPermission: { object: 'CustomPermission', useRestApi: false },
  Profile: { object: 'Profile', useRestApi: false },
  CustomLabel: { object: 'ExternalString', useRestApi: false },
  CustomMetadataType: { object: 'EntityDefinition', useRestApi: true },
  CustomSetting: { object: 'EntityDefinition', useRestApi: true },
  Queue: { object: 'Group', useRestApi: true },
  Group: { object: 'Group', useRestApi: true },
  Report: { object: 'Report', useRestApi: true },
  Dashboard: { object: 'Dashboard', useRestApi: true }
}

const TOOLING_API_TYPES = [
  'ApexClass', 'ApexTrigger', 'ApexPage', 'ApexComponent',
  'LightningComponentBundle', 'AuraDefinitionBundle', 'Flow',
  'PermissionSet', 'PermissionSetGroup', 'CustomPermission', 'Profile', 'CustomLabel'
]

async function checkViewSetupPermission(apiHost: string, sessionKey: string): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const url = `https://${apiHost}/services/data/v${API_VERSION}/tooling/query?q=SELECT+Id+FROM+ApexClass+LIMIT+1`
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${sessionKey}` }
      })
      if (response.ok) return true
      if (response.status === 403 || response.status === 401) return false
      // Transient error (5xx, timeout) - retry once
    } catch {
      if (attempt > 0) return false
    }
  }
  // Default to true on ambiguous failures to avoid hiding types for admin users
  return true
}

/** Probes the org to discover which metadata types the current user can access. */
export async function checkMetadataPermissions(sfHost: string): Promise<string[]> {
  const allTypes = Object.keys(METADATA_TYPES)

  const session = await getSession(sfHost)
  if (!session) {
    return []
  }

  const apiHost = normalizeHost(session.hostname)
  const hasViewSetup = await checkViewSetupPermission(apiHost, session.key)

  if (!hasViewSetup) {
    logger.debug('permission:check - no ViewSetup, skipping Tooling API types')
    const unsupportedTypes = TOOLING_API_TYPES.filter((t) => allTypes.includes(t))
    await markTypesChecked(apiHost, unsupportedTypes, session.key)
    return unsupportedTypes
  }

  const checkedObjects = new Map<string, boolean>()

  const checkType = async (type: string): Promise<boolean> => {
    const config = PERMISSION_CHECK_MAP[type]
    if (!config) return true

    const cacheKey = `${config.object}:${config.useRestApi}`
    if (checkedObjects.has(cacheKey)) {
      return checkedObjects.get(cacheKey)!
    }

    try {
      const apiPath = config.useRestApi ? 'query' : 'tooling/query'
      const url = `https://${apiHost}/services/data/v${API_VERSION}/${apiPath}?q=SELECT+Id+FROM+${config.object}+LIMIT+1`
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${session.key}` }
      })
      if (!response.ok) {
        const text = await response.text()
        if (text.includes('INVALID_TYPE') || text.includes('not supported') || text.includes('sObject type')) {
          checkedObjects.set(cacheKey, false)
          return false
        }
      }
      checkedObjects.set(cacheKey, true)
      return true
    } catch {
      checkedObjects.set(cacheKey, false)
      return false
    }
  }

  const unsupported: string[] = []
  await Promise.all(
    allTypes.map(async (type) => {
      const isSupported = await checkType(type)
      if (!isSupported) {
        unsupported.push(type)
      }
    })
  )

  await markTypesChecked(apiHost, unsupported, session.key)
  logger.debug('permission:check done', { hasViewSetup, unsupported })
  return unsupported
}

// --- Cache management ---

/** Force-refreshes a single metadata type's cache and search index. */
export async function refreshMetadataCache(metadataType: string, sfHost: string): Promise<void> {
  const host = normalizeHost(sfHost)
  const session = await getSession(host)
  if (!session) {
    logger.error('refresh:cache no session', { host })
    return
  }

  const cache = MetadataCache.getInstance()

  try {
    await cache.delete(host, metadataType)
    clearSearchIndex(metadataType, host)

    const freshData = await fetchMetadataFromAPI(metadataType, host)
    await cache.set(host, metadataType, freshData)
    buildSearchIndex(metadataType, freshData, host)

    logger.debug('refresh:cache done', { type: metadataType, count: freshData.length })
  } catch (error) {
    logger.error('refresh:cache failed', { type: metadataType, error })
  }
}

/** Pre-fetches common metadata types and builds search indexes on extension startup. */
export async function warmupMetadataCache(sfHost: string): Promise<void> {
  const commonTypes = ['ApexClass', 'ApexTrigger', 'Flow', 'CustomObject']

  const session = await getSession(sfHost)
  if (!session) {
    return
  }

  const apiHost = normalizeHost(session.hostname)

  if (await needsPermissionCheck(apiHost, session.key)) {
    await checkMetadataPermissions(sfHost)
  }

  const start = Date.now()
  const unsupported = await getUnsupportedTypesRaw(apiHost)
  const typesToWarmup = commonTypes.filter((t) => !unsupported.includes(t))

  await Promise.all(
    typesToWarmup.map(async (type) => {
      try {
        const { data } = await getMetadataWithCache(type, apiHost)
        buildSearchIndex(type, data, apiHost)
      } catch (error) {
        logger.error('warmup failed', { type, error })
      }
    })
  )

  logger.debug('warmup:done', { types: typesToWarmup.length, ms: Date.now() - start })
}

export async function getCacheStats() {
  return MetadataCache.getInstance().getStats()
}

export async function clearMetadataCache(): Promise<void> {
  await MetadataCache.getInstance().clear()
  await clearUnsupportedTypesCache()
  clearAllSearchIndexes()
}

export function getAvailableMetadataTypes(): string[] {
  return Object.keys(METADATA_TYPES)
}

export async function getUnsupportedTypes(sfHost: string): Promise<string[]> {
  return getUnsupportedTypesRaw(normalizeHost(sfHost))
}

export async function getSupportedMetadataTypes(sfHost: string): Promise<string[]> {
  const allTypes = Object.keys(METADATA_TYPES)
  const unsupported = await getUnsupportedTypes(sfHost)
  return allTypes.filter((type) => !unsupported.includes(type))
}
