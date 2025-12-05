import type { SearchResult } from '~types'
import { MetadataCache } from './metadata-cache'
import { getSession, API_VERSION } from './auth'
import { logger } from './logger'
import {
  buildSearchIndex,
  searchIndex,
  hasSearchIndex,
  clearSearchIndex,
  clearAllSearchIndexes
} from './fuzzy-search'

const METADATA_TYPES: Record<string, { query: string }> = {
  ApexClass: {
    query: `SELECT Id, Name, NamespacePrefix, LastModifiedDate FROM ApexClass ORDER BY Name ASC LIMIT 50000`
  },
  ApexTrigger: {
    query: `SELECT Id, Name, NamespacePrefix, LastModifiedDate FROM ApexTrigger ORDER BY Name ASC LIMIT 10000`
  },
  CustomObject: {
    query: `SELECT QualifiedApiName, Label, DurableId, KeyPrefix FROM EntityDefinition WHERE IsCustomizable = true ORDER BY QualifiedApiName ASC LIMIT 10000`
  },
  Flow: {
    query: `SELECT Id, MasterLabel, VersionNumber, Status FROM Flow ORDER BY MasterLabel ASC LIMIT 10000`
  },
  User: {
    query: `SELECT Id, Name, Username, IsActive FROM User ORDER BY Name ASC LIMIT 5000`
  },
  PermissionSet: {
    query: `SELECT Id, Name, Label, NamespacePrefix FROM PermissionSet ORDER BY Label ASC LIMIT 2000`
  },
  Profile: {
    query: `SELECT Id, Name FROM Profile ORDER BY Name ASC LIMIT 1000`
  }
}

export interface SearchOptions {
  useFuzzy?: boolean
}

function normalizeHost(host: string): string {
  if (!host) return host
  return host
    .replace(/^https?:\/\//, '')
    .replace(/\.lightning\.force\./, '.my.salesforce.')
    .replace(/\.(lightning|file|content|c)\.sfcrmproducts\./, '.my.sfcrmproducts.')
    .replace(/\.(lightning|file|content|c)\.sfcrmapps\./, '.my.sfcrmapps.')
    .replace(/\.mcas\.ms$/, '')
}

function parseDotNotation(query: string): { objectName: string; fieldQuery: string } | null {
  const dotIndex = query.indexOf('.')
  if (dotIndex === -1) return null

  const objectName = query.substring(0, dotIndex).trim()
  const fieldQuery = query.substring(dotIndex + 1).trim()

  if (objectName.length === 0) return null

  return { objectName, fieldQuery }
}

function escapeSoqlLike(input: string): string {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
}

export async function searchSalesforceMetadata(
  query: string,
  selectedTypes: string[],
  sfHost: string,
  options: SearchOptions = {}
): Promise<Record<string, SearchResult[]>> {
  const { useFuzzy = true } = options

  if (!sfHost) {
    logger.error('searchSalesforceMetadata: missing sfHost')
    return {}
  }

  const session = await getSession(sfHost)
  if (!session) {
    logger.error('searchSalesforceMetadata: no session', { host: sfHost })
    return {}
  }

  const apiHost = normalizeHost(sfHost)
  const results: Record<string, SearchResult[]> = {}
  const dotNotation = parseDotNotation(query)

  // Dot-notation field search: "Account.Name" or "account."
  if (dotNotation && selectedTypes.includes('CustomField')) {
    const { objectName, fieldQuery } = dotNotation
    logger.debug('search:field', { object: objectName, query: fieldQuery })

    try {
      await ensureFieldIndex(objectName, apiHost, session.key)
      if (hasSearchIndex(`Field:${objectName}`, apiHost)) {
        results['CustomField'] = searchIndex(fieldQuery, `Field:${objectName}`, apiHost, useFuzzy)
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
      const otherResults = await searchMetadataTypes(query, otherTypes, apiHost, session.key, useFuzzy)
      Object.assign(results, otherResults)
    }

    return results
  }

  // Filter out CustomField for non-dot-notation queries (CustomField requires dot-notation)
  const typesToSearch = selectedTypes.filter((t) => t !== 'CustomField')
  return await searchMetadataTypes(query, typesToSearch, apiHost, session.key, useFuzzy)
}

async function ensureFieldIndex(objectName: string, apiHost: string, sessionId: string): Promise<void> {
  if (hasSearchIndex(`Field:${objectName}`, apiHost)) return

  const fields = await fetchFieldsForObject(objectName, apiHost, sessionId)
  if (fields.length > 0) {
    buildSearchIndex(`Field:${objectName}`, fields, apiHost)
  }
}

async function searchMetadataTypes(
  query: string,
  selectedTypes: string[],
  apiHost: string,
  sessionId: string,
  useFuzzy: boolean
): Promise<Record<string, SearchResult[]>> {
  const results: Record<string, SearchResult[]> = {}

  const searchPromises = selectedTypes.map(async (metadataType) => {
    try {
      await ensureMetadataIndex(metadataType, apiHost, sessionId)
      const searchResults = searchIndex(query, metadataType, apiHost, useFuzzy)
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

async function listMetadata(
  metadataType: string,
  sfHost: string,
  sessionId: string,
  forceRefresh = false
): Promise<{ data: any[]; fromCache: boolean }> {
  const cache = MetadataCache.getInstance()
  const cacheKey = normalizeHost(sfHost)

  if (!forceRefresh) {
    const cachedData = await cache.get(cacheKey, metadataType)
    if (cachedData) {
      return { data: cachedData, fromCache: true }
    }
  }

  const freshData = await fetchMetadataFromAPI(metadataType, sfHost, sessionId)
  await cache.set(cacheKey, metadataType, freshData)

  return { data: freshData, fromCache: false }
}

async function fetchAllPages(
  initialUrl: string,
  sfHost: string,
  sessionId: string
): Promise<any[]> {
  const host = normalizeHost(sfHost)
  const baseUrl = `https://${host}`
  let allRecords: any[] = []
  let url = initialUrl

  while (url) {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${sessionId}`,
        'Content-Type': 'application/json'
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
    allRecords = allRecords.concat(data.records || [])

    url = data.nextRecordsUrl ? `${baseUrl}${data.nextRecordsUrl}` : ''
  }

  return allRecords
}

async function fetchMetadataFromAPI(
  metadataType: string,
  sfHost: string,
  sessionId: string
): Promise<any[]> {
  const host = normalizeHost(sfHost)
  const config = METADATA_TYPES[metadataType]

  if (!config) {
    throw new Error(`Unknown metadata type: ${metadataType}`)
  }

  const start = Date.now()
  const endpoint = `https://${host}/services/data/v${API_VERSION}/tooling/query`
  const url = `${endpoint}?q=${encodeURIComponent(config.query)}`

  const records = await fetchAllPages(url, host, sessionId)
  logger.debug('fetch:metadata', { type: metadataType, count: records.length, ms: Date.now() - start })

  return records
}

async function fetchFieldsForObject(
  objectApiName: string,
  sfHost: string,
  sessionId: string
): Promise<any[]> {
  const host = normalizeHost(sfHost)
  const endpoint = `https://${host}/services/data/v${API_VERSION}/tooling/query`

  const start = Date.now()
  const escapedName = escapeSoqlLike(objectApiName)
  const query = `SELECT Id, DurableId, QualifiedApiName, Label, DataType, EntityDefinition.QualifiedApiName FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName LIKE '${escapedName}' ORDER BY QualifiedApiName ASC`

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
