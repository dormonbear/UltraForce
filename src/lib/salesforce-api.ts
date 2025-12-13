import type { SearchResult } from '~types'
import { MetadataCache } from './metadata-cache'
import { getSession, API_VERSION } from './auth'
import { logger } from './logger'
import {
  buildSearchIndex,
  searchIndex,
  hasSearchIndex,
  clearSearchIndex,
  clearAllSearchIndexes,
  parseSearchQuery
} from './fuzzy-search'

const METADATA_TYPES: Record<string, { query: string }> = {
  ApexClass: {
    query: `SELECT Id, Name, NamespacePrefix, LastModifiedDate, LastModifiedBy.Name FROM ApexClass ORDER BY Name ASC LIMIT 50000`
  },
  ApexTrigger: {
    query: `SELECT Id, Name, NamespacePrefix, LastModifiedDate, LastModifiedBy.Name FROM ApexTrigger ORDER BY Name ASC LIMIT 10000`
  },
  ApexPage: {
    query: `SELECT Id, Name, NamespacePrefix, LastModifiedDate, LastModifiedBy.Name FROM ApexPage ORDER BY Name ASC LIMIT 10000`
  },
  ApexComponent: {
    query: `SELECT Id, Name, NamespacePrefix, LastModifiedDate, LastModifiedBy.Name FROM ApexComponent ORDER BY Name ASC LIMIT 10000`
  },
  LightningComponentBundle: {
    query: `SELECT Id, DeveloperName, NamespacePrefix, MasterLabel, LastModifiedDate, LastModifiedBy.Name FROM LightningComponentBundle ORDER BY DeveloperName ASC LIMIT 10000`
  },
  AuraDefinitionBundle: {
    query: `SELECT Id, DeveloperName, NamespacePrefix, MasterLabel, LastModifiedDate, LastModifiedBy.Name FROM AuraDefinitionBundle ORDER BY DeveloperName ASC LIMIT 10000`
  },
  CustomObject: {
    query: `SELECT QualifiedApiName, Label, DurableId, KeyPrefix FROM EntityDefinition WHERE IsCustomizable = true AND (NOT QualifiedApiName LIKE '%__mdt') ORDER BY QualifiedApiName ASC LIMIT 10000`
  },
  Flow: {
    query: `SELECT Id, MasterLabel, VersionNumber, Status FROM Flow ORDER BY MasterLabel ASC LIMIT 10000`
  },
  User: {
    query: `SELECT Id, Name, Username, Email, FederationIdentifier, IsActive, Profile.Name, UserRole.Name FROM User ORDER BY Name ASC LIMIT 5000`
  },
  PermissionSet: {
    query: `SELECT Id, Name, Label, NamespacePrefix FROM PermissionSet ORDER BY Label ASC LIMIT 2000`
  },
  Profile: {
    query: `SELECT Id, Name FROM Profile ORDER BY Name ASC LIMIT 1000`
  },
  CustomLabel: {
    query: `SELECT Id, Name, MasterLabel, Value, NamespacePrefix FROM ExternalString ORDER BY Name ASC`
  },
  CustomMetadataType: {
    query: `SELECT DurableId, QualifiedApiName, Label, NamespacePrefix FROM EntityDefinition WHERE QualifiedApiName LIKE '%__mdt' ORDER BY QualifiedApiName ASC LIMIT 500`
  },
  CustomSetting: {
    query: `SELECT DurableId, QualifiedApiName, DeveloperName, Label, NamespacePrefix FROM EntityDefinition WHERE IsCustomSetting = true ORDER BY QualifiedApiName ASC LIMIT 2000`
  }
}

export interface SearchOptions {
  useFuzzy?: boolean
  hideManagedPackage?: boolean
}

function normalizeHost(host: string): string {
  if (!host) return host
  let normalized = host.replace(/^\./, '').replace(/^https?:\/\//, '')

  normalized = normalized.replace(/\.lightning\.force\./, '.my.salesforce.')

  // China: .sandbox.setup. -> .sandbox.my., .setup. -> .my.
  normalized = normalized.replace(/\.sandbox\.(setup|lightning|file|content|c)\.sfcrmproducts\./, '.sandbox.my.sfcrmproducts.')
  normalized = normalized.replace(/\.sandbox\.(setup|lightning|file|content|c)\.sfcrmapps\./, '.sandbox.my.sfcrmapps.')
  normalized = normalized.replace(/\.(lightning|file|content|c|setup)\.sfcrmproducts\./, '.my.sfcrmproducts.')
  normalized = normalized.replace(/\.(lightning|file|content|c|setup)\.sfcrmapps\./, '.my.sfcrmapps.')

  normalized = normalized.replace(/\.mcas\.ms$/, '')

  return normalized
}

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

function escapeSoql(input: string): string {
  return input.replace(/'/g, "\\'")
}

export async function searchSalesforceMetadata(
  query: string,
  selectedTypes: string[],
  sfHost: string,
  options: SearchOptions = {}
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

  // Dot-notation search: "Object.Field" or "Type__mdt.Record"
  if (dotNotation) {
    const { objectName, fieldQuery, isCMDT } = dotNotation

    // CMDT record search: "My_Setting__mdt." or "My_Setting__mdt.RecordName"
    if (isCMDT && selectedTypes.includes('CustomMetadataType')) {
      logger.debug('search:cmdt-record', { cmdt: objectName, query: fieldQuery })

      try {
        await ensureCMDTRecordIndex(objectName, apiHost, session.key)
        if (hasSearchIndex(`CMDTRecord:${objectName}`, apiHost)) {
          results['CustomMetadataType'] = searchIndex(fieldQuery, `CMDTRecord:${objectName}`, apiHost, { useFuzzy, hideManagedPackage })
        } else {
          results['CustomMetadataType'] = []
        }
      } catch (error) {
        logger.error('search:cmdt-record failed', { cmdt: objectName, error })
        results['CustomMetadataType'] = []
      }

      // Other types use original query
      const otherTypes = selectedTypes.filter((t) => t !== 'CustomMetadataType')
      if (otherTypes.length > 0) {
        const otherResults = await searchMetadataTypes(query, otherTypes, apiHost, session.key, useFuzzy, hideManagedPackage)
        Object.assign(results, otherResults)
      }

      return results
    }

    // Custom Setting record search: "My_Setting__c." or "My_Setting__c.RecordName"
    if (!isCMDT && selectedTypes.includes('CustomSetting')) {
      const isCustomSetting = await checkIsCustomSetting(objectName, apiHost, session.key)
      if (isCustomSetting) {
        logger.debug('search:custom-setting-record', { setting: objectName, query: fieldQuery })

        try {
          await ensureCustomSettingRecordIndex(objectName, apiHost, session.key)
          if (hasSearchIndex(`CustomSettingRecord:${objectName}`, apiHost)) {
            results['CustomSetting'] = searchIndex(fieldQuery, `CustomSettingRecord:${objectName}`, apiHost, { useFuzzy, hideManagedPackage })
          } else {
            results['CustomSetting'] = []
          }
        } catch (error) {
          logger.error('search:custom-setting-record failed', { setting: objectName, error })
          results['CustomSetting'] = []
        }

        // Other types use original query
        const otherTypes = selectedTypes.filter((t) => t !== 'CustomSetting')
        if (otherTypes.length > 0) {
          const otherResults = await searchMetadataTypes(query, otherTypes, apiHost, session.key, useFuzzy, hideManagedPackage)
          Object.assign(results, otherResults)
        }

        return results
      }
    }

    // Field search: "Account.Name" or "account."
    if (!isCMDT && selectedTypes.includes('CustomField')) {
      logger.debug('search:field', { object: objectName, query: fieldQuery })

      try {
        await ensureFieldIndex(objectName, apiHost, session.key)
        if (hasSearchIndex(`Field:${objectName}`, apiHost)) {
          results['CustomField'] = searchIndex(fieldQuery, `Field:${objectName}`, apiHost, { useFuzzy, hideManagedPackage })
        } else {
          results['CustomField'] = []
        }
      } catch (error) {
        logger.error('search:field failed', { object: objectName, error })
        results['CustomField'] = []
      }

      // Other types use original query (not objectName) to preserve full search term
      const otherTypes = selectedTypes.filter((t) => t !== 'CustomField')
      if (otherTypes.length > 0) {
        const otherResults = await searchMetadataTypes(query, otherTypes, apiHost, session.key, useFuzzy, hideManagedPackage)
        Object.assign(results, otherResults)
      }

      return results
    }
  }

  // Handle User search separately (real-time SOQL search)
  if (selectedTypes.includes('User') && query.trim()) {
    try {
      const userResults = await searchUsersRealtime(query, apiHost, session.key)
      results['User'] = userResults
    } catch (error) {
      logger.error('search:user failed', { error })
      results['User'] = []
    }
  }

  // Filter out CustomField (requires dot-notation) and User (handled above)
  const typesToSearch = selectedTypes.filter((t) => t !== 'CustomField' && t !== 'User')
  if (typesToSearch.length > 0) {
    const otherResults = await searchMetadataTypes(query, typesToSearch, apiHost, session.key, useFuzzy, hideManagedPackage)
    Object.assign(results, otherResults)
  }

  return results
}

async function searchUsersRealtime(
  searchTerm: string,
  sfHost: string,
  sessionId: string
): Promise<SearchResult[]> {
  const host = normalizeHost(sfHost)
  const endpoint = `https://${host}/services/data/v${API_VERSION}/query`

  const start = Date.now()
  const escaped = escapeSoql(searchTerm)
  const searchPattern = `%${escaped}%`

  const query = `SELECT Id, Name, Username, Email, FederationIdentifier, IsActive, Profile.Name, UserRole.Name FROM User WHERE Name LIKE '${searchPattern}' OR Username LIKE '${searchPattern}' OR Email LIKE '${searchPattern}' OR FederationIdentifier LIKE '${searchPattern}' ORDER BY Name ASC LIMIT 50`

  logger.debug('search:user:soql', { query })

  try {
    const records = await fetchAllPages(`${endpoint}?q=${encodeURIComponent(query)}`, host, sessionId)
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

async function ensureFieldIndex(objectName: string, apiHost: string, sessionId: string): Promise<void> {
  if (hasSearchIndex(`Field:${objectName}`, apiHost)) return

  const fields = await fetchFieldsForObject(objectName, apiHost, sessionId)
  if (fields.length > 0) {
    buildSearchIndex(`Field:${objectName}`, fields, apiHost)
  }
}

async function ensureCMDTRecordIndex(cmdtName: string, apiHost: string, sessionId: string): Promise<void> {
  if (hasSearchIndex(`CMDTRecord:${cmdtName}`, apiHost)) return

  const records = await fetchRecordsForCMDT(cmdtName, apiHost, sessionId)
  if (records.length > 0) {
    buildSearchIndex(`CMDTRecord:${cmdtName}`, records, apiHost)
  }
}

async function fetchRecordsForCMDT(
  cmdtApiName: string,
  sfHost: string,
  sessionId: string
): Promise<any[]> {
  const host = normalizeHost(sfHost)
  const endpoint = `https://${host}/services/data/v${API_VERSION}/query`

  const start = Date.now()
  const query = `SELECT Id, DeveloperName, MasterLabel, NamespacePrefix FROM ${cmdtApiName} ORDER BY MasterLabel ASC LIMIT 2000`

  try {
    const records = await fetchAllPages(`${endpoint}?q=${encodeURIComponent(query)}`, host, sessionId)
    const enrichedRecords = records.map((record: any) => ({
      ...record,
      _parentType: cmdtApiName,
      _parentLabel: cmdtApiName.replace('__mdt', '').replace(/_/g, ' '),
      _isTypeDefinition: false,
      _recordType: 'Record'
    }))

    logger.debug('fetch:cmdt-records', { cmdt: cmdtApiName, count: enrichedRecords.length, ms: Date.now() - start })
    return enrichedRecords
  } catch (error) {
    logger.error('fetch:cmdt-records failed', { cmdt: cmdtApiName, error })
    return []
  }
}

// Cache of Custom Setting API names for dot-notation detection
const customSettingCache = new Map<string, Set<string>>()

async function checkIsCustomSetting(objectName: string, sfHost: string, sessionId: string): Promise<boolean> {
  const host = normalizeHost(sfHost)

  // Check cache first
  if (!customSettingCache.has(host)) {
    // Fetch Custom Settings list and cache
    await ensureMetadataIndex('CustomSetting', host, sessionId)
    const settings = searchIndex('', 'CustomSetting', host, { useFuzzy: false, hideManagedPackage: false })
    const settingNames = new Set(settings.map(s => s.metadata?.QualifiedApiName?.toLowerCase()).filter(Boolean))
    customSettingCache.set(host, settingNames)
  }

  const settingNames = customSettingCache.get(host)
  return settingNames?.has(objectName.toLowerCase()) || false
}

async function ensureCustomSettingRecordIndex(settingName: string, apiHost: string, sessionId: string): Promise<void> {
  if (hasSearchIndex(`CustomSettingRecord:${settingName}`, apiHost)) return

  const records = await fetchRecordsForCustomSetting(settingName, apiHost, sessionId)
  if (records.length > 0) {
    buildSearchIndex(`CustomSettingRecord:${settingName}`, records, apiHost)
  }
}

async function fetchRecordsForCustomSetting(
  settingApiName: string,
  sfHost: string,
  sessionId: string
): Promise<any[]> {
  const host = normalizeHost(sfHost)
  const endpoint = `https://${host}/services/data/v${API_VERSION}/query`

  const start = Date.now()
  // Custom Settings use Name field, query common fields
  const query = `SELECT Id, Name, SetupOwnerId FROM ${settingApiName} ORDER BY Name ASC`

  try {
    const records = await fetchAllPages(`${endpoint}?q=${encodeURIComponent(query)}`, host, sessionId)
    const enrichedRecords = records.map((record: any) => ({
      ...record,
      _parentType: settingApiName,
      _parentLabel: settingApiName.replace('__c', '').replace(/_/g, ' '),
      _isSettingDefinition: false,
      _recordType: 'Record'
    }))

    logger.debug('fetch:custom-setting-records', { setting: settingApiName, count: enrichedRecords.length, ms: Date.now() - start })
    return enrichedRecords
  } catch (error) {
    logger.error('fetch:custom-setting-records failed', { setting: settingApiName, error })
    return []
  }
}

async function searchMetadataTypes(
  query: string,
  selectedTypes: string[],
  apiHost: string,
  sessionId: string,
  useFuzzy: boolean,
  hideManagedPackage: boolean
): Promise<Record<string, SearchResult[]>> {
  const results: Record<string, SearchResult[]> = {}

  const searchPromises = selectedTypes.map(async (metadataType) => {
    try {
      await ensureMetadataIndex(metadataType, apiHost, sessionId)
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

async function ensureMetadataIndex(
  metadataType: string,
  apiHost: string,
  sessionId: string
): Promise<void> {
  const { data, fromCache } = await listMetadata(metadataType, apiHost, sessionId)

  // Rebuild index if fresh data or index missing
  if (!fromCache || !hasSearchIndex(metadataType, apiHost)) {
    buildSearchIndex(metadataType, data, apiHost)
  }
}

// Types that should always fetch fresh data (no cache)
// CustomLabel needs fresh data to search Value field (not cached to save storage)
const REALTIME_TYPES: string[] = ['CustomLabel']

async function listMetadata(
  metadataType: string,
  sfHost: string,
  sessionId: string,
  forceRefresh = false
): Promise<{ data: any[]; fromCache: boolean }> {
  const cache = MetadataCache.getInstance()
  const cacheKey = normalizeHost(sfHost)

  // Skip cache for real-time types
  const skipCache = forceRefresh || REALTIME_TYPES.includes(metadataType)

  if (!skipCache) {
    const cachedData = await cache.get(cacheKey, metadataType)
    if (cachedData) {
      return { data: cachedData, fromCache: true }
    }
  }

  const freshData = await fetchMetadataFromAPI(metadataType, sfHost, sessionId)

  // Skip caching for real-time types to avoid quota issues
  if (!REALTIME_TYPES.includes(metadataType)) {
    await cache.set(cacheKey, metadataType, freshData)
  }

  return { data: freshData, fromCache: false }
}

interface FetchOptions {
  batchSize?: number
  maxRecords?: number
  onBatch?: (records: any[]) => Promise<void>
  skipLocalCollection?: boolean
}

async function fetchAllPages(
  initialUrl: string,
  sfHost: string,
  sessionId: string,
  options: FetchOptions = {}
): Promise<any[]> {
  const {
    batchSize = 2000,
    maxRecords = Infinity,
    onBatch,
    skipLocalCollection = false
  } = options

  const host = normalizeHost(sfHost)
  const baseUrl = `https://${host}`
  const allRecords: any[] = []
  let url = initialUrl
  let totalSize: number | null = null
  let fetchedCount = 0

  while (url) {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${sessionId}`,
        'Content-Type': 'application/json',
        'Sforce-Query-Options': `batchSize=${batchSize}`
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      if (response.status === 401) {
        throw new Error('Session expired')
      }
      throw new Error(`API ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    const records = data.records || []

    // Get total size from first response
    if (totalSize === null && data.totalSize !== undefined) {
      totalSize = data.totalSize
      logger.debug('fetch:start', { total: totalSize })
    }

    if (records.length > 0) {
      const remaining = maxRecords - fetchedCount
      const batchToProcess = records.slice(0, Math.min(records.length, remaining))
      fetchedCount += batchToProcess.length

      // Batch callback for streaming processing
      if (onBatch) {
        await onBatch(batchToProcess)
      }

      // Collect records unless skipped (for large datasets to avoid OOM)
      if (!skipLocalCollection) {
        allRecords.push(...batchToProcess)
      }

      // Log progress
      if (totalSize && totalSize > batchSize) {
        logger.debug('fetch:progress', {
          fetched: fetchedCount,
          total: totalSize,
          percent: Math.round((fetchedCount / totalSize) * 100)
        })
      }

      // Check max records limit
      if (fetchedCount >= maxRecords) {
        logger.debug('fetch:limit-reached', { fetched: fetchedCount, max: maxRecords })
        break
      }
    }

    // Get next page URL (queryMore pattern)
    url = data.nextRecordsUrl ? `${baseUrl}${data.nextRecordsUrl}` : ''
  }

  logger.debug('fetch:complete', { total: fetchedCount })
  return allRecords
}

// Types that use regular REST API (not Tooling API)
const REST_API_TYPES = ['CustomObject', 'CustomSetting', 'User']

async function fetchMetadataFromAPI(
  metadataType: string,
  sfHost: string,
  sessionId: string
): Promise<any[]> {
  const host = normalizeHost(sfHost)

  // Special handling for CustomMetadataType - only fetch type definitions
  // Records are fetched via dot-notation search (Type__mdt.)
  if (metadataType === 'CustomMetadataType') {
    return await fetchCustomMetadataTypes(host, sessionId)
  }

  // Special handling for CustomSetting - mark as type definitions
  // Records are fetched via dot-notation search (Setting__c.)
  if (metadataType === 'CustomSetting') {
    return await fetchCustomSettings(host, sessionId)
  }

  const config = METADATA_TYPES[metadataType]

  if (!config) {
    throw new Error(`Unknown metadata type: ${metadataType}`)
  }

  const start = Date.now()
  // Use regular REST API for EntityDefinition queries, Tooling API for others
  const apiPath = REST_API_TYPES.includes(metadataType) ? 'query' : 'tooling/query'
  const endpoint = `https://${host}/services/data/v${API_VERSION}/${apiPath}`
  const url = `${endpoint}?q=${encodeURIComponent(config.query)}`

  logger.debug('fetch:soql', { type: metadataType, api: apiPath, query: config.query })

  const records = await fetchAllPages(url, host, sessionId)
  logger.debug('fetch:metadata', { type: metadataType, count: records.length, ms: Date.now() - start })

  return records
}

async function fetchCustomMetadataTypes(
  sfHost: string,
  sessionId: string
): Promise<any[]> {
  const start = Date.now()
  const dataEndpoint = `https://${sfHost}/services/data/v${API_VERSION}/query`

  // Get all Custom Metadata Type definitions using EntityDefinition (QualifiedApiName ends with __mdt)
  // Only fetch type definitions here - records are fetched via dot-notation search (Type__mdt.)
  const typeQuery = `SELECT DurableId, QualifiedApiName, Label, NamespacePrefix FROM EntityDefinition WHERE QualifiedApiName LIKE '%__mdt' ORDER BY QualifiedApiName ASC LIMIT 500`
  logger.debug('fetch:cmdt:types', { query: typeQuery })
  const types = await fetchAllPages(`${dataEndpoint}?q=${encodeURIComponent(typeQuery)}`, sfHost, sessionId)
  logger.debug('fetch:cmdt:types:result', { count: types.length, types: types.map((t: any) => t.QualifiedApiName) })

  // Add the type definitions as searchable items
  const allRecords: any[] = []
  for (const t of types) {
    allRecords.push({
      ...t,
      Id: t.DurableId,
      MasterLabel: t.Label || t.QualifiedApiName.replace('__mdt', '').replace(/_/g, ' '),
      _isTypeDefinition: true,
      _recordType: 'TypeDefinition'
    })
  }

  logger.debug('fetch:metadata', { type: 'CustomMetadataType', count: allRecords.length, ms: Date.now() - start })

  return allRecords
}

async function fetchCustomSettings(
  sfHost: string,
  sessionId: string
): Promise<any[]> {
  const start = Date.now()
  const dataEndpoint = `https://${sfHost}/services/data/v${API_VERSION}/query`

  // Get all Custom Setting definitions using EntityDefinition
  // Only fetch type definitions here - records are fetched via dot-notation search (Setting__c.)
  const typeQuery = `SELECT DurableId, QualifiedApiName, DeveloperName, Label, NamespacePrefix FROM EntityDefinition WHERE IsCustomSetting = true ORDER BY QualifiedApiName ASC LIMIT 2000`
  logger.debug('fetch:custom-setting:types', { query: typeQuery })
  const types = await fetchAllPages(`${dataEndpoint}?q=${encodeURIComponent(typeQuery)}`, sfHost, sessionId)
  logger.debug('fetch:custom-setting:types:result', { count: types.length })

  // Add the type definitions as searchable items with _isSettingDefinition flag
  const allRecords: any[] = []
  for (const t of types) {
    allRecords.push({
      ...t,
      Id: t.DurableId,
      _isSettingDefinition: true,
      _recordType: 'SettingDefinition'
    })
  }

  logger.debug('fetch:metadata', { type: 'CustomSetting', count: allRecords.length, ms: Date.now() - start })

  return allRecords
}

async function fetchFieldsForObject(
  objectApiName: string,
  sfHost: string,
  sessionId: string
): Promise<any[]> {
  const host = normalizeHost(sfHost)
  const endpoint = `https://${host}/services/data/v${API_VERSION}/tooling/query`

  const start = Date.now()
  const escapedName = escapeSoql(objectApiName)
  const query = `SELECT Id, DurableId, QualifiedApiName, Label, DataType, EntityDefinition.QualifiedApiName FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName = '${escapedName}' ORDER BY QualifiedApiName ASC`

  try {
    const records = await fetchAllPages(`${endpoint}?q=${encodeURIComponent(query)}`, host, sessionId)
    const fields = records.map((field: any) => ({
      ...field,
      MasterLabel: field.Label,
      ObjectApiName: field.EntityDefinition?.QualifiedApiName || objectApiName
    }))

    logger.debug('fetch:fields', { object: objectApiName, count: fields.length, ms: Date.now() - start })
    return fields
  } catch (error) {
    logger.error('fetch:fields failed', { object: objectApiName, error })
    return []
  }
}

export async function validateSalesforceSession(sfHost: string): Promise<boolean> {
  try {
    const host = normalizeHost(sfHost)
    const session = await getSession(host)
    if (!session) return false

    const endpoint = `https://${host}/services/data/v${API_VERSION}/sobjects/`
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.key}`,
        'Content-Type': 'application/json'
      }
    })

    return response.ok
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

    const freshData = await fetchMetadataFromAPI(metadataType, host, session.key)
    await cache.set(host, metadataType, freshData)
    buildSearchIndex(metadataType, freshData, host)

    logger.debug('refresh:cache done', { type: metadataType, count: freshData.length })
  } catch (error) {
    logger.error('refresh:cache failed', { type: metadataType, error })
  }
}

export async function warmupMetadataCache(sfHost: string): Promise<void> {
  const commonTypes = ['ApexClass', 'ApexTrigger', 'Flow', 'CustomObject']
  const host = normalizeHost(sfHost)

  const session = await getSession(host)
  if (!session) return

  const start = Date.now()
  await Promise.all(
    commonTypes.map(async (type) => {
      try {
        const { data } = await listMetadata(type, host, session.key, true)
        buildSearchIndex(type, data, host)
      } catch (error) {
        logger.error('warmup failed', { type, error })
      }
    })
  )

  logger.debug('warmup:done', { types: commonTypes.length, ms: Date.now() - start })
}

export async function getCacheStats() {
  return MetadataCache.getInstance().getStats()
}

export async function clearMetadataCache(): Promise<void> {
  await MetadataCache.getInstance().clear()
  clearAllSearchIndexes()
}

export function getAvailableMetadataTypes(): string[] {
  return Object.keys(METADATA_TYPES)
}

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

  // Parse query for exact match and filter
  const { searchTerm, filterTerm, isExactMatch } = parseSearchQuery(searchQuery)

  // Replace {query} placeholder with escaped search query
  const escapedQuery = escapeSoql(searchTerm)
  const soql = soqlTemplate.replace(/\{query\}/gi, escapedQuery)

  const apiPath = useToolingApi ? 'tooling/query' : 'query'
  const endpoint = `https://${apiHost}/services/data/v${API_VERSION}/${apiPath}`
  const url = `${endpoint}?q=${encodeURIComponent(soql)}`

  logger.debug('custom-command:execute', { soql, api: apiPath })

  try {
    const records = await fetchAllPages(url, apiHost, session.key, { maxRecords: 100 })
    logger.debug('custom-command:result', { count: records.length, ms: Date.now() - start })

    let results: SearchResult[] = records.map((record: any) => ({
      id: record.Id || record.DurableId || '',
      name: getFieldValue(record, nameField) || 'Unknown',
      type: 'CustomQuery',
      description: buildDescriptionFromFields(record, descriptionFields, nameField),
      metadata: record
    }))

    // Apply exact match filter
    if (isExactMatch && searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      results = results.filter((r) => r.name.toLowerCase() === searchLower)
    }

    // Apply post-filter if present
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
  // Try to parse Salesforce API error
  const apiMatch = errorMessage.match(/API \d+: (.+)/)
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
      .map(field => getFieldValue(record, field.trim()))
      .filter(v => v)
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
