// Metadata fetching, pagination, and cache management
// Extracted from salesforce-api.ts for independent testability

import { sfRest, API_VERSION } from './auth'
import { MetadataCache } from './metadata-cache'
import { METADATA_TYPES } from './metadata-types'
import type { SfEntityDefinition, SfFieldDefinition } from './metadata-types'
import { logger } from './logger'
import { markTypeUnsupported } from './unsupported-types'
import { normalizeHost, escapeSoql } from './domain-utils'
import { buildSearchIndex, hasSearchIndex } from './fuzzy-search'

export interface FetchOptions {
  maxRecords?: number
  onBatch?: (records: Record<string, unknown>[]) => Promise<void>
  skipLocalCollection?: boolean
}

interface SfQueryResponse<T> {
  records: T[]
  totalSize?: number
  done: boolean
  nextRecordsUrl?: string
}

// Types that use regular REST API (not Tooling API)
const REST_API_TYPES = ['CustomObject', 'CustomSetting', 'User', 'Report', 'Dashboard']

// Types that should always fetch fresh data (no cache)
const REALTIME_TYPES: string[] = ['CustomLabel']

export async function fetchAllPages<T extends Record<string, unknown> = Record<string, unknown>>(
  sfHost: string,
  initialPath: string,
  options: FetchOptions = {}
): Promise<T[]> {
  const {
    maxRecords = Infinity,
    onBatch,
    skipLocalCollection = false
  } = options

  const allRecords: T[] = []
  let path: string | null = initialPath
  let totalSize: number | null = null
  let fetchedCount = 0

  while (path) {
    const data: SfQueryResponse<T> = await sfRest<SfQueryResponse<T>>(sfHost, path)
    const records: T[] = data.records || []

    if (totalSize === null && data.totalSize !== undefined) {
      totalSize = data.totalSize
      logger.debug('fetch:start', { total: totalSize })
    }

    if (records.length > 0) {
      const remaining = maxRecords - fetchedCount
      const batchToProcess = records.slice(0, Math.min(records.length, remaining))
      fetchedCount += batchToProcess.length

      if (onBatch) {
        await onBatch(batchToProcess as unknown as Record<string, unknown>[])
      }

      if (!skipLocalCollection) {
        allRecords.push(...batchToProcess)
      }

      if (totalSize && totalSize > 2000) {
        logger.debug('fetch:progress', {
          fetched: fetchedCount,
          total: totalSize,
          percent: Math.round((fetchedCount / totalSize) * 100)
        })
      }

      if (fetchedCount >= maxRecords) {
        logger.debug('fetch:limit-reached', { fetched: fetchedCount, max: maxRecords })
        break
      }
    }

    path = data.nextRecordsUrl || null
  }

  logger.debug('fetch:complete', { total: fetchedCount })
  return allRecords
}

export async function fetchMetadataFromAPI(
  metadataType: string,
  sfHost: string
): Promise<Record<string, unknown>[]> {
  const host = normalizeHost(sfHost)

  if (metadataType === 'CustomMetadataType') {
    return await fetchCustomMetadataTypes(host)
  }

  if (metadataType === 'CustomSetting') {
    return await fetchCustomSettings(host)
  }

  const config = METADATA_TYPES[metadataType]
  if (!config) {
    throw new Error(`Unknown metadata type: ${metadataType}`)
  }

  const start = Date.now()
  const apiPath = REST_API_TYPES.includes(metadataType) ? 'query' : 'tooling/query'
  const queryPath = `/services/data/v${API_VERSION}/${apiPath}?q=${encodeURIComponent(config.query)}`

  logger.debug('fetch:soql', { type: metadataType, api: apiPath, query: config.query })

  try {
    const records = await fetchAllPages(host, queryPath)
    logger.debug('fetch:metadata', { type: metadataType, count: records.length, ms: Date.now() - start })
    return records
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('INVALID_TYPE') || message.includes('not supported')) {
      logger.warn('fetch:metadata:unsupported', { type: metadataType, host })
      await markTypeUnsupported(host, metadataType)
      return []
    }
    throw error
  }
}

interface CmdtTypeRecord extends Record<string, unknown> {
  DurableId: string
  QualifiedApiName: string
  Label: string
}

async function fetchCustomMetadataTypes(sfHost: string): Promise<Record<string, unknown>[]> {
  const start = Date.now()
  const typeQuery = `SELECT DurableId, QualifiedApiName, Label, NamespacePrefix FROM EntityDefinition WHERE QualifiedApiName LIKE '%__mdt' ORDER BY QualifiedApiName ASC LIMIT 500`
  const queryPath = `/services/data/v${API_VERSION}/query?q=${encodeURIComponent(typeQuery)}`

  logger.debug('fetch:cmdt:types', { query: typeQuery })
  const types = await fetchAllPages<CmdtTypeRecord>(sfHost, queryPath)
  logger.debug('fetch:cmdt:types:result', { count: types.length, types: types.map((t) => t.QualifiedApiName) })

  const allRecords: Record<string, unknown>[] = []
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

interface CustomSettingRecord extends Record<string, unknown> {
  DurableId: string
  QualifiedApiName: string
  DeveloperName: string
  Label: string
  NamespacePrefix: string | null
}

async function fetchCustomSettings(sfHost: string): Promise<Record<string, unknown>[]> {
  const start = Date.now()
  const typeQuery = `SELECT DurableId, QualifiedApiName, DeveloperName, Label, NamespacePrefix FROM EntityDefinition WHERE IsCustomSetting = true ORDER BY QualifiedApiName ASC LIMIT 2000`
  const queryPath = `/services/data/v${API_VERSION}/query?q=${encodeURIComponent(typeQuery)}`

  logger.debug('fetch:custom-setting:types', { query: typeQuery })
  const types = await fetchAllPages<CustomSettingRecord>(sfHost, queryPath)
  logger.debug('fetch:custom-setting:types:result', { count: types.length })

  const allRecords: Record<string, unknown>[] = []
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

interface FieldRecord extends Record<string, unknown> {
  Id: string
  DurableId: string
  QualifiedApiName: string
  Label: string
  DataType: string
  EntityDefinition: { QualifiedApiName: string } | null
}

export async function fetchFieldsForObject(
  objectApiName: string,
  sfHost: string
): Promise<Record<string, unknown>[]> {
  const host = normalizeHost(sfHost)
  const start = Date.now()
  const escapedName = escapeSoql(objectApiName)
  const query = `SELECT Id, DurableId, QualifiedApiName, Label, DataType, EntityDefinition.QualifiedApiName FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName = '${escapedName}' ORDER BY QualifiedApiName ASC`
  const queryPath = `/services/data/v${API_VERSION}/tooling/query?q=${encodeURIComponent(query)}`

  try {
    const records = await fetchAllPages<FieldRecord>(host, queryPath)
    const fields = records.map((field) => ({
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

interface CmdtRecord extends Record<string, unknown> {
  Id: string
  DeveloperName: string
  MasterLabel: string
  NamespacePrefix: string | null
}

export async function fetchRecordsForCMDT(
  cmdtApiName: string,
  sfHost: string
): Promise<Record<string, unknown>[]> {
  const host = normalizeHost(sfHost)
  const start = Date.now()
  const query = `SELECT Id, DeveloperName, MasterLabel, NamespacePrefix FROM ${cmdtApiName} ORDER BY MasterLabel ASC LIMIT 2000`
  const queryPath = `/services/data/v${API_VERSION}/query?q=${encodeURIComponent(query)}`

  try {
    const records = await fetchAllPages<CmdtRecord>(host, queryPath)
    const enrichedRecords = records.map((record) => ({
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

interface CustomSettingDataRecord extends Record<string, unknown> {
  Id: string
  Name: string
  SetupOwnerId: string
}

export async function fetchRecordsForCustomSetting(
  settingApiName: string,
  sfHost: string
): Promise<Record<string, unknown>[]> {
  const host = normalizeHost(sfHost)
  const start = Date.now()
  const query = `SELECT Id, Name, SetupOwnerId FROM ${settingApiName} ORDER BY Name ASC`
  const queryPath = `/services/data/v${API_VERSION}/query?q=${encodeURIComponent(query)}`

  try {
    const records = await fetchAllPages<CustomSettingDataRecord>(host, queryPath)
    const enrichedRecords = records.map((record) => ({
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

export async function ensureFieldIndex(objectName: string, sfHost: string): Promise<void> {
  if (hasSearchIndex(`Field:${objectName}`, sfHost)) return

  const fields = await fetchFieldsForObject(objectName, sfHost)
  if (fields.length > 0) {
    buildSearchIndex(`Field:${objectName}`, fields, sfHost)
  }
}

export async function ensureCMDTRecordIndex(cmdtName: string, sfHost: string): Promise<void> {
  if (hasSearchIndex(`CMDTRecord:${cmdtName}`, sfHost)) return

  const records = await fetchRecordsForCMDT(cmdtName, sfHost)
  if (records.length > 0) {
    buildSearchIndex(`CMDTRecord:${cmdtName}`, records, sfHost)
  }
}

export async function ensureCustomSettingRecordIndex(settingName: string, sfHost: string): Promise<void> {
  if (hasSearchIndex(`CustomSettingRecord:${settingName}`, sfHost)) return

  const records = await fetchRecordsForCustomSetting(settingName, sfHost)
  if (records.length > 0) {
    buildSearchIndex(`CustomSettingRecord:${settingName}`, records, sfHost)
  }
}

export async function ensureMetadataIndex(
  metadataType: string,
  sfHost: string
): Promise<void> {
  const { data, fromCache } = await getMetadataWithCache(metadataType, sfHost)

  if (!fromCache || !hasSearchIndex(metadataType, sfHost)) {
    buildSearchIndex(metadataType, data, sfHost)
  }
}

export async function getMetadataWithCache(
  metadataType: string,
  sfHost: string,
  forceRefresh = false
): Promise<{ data: Record<string, unknown>[]; fromCache: boolean }> {
  const cache = MetadataCache.getInstance()
  const cacheKey = normalizeHost(sfHost)

  const skipCache = forceRefresh || REALTIME_TYPES.includes(metadataType)

  if (!skipCache) {
    const cachedData = await cache.get(cacheKey, metadataType)
    if (cachedData) {
      return { data: cachedData, fromCache: true }
    }
  }

  const freshData = await fetchMetadataFromAPI(metadataType, sfHost)

  if (!REALTIME_TYPES.includes(metadataType)) {
    await cache.set(cacheKey, metadataType, freshData)
  }

  return { data: freshData, fromCache: false }
}
