import MiniSearch from 'minisearch'
import type { SearchResult } from '~types'
import { logger } from './logger'

interface IndexedRecord {
  id: string
  name: string
  label?: string
  apiName?: string
  description?: string
  type: string
  originalRecord: any
}

interface SearchIndexEntry {
  miniSearch: MiniSearch<IndexedRecord>
  records: Map<string, IndexedRecord>
  lastUpdated: number
}

const searchIndexes = new Map<string, SearchIndexEntry>()

const FIELD_BOOST = {
  name: 2.0,
  label: 1.5,
  apiName: 1.2,
  description: 0.8
}

function createMiniSearchInstance(): MiniSearch<IndexedRecord> {
  return new MiniSearch<IndexedRecord>({
    fields: ['name', 'label', 'apiName', 'description'],
    storeFields: ['name', 'label', 'apiName', 'description', 'type', 'originalRecord'],
    searchOptions: {
      boost: FIELD_BOOST,
      fuzzy: 0.2,
      prefix: true,
      combineWith: 'AND'
    },
    tokenize: (text) => {
      if (!text) return []
      return text
        .toLowerCase()
        .split(/[\s_\-\.]+/)
        .filter((token) => token.length > 0)
    }
  })
}

function recordToIndexedRecord(record: any, metadataType: string): IndexedRecord {
  let name = ''
  let label = ''
  let apiName = ''
  let description = ''
  let actualType = metadataType

  if (metadataType.startsWith('Field:')) {
    actualType = 'CustomField'
    name = record.MasterLabel || record.Label || record.QualifiedApiName || ''
    label = record.MasterLabel || record.Label || ''
    apiName = record.QualifiedApiName || ''
    description = `${record.ObjectApiName || 'Object'}.${apiName} (${record.DataType || 'Field'})`
  } else {
    switch (metadataType) {
      case 'ApexClass':
      case 'ApexTrigger':
        name = record.Name || ''
        apiName = record.Name || ''
        break
      case 'CustomObject':
        name = record.Label || record.QualifiedApiName || ''
        label = record.Label || ''
        apiName = record.QualifiedApiName || ''
        break
      case 'CustomField':
        name = record.MasterLabel || record.QualifiedApiName || ''
        label = record.MasterLabel || ''
        apiName = record.QualifiedApiName || ''
        description = `${record.DataType || ''} in ${record.ObjectApiName || ''}`
        break
      case 'Flow':
        name = record.MasterLabel || ''
        label = record.MasterLabel || ''
        description = `v${record.VersionNumber || ''} - ${record.Status || ''}`
        break
      case 'User':
        name = record.Name || ''
        description = record.Username || ''
        break
      case 'PermissionSet':
        name = record.Label || record.Name || ''
        label = record.Label || ''
        apiName = record.Name || ''
        break
      case 'Profile':
        name = record.Name || ''
        break
      default:
        name = record.Name || record.QualifiedApiName || record.MasterLabel || ''
    }
  }

  // Field ID: ObjectName.FieldName for uniqueness
  let id: string
  if (metadataType.startsWith('Field:') || actualType === 'CustomField') {
    id = `${record.ObjectApiName || 'Unknown'}.${record.QualifiedApiName || name}`
  } else {
    id = record.Id || record.DurableId || record.QualifiedApiName || `${metadataType}-${name}`
  }

  return { id, name, label, apiName, description, type: actualType, originalRecord: record }
}

export function buildSearchIndex(metadataType: string, records: any[], sfHost: string): void {
  const indexKey = `${sfHost}:${metadataType}`
  const miniSearch = createMiniSearchInstance()
  const recordsMap = new Map<string, IndexedRecord>()
  const seenIds = new Set<string>()

  for (const record of records) {
    const indexed = recordToIndexedRecord(record, metadataType)
    if (!seenIds.has(indexed.id)) {
      seenIds.add(indexed.id)
      recordsMap.set(indexed.id, indexed)
    }
  }

  miniSearch.addAll(Array.from(recordsMap.values()))

  searchIndexes.set(indexKey, {
    miniSearch,
    records: recordsMap,
    lastUpdated: Date.now()
  })

  logger.debug('index:build', { type: metadataType, count: recordsMap.size })
}

export function searchIndex(
  query: string,
  metadataType: string,
  sfHost: string,
  useFuzzy = true
): SearchResult[] {
  const indexKey = `${sfHost}:${metadataType}`
  const index = searchIndexes.get(indexKey)

  if (!index) {
    logger.debug('index:missing', { type: metadataType })
    return []
  }

  // Empty query returns all records
  if (!query.trim()) {
    return Array.from(index.records.values()).map((r) => toSearchResult(r))
  }

  const searchResults = index.miniSearch.search(query, {
    fuzzy: useFuzzy ? (term) => (term.length <= 3 ? false : 0.2) : false,
    prefix: true,
    boost: FIELD_BOOST,
    combineWith: 'AND'
  })

  return searchResults
    .map((result) => {
      const indexed = index.records.get(result.id)
      return indexed ? toSearchResult(indexed, result.score) : null
    })
    .filter((r): r is SearchResult => r !== null)
}

function toSearchResult(indexed: IndexedRecord, score?: number): SearchResult {
  const record = indexed.originalRecord

  const result: SearchResult = {
    id: indexed.id,
    name: indexed.name,
    type: indexed.type,
    namespace: record.NamespacePrefix || undefined,
    lastModified: record.LastModifiedDate || undefined,
    metadata: record,
    score
  }

  switch (indexed.type) {
    case 'CustomObject':
      result.description =
        record.QualifiedApiName !== record.Label ? record.QualifiedApiName : undefined
      break
    case 'CustomField':
      result.description = indexed.description
      break
    case 'User':
      result.description = record.Username
      break
    case 'Flow':
      result.description = indexed.description
      break
    case 'PermissionSet':
      result.description = record.Name !== record.Label ? record.Name : undefined
      break
  }

  return result
}

export function clearSearchIndex(metadataType: string, sfHost: string): void {
  const indexKey = `${sfHost}:${metadataType}`
  searchIndexes.delete(indexKey)
}

export function clearAllSearchIndexes(): void {
  searchIndexes.clear()
}

export function hasSearchIndex(metadataType: string, sfHost: string): boolean {
  return searchIndexes.has(`${sfHost}:${metadataType}`)
}
