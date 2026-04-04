// Salesforce API facade - orchestration layer
// Delegates to metadata-types and metadata-fetcher for type definitions and data fetching

import type { SearchResult } from '~types'
import { MetadataCache } from './metadata-cache'
import { getSession, API_VERSION } from './auth'
import { logger } from './logger'
import { normalizeHost, escapeSoql } from './domain-utils'
import { getUnsupportedTypes as getUnsupportedTypesRaw, markTypesChecked, needsPermissionCheck, clearUnsupportedTypesCache } from './unsupported-types'
import {
  buildSearchIndex,
  searchIndex,
  hasSearchIndex,
  clearSearchIndex,
  clearAllSearchIndexes,
  parseSearchQuery
} from './fuzzy-search'
import {
  parseProfileDotNotation,
  buildProfileSubMenu,
  queryProfileUsers,
  queryProfileObjectPermissions,
  queryProfileFieldPermissions,
  queryProfileCustomPermissions,
  queryProfileApexClassAccess,
  queryProfileVFPageAccess,
  queryProfileConnectedApps,
  queryProfileAssignedApps,
  filterProfileSubData
} from './profile-search'

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

import { METADATA_TYPES } from './metadata-types'
import {
  fetchAllPages,
  fetchMetadataFromAPI,
  ensureCMDTRecordIndex,
  ensureCustomSettingRecordIndex,
  ensureFieldIndex,
  ensureMetadataIndex,
  getMetadataWithCache
} from './metadata-fetcher'

// --- Orchestration functions ---

interface DotNotationResult {
  objectName: string
  fieldQuery: string
  isCMDT: boolean
}

function parseDotNotation(query: string): DotNotationResult | null {
  const dotIndex = query.indexOf('.')
  if (dotIndex === -1) return null

  const objectName = query.substring(0, dotIndex).trim()
  const fieldQuery = query.substring(dotIndex + 1).trim()

  if (objectName.length === 0) return null

  const isCMDT = objectName.toLowerCase().endsWith('__mdt')

  return { objectName, fieldQuery, isCMDT }
}

export async function searchSalesforceMetadata(
  query: string,
  selectedTypes: string[],
  sfHost: string,
  options: { useFuzzy?: boolean; hideManagedPackage?: boolean } = {}
): Promise<Record<string, SearchResult[]>> {
  const { useFuzzy = true, hideManagedPackage = true } = options

  if (!sfHost) {
    logger.error('searchSalesforceMetadata: missing sfHost')
    return {}
  }

  const session = await getSession(sfHost)
  if (!session) {
    logger.error('searchSalesforceMetadata: no session', { host: sfHost })
    return {}
  }

  const apiHost = normalizeHost(session.hostname)
  const results: Record<string, SearchResult[]> = {}
  const dotNotation = parseDotNotation(query)

  if (dotNotation) {
    const { objectName, fieldQuery, isCMDT } = dotNotation

    if (isCMDT && selectedTypes.includes('CustomMetadataType')) {
      logger.debug('search:cmdt-record', { cmdt: objectName, query: fieldQuery })

      try {
        await ensureCMDTRecordIndex(objectName, apiHost)
        if (hasSearchIndex(`CMDTRecord:${objectName}`, apiHost)) {
          results['CustomMetadataType'] = searchIndex(fieldQuery, `CMDTRecord:${objectName}`, apiHost, { useFuzzy, hideManagedPackage })
        } else {
          results['CustomMetadataType'] = []
        }
      } catch (error) {
        logger.error('search:cmdt-record failed', { cmdt: objectName, error })
        results['CustomMetadataType'] = []
      }

      const otherTypes = selectedTypes.filter((t) => t !== 'CustomMetadataType')
      if (otherTypes.length > 0) {
        const otherResults = await searchMetadataTypes(query, otherTypes, apiHost, useFuzzy, hideManagedPackage)
        Object.assign(results, otherResults)
      }

      return results
    }

    if (!isCMDT && selectedTypes.includes('CustomSetting')) {
      const isCustomSetting = await checkIsCustomSetting(objectName, apiHost)
      if (isCustomSetting) {
        logger.debug('search:custom-setting-record', { setting: objectName, query: fieldQuery })

        try {
          await ensureCustomSettingRecordIndex(objectName, apiHost)
          if (hasSearchIndex(`CustomSettingRecord:${objectName}`, apiHost)) {
            results['CustomSetting'] = searchIndex(fieldQuery, `CustomSettingRecord:${objectName}`, apiHost, { useFuzzy, hideManagedPackage })
          } else {
            results['CustomSetting'] = []
          }
        } catch (error) {
          logger.error('search:custom-setting-record failed', { setting: objectName, error })
          results['CustomSetting'] = []
        }

        const otherTypes = selectedTypes.filter((t) => t !== 'CustomSetting')
        if (otherTypes.length > 0) {
          const otherResults = await searchMetadataTypes(query, otherTypes, apiHost, useFuzzy, hideManagedPackage)
          Object.assign(results, otherResults)
        }

        return results
      }
    }

    // Profile sub-data search: "System Administrator." or "System Administrator.Users.john"
    if (!isCMDT && selectedTypes.includes('Profile')) {
      // Get cached profiles from search index
      const cachedProfiles = searchIndex('', 'Profile', apiHost, { useFuzzy: false, hideManagedPackage: false })
        .map((r) => ({ id: r.id, name: r.name }))

      const profileDot = parseProfileDotNotation(query, cachedProfiles)
      if (profileDot) {
        const { profileId, profileName, subCategory, filter } = profileDot

        if (!subCategory) {
          // Single dot: show sub-menu (optionally filtered)
          logger.debug('search:profile-submenu', { profile: profileName })
          let subMenu = buildProfileSubMenu(profileId, profileName)
          if (filter) {
            subMenu = subMenu.filter((item) =>
              item.name.toLowerCase().includes(filter.toLowerCase())
            )
          }
          results['Profile'] = subMenu
        } else {
          // Two dots: query sub-data
          logger.debug('search:profile-subdata', { profile: profileName, subCategory, filter })

          let subResults: SearchResult[] = []
          switch (subCategory) {
            case 'Users':
              subResults = await queryProfileUsers(profileId, apiHost, session.key)
              break
            case 'ObjectPermissions':
              subResults = await queryProfileObjectPermissions(profileId, apiHost, session.key)
              break
            case 'FieldPermissions':
              subResults = await queryProfileFieldPermissions(profileId, apiHost, session.key)
              break
            case 'CustomPermissions':
              subResults = await queryProfileCustomPermissions(profileId, apiHost, session.key)
              break
            case 'ApexClassAccess':
              subResults = await queryProfileApexClassAccess(profileId, apiHost, session.key)
              break
            case 'VFPageAccess':
              subResults = await queryProfileVFPageAccess(profileId, apiHost, session.key)
              break
            case 'ConnectedApps':
              subResults = await queryProfileConnectedApps(profileId, apiHost, session.key)
              break
            case 'AssignedApps':
              subResults = await queryProfileAssignedApps(profileId, apiHost, session.key)
              break
          }

          // Inject profileName and subCategory into metadata for Tab completion
          subResults = subResults.map((r) => ({
            ...r,
            metadata: { ...r.metadata, profileName, _subCategory: subCategory }
          }))

          if (filter) {
            subResults = filterProfileSubData(subResults, filter)
          }
          results['Profile'] = subResults
        }

        // Other types use original query
        const otherTypes = selectedTypes.filter((t) => t !== 'Profile')
        if (otherTypes.length > 0) {
          const otherResults = await searchMetadataTypes(query, otherTypes, apiHost, useFuzzy, hideManagedPackage)
          Object.assign(results, otherResults)
        }

        return results
      }
    }

    // Field search: "Account.Name" or "account."
    if (!isCMDT && selectedTypes.includes('CustomField')) {
      logger.debug('search:field', { object: objectName, query: fieldQuery })

      try {
        await ensureFieldIndex(objectName, apiHost)
        if (hasSearchIndex(`Field:${objectName}`, apiHost)) {
          results['CustomField'] = searchIndex(fieldQuery, `Field:${objectName}`, apiHost, { useFuzzy, hideManagedPackage })
        } else {
          results['CustomField'] = []
        }
      } catch (error) {
        logger.error('search:field failed', { object: objectName, error })
        results['CustomField'] = []
      }

      const otherTypes = selectedTypes.filter((t) => t !== 'CustomField')
      if (otherTypes.length > 0) {
        const otherResults = await searchMetadataTypes(query, otherTypes, apiHost, useFuzzy, hideManagedPackage)
        Object.assign(results, otherResults)
      }

      return results
    }
  }

  if (selectedTypes.includes('User') && query.trim()) {
    try {
      const userResults = await searchUsersRealtime(query, apiHost)
      results['User'] = userResults
    } catch (error) {
      logger.error('search:user failed', { error })
      results['User'] = []
    }
  }

  if (selectedTypes.includes('Queue') && query.trim()) {
    try {
      const queueResults = await searchGroupsRealtime(query, 'Queue', apiHost)
      results['Queue'] = queueResults
    } catch (error) {
      logger.error('search:queue failed', { error })
      results['Queue'] = []
    }
  }

  if (selectedTypes.includes('Group') && query.trim()) {
    try {
      const groupResults = await searchGroupsRealtime(query, 'Regular', apiHost)
      results['Group'] = groupResults
    } catch (error) {
      logger.error('search:group failed', { error })
      results['Group'] = []
    }
  }

  const typesToSearch = selectedTypes.filter((t) => t !== 'CustomField' && t !== 'User' && t !== 'Queue' && t !== 'Group')
  if (typesToSearch.length > 0) {
    const otherResults = await searchMetadataTypes(query, typesToSearch, apiHost, useFuzzy, hideManagedPackage)
    Object.assign(results, otherResults)
  }

  return results
}

async function searchUsersRealtime(
  searchTerm: string,
  sfHost: string
): Promise<SearchResult[]> {
  const host = normalizeHost(sfHost)
  const start = Date.now()
  const escaped = escapeSoql(searchTerm)
  const searchPattern = `%${escaped}%`

  const query = `SELECT Id, Name, Username, Email, FederationIdentifier, IsActive, Profile.Name, UserRole.Name FROM User WHERE Name LIKE '${searchPattern}' OR Username LIKE '${searchPattern}' OR Email LIKE '${searchPattern}' OR FederationIdentifier LIKE '${searchPattern}' ORDER BY Name ASC LIMIT 50`
  const queryPath = `/services/data/v${API_VERSION}/query?q=${encodeURIComponent(query)}`

  logger.debug('search:user:soql', { query })

  try {
    const records = await fetchAllPages(host, queryPath)
    logger.debug('search:user', { term: searchTerm, count: records.length, ms: Date.now() - start })

    return records.map((record: any) => {
      const parts = [record.Username]
      if (record.Email) parts.push(record.Email)
      if (record.Profile?.Name) parts.push(record.Profile.Name)
      if (record.UserRole?.Name) parts.push(record.UserRole.Name)
      if (record.IsActive === false) parts.push('Inactive')

      return {
        id: record.Id,
        name: record.Name,
        type: 'User',
        description: parts.join(' | '),
        metadata: record
      }
    })
  } catch (error) {
    logger.error('search:user failed', { term: searchTerm, error })
    return []
  }
}

async function searchGroupsRealtime(
  searchTerm: string,
  groupType: 'Queue' | 'Regular',
  sfHost: string
): Promise<SearchResult[]> {
  const host = normalizeHost(sfHost)
  const start = Date.now()
  const escaped = escapeSoql(searchTerm)
  const searchPattern = `%${escaped}%`
  const resultType = groupType === 'Queue' ? 'Queue' : 'Group'

  const query = groupType === 'Queue'
    ? `SELECT Id, Name, DeveloperName, Email FROM Group WHERE Type = 'Queue' AND (Name LIKE '${searchPattern}' OR DeveloperName LIKE '${searchPattern}') ORDER BY Name ASC LIMIT 50`
    : `SELECT Id, Name, DeveloperName FROM Group WHERE Type = 'Regular' AND (Name LIKE '${searchPattern}' OR DeveloperName LIKE '${searchPattern}') ORDER BY Name ASC LIMIT 50`

  const queryPath = `/services/data/v${API_VERSION}/query?q=${encodeURIComponent(query)}`
  logger.debug(`search:${resultType.toLowerCase()}:soql`, { query })

  try {
    const records = await fetchAllPages(host, queryPath)
    logger.debug(`search:${resultType.toLowerCase()}`, { term: searchTerm, count: records.length, ms: Date.now() - start })

    return records.map((record: any) => {
      const parts = [record.DeveloperName]
      if (record.Email) parts.push(record.Email)

      return {
        id: record.Id,
        name: record.Name,
        type: resultType,
        description: parts.join(' | '),
        metadata: record
      }
    })
  } catch (error) {
    logger.error(`search:${resultType.toLowerCase()} failed`, { term: searchTerm, error })
    return []
  }
}

// Cache of Custom Setting API names for dot-notation detection
const customSettingCache = new Map<string, Set<string>>()

async function checkIsCustomSetting(objectName: string, sfHost: string): Promise<boolean> {
  const host = normalizeHost(sfHost)

  if (!customSettingCache.has(host)) {
    await ensureMetadataIndex('CustomSetting', host)
    const settings = searchIndex('', 'CustomSetting', host, { useFuzzy: false, hideManagedPackage: false })
    const settingNames = new Set(settings.map((s) => s.metadata?.QualifiedApiName?.toLowerCase()).filter(Boolean))
    customSettingCache.set(host, settingNames)
  }

  const settingNames = customSettingCache.get(host)
  return settingNames?.has(objectName.toLowerCase()) || false
}

async function searchMetadataTypes(
  query: string,
  selectedTypes: string[],
  apiHost: string,
  useFuzzy: boolean,
  hideManagedPackage: boolean
): Promise<Record<string, SearchResult[]>> {
  const results: Record<string, SearchResult[]> = {}

  const searchPromises = selectedTypes.map(async (metadataType) => {
    try {
      await ensureMetadataIndex(metadataType, apiHost)
      const searchResults = searchIndex(query, metadataType, apiHost, { useFuzzy, hideManagedPackage })
      return { type: metadataType, results: searchResults }
    } catch (error) {
      logger.error('search:metadata failed', { type: metadataType, error })
      return { type: metadataType, results: [] }
    }
  })

  const searchResults = await Promise.all(searchPromises)
  searchResults.forEach(({ type, results: typeResults }) => {
    results[type] = typeResults
  })

  return results
}

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
  try {
    const url = `https://${apiHost}/services/data/v${API_VERSION}/tooling/query?q=SELECT+Id+FROM+ApexClass+LIMIT+1`
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${sessionKey}` }
    })
    return response.ok
  } catch {
    return false
  }
}

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

// --- Domain detection ---

const SALESFORCE_PATTERNS = [
  /https:\/\/.*\.salesforce\.com/,
  /https:\/\/.*\.salesforce-setup\.com/,
  /https:\/\/.*\.visual\.force\.com/,
  /https:\/\/.*\.visualforce\.com/,
  /https:\/\/.*\.lightning\.force\.com/,
  /https:\/\/.*\.my\.salesforce\.com/,
  /https:\/\/.*\.force\.com/,
  /https:\/\/.*\.sfcrmapps\.cn/,
  /https:\/\/.*\.sfcrmproducts\.cn/
]

export function isSalesforceDomain(url: string): boolean {
  if (!url) return false
  return SALESFORCE_PATTERNS.some((pattern) => pattern.test(url))
}

// --- Custom command execution ---

export interface CustomCommandOptions {
  soqlTemplate: string
  searchQuery: string
  useToolingApi: boolean
  nameField: string
  descriptionFields?: string[]
}

export async function executeCustomCommand(
  options: CustomCommandOptions,
  sfHost: string
): Promise<SearchResult[]> {
  const { soqlTemplate, searchQuery, useToolingApi, nameField, descriptionFields } = options

  if (!sfHost) {
    logger.error('executeCustomCommand: missing sfHost')
    return []
  }

  const session = await getSession(sfHost)
  if (!session) {
    logger.error('executeCustomCommand: no session', { host: sfHost })
    return []
  }

  const apiHost = normalizeHost(session.hostname)
  const start = Date.now()

  const { searchTerm, filterTerm, isExactMatch } = parseSearchQuery(searchQuery)

  const escapedQuery = escapeSoql(searchTerm)
  const soql = soqlTemplate.replace(/\{query\}/gi, escapedQuery)

  const apiPath = useToolingApi ? 'tooling/query' : 'query'
  const queryPath = `/services/data/v${API_VERSION}/${apiPath}?q=${encodeURIComponent(soql)}`

  logger.debug('custom-command:execute', { soql, api: apiPath })

  try {
    const records = await fetchAllPages(apiHost, queryPath, { maxRecords: 100 })
    logger.debug('custom-command:result', { count: records.length, ms: Date.now() - start })

    let results: SearchResult[] = records.map((record: any) => ({
      id: record.Id || record.DurableId || '',
      name: getFieldValue(record, nameField) || 'Unknown',
      type: 'CustomQuery',
      description: buildDescriptionFromFields(record, descriptionFields, nameField),
      metadata: record
    }))

    if (isExactMatch && searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      results = results.filter((r) => r.name.toLowerCase() === searchLower)
    }

    if (filterTerm) {
      results = results.filter((r) => {
        const name = (r.name || '').toLowerCase()
        const description = (r.description || '').toLowerCase()
        return name.includes(filterTerm) || description.includes(filterTerm)
      })
    }

    return results
  } catch (error: any) {
    logger.error('custom-command:error', { soql, error: error.message })
    throw new Error(formatCustomCommandError(error.message))
  }
}

function formatCustomCommandError(errorMessage: string): string {
  const apiMatch = errorMessage.match(/API(?: Error)? \d+: (.+)/)
  if (apiMatch) {
    try {
      const errorData = JSON.parse(apiMatch[1])
      if (Array.isArray(errorData) && errorData[0]?.message) {
        const sfError = errorData[0].message
        return `SOQL Error: ${sfError}\n\nPlease check your custom command configuration in Settings.`
      }
    } catch {
      // Not JSON, use as-is
    }
  }
  return `${errorMessage}\n\nPlease check your custom command configuration in Settings.`
}

function getFieldValue(record: any, fieldPath: string): string {
  if (!fieldPath) return ''
  const parts = fieldPath.split('.')
  let value: any = record
  for (const part of parts) {
    if (value === null || value === undefined) return ''
    value = value[part]
  }
  return value?.toString() || ''
}

function buildDescriptionFromFields(record: any, descriptionFields?: string[], nameField?: string): string {
  if (descriptionFields && descriptionFields.length > 0) {
    const values = descriptionFields
      .map((field) => getFieldValue(record, field.trim()))
      .filter((v) => v)
    if (values.length > 0) {
      return values.join(' | ')
    }
  }
  return buildCustomResultDescription(record, nameField)
}

function buildCustomResultDescription(record: any, nameField?: string): string {
  const parts: string[] = []
  const excludeFields = ['Id', 'Name', 'MasterLabel', 'DeveloperName', 'Label', 'attributes']
  if (nameField) excludeFields.push(nameField)

  for (const [key, value] of Object.entries(record)) {
    if (excludeFields.includes(key)) continue
    if (value === null || value === undefined) continue
    if (typeof value === 'object') continue
    parts.push(`${key}: ${value}`)
    if (parts.length >= 3) break
  }

  return parts.join(' | ')
}
