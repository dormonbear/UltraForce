import MiniSearch from 'minisearch'
import type { SearchResult } from '~types'
import { logger } from './logger'

interface IndexedRecord {
  id: string
  name: string
  label?: string
  apiName?: string
  description?: string
  searchTerms?: string
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
  searchTerms: 1.0,
  description: 0.8
}

function createMiniSearchInstance(): MiniSearch<IndexedRecord> {
  return new MiniSearch<IndexedRecord>({
    fields: ['name', 'label', 'apiName', 'searchTerms', 'description'],
    storeFields: ['name', 'label', 'apiName', 'description', 'searchTerms', 'type', 'originalRecord'],
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
        .split(/[\s_\-\.,;|:\/\\]+/)
        .filter((token) => token.length > 0)
    }
  })
}

function generateSearchTerms(name: string, label: string, apiName: string): string {
  const terms: string[] = []
  const seen = new Set<string>()

  const addTerm = (term: string) => {
    const normalized = term.toLowerCase().trim()
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized)
      terms.push(normalized)
    }
  }

  // Add original terms
  addTerm(name)
  addTerm(label)
  addTerm(apiName)

  // Add concatenated versions (remove spaces, underscores, hyphens)
  const concat = (str: string) => str.replace(/[\s_\-]+/g, '').toLowerCase()
  addTerm(concat(name))
  addTerm(concat(label))
  addTerm(concat(apiName))

  // Add CamelCase split versions (e.g., "VendorContract" -> "vendor contract")
  const splitCamelCase = (str: string) => {
    return str
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .toLowerCase()
  }
  addTerm(splitCamelCase(name))
  addTerm(splitCamelCase(apiName))

  return terms.join(' ')
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
  } else if (metadataType.startsWith('CMDTRecord:')) {
    actualType = 'CustomMetadataType'
    name = record.MasterLabel || record.DeveloperName || ''
    label = record.MasterLabel || ''
    apiName = record.DeveloperName || ''
    description = record._parentLabel || record._parentType || ''
  } else if (metadataType.startsWith('CustomSettingRecord:')) {
    actualType = 'CustomSetting'
    name = record.Name || ''
    label = record.Name || ''
    apiName = record.Name || ''
    description = record._parentLabel || record._parentType || ''
  } else {
    switch (metadataType) {
      case 'ApexClass':
      case 'ApexTrigger':
        name = record.Name || ''
        apiName = record.Name || ''
        break
      case 'LightningComponentBundle':
      case 'AuraDefinitionBundle':
        name = record.MasterLabel || record.DeveloperName || ''
        label = record.MasterLabel || ''
        apiName = record.DeveloperName || ''
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
        label = record.Email || ''
        apiName = record.Username || ''
        description = record.FederationIdentifier || ''
        break
      case 'PermissionSet':
        name = record.Label || record.Name || ''
        label = record.Label || ''
        apiName = record.Name || ''
        break
      case 'Profile':
        name = record.Name || ''
        break
      case 'CustomLabel':
        name = record.MasterLabel || record.Name || ''
        label = record.MasterLabel || ''
        apiName = record.Name || ''
        // Store full Value for search indexing (truncate only for display in toSearchResult)
        description = record.Value || ''
        break
      case 'CustomMetadataType':
        if (record._isTypeDefinition) {
          // Custom Metadata Type definition (object)
          name = record.MasterLabel || record.DeveloperName || ''
          label = record.MasterLabel || ''
          apiName = record.QualifiedApiName || record.DeveloperName || ''
          description = 'Custom Metadata Type'
        } else {
          // Custom Metadata Type record
          name = record.MasterLabel || record.DeveloperName || ''
          label = record.MasterLabel || ''
          apiName = record.DeveloperName || ''
          description = record._parentLabel || record._parentType || ''
        }
        break
      case 'CustomSetting':
        name = record.Label || record.QualifiedApiName || ''
        label = record.Label || ''
        apiName = record.QualifiedApiName || record.DeveloperName || ''
        break
      default:
        name = record.Name || record.QualifiedApiName || record.MasterLabel || ''
    }
  }

  // Generate unique ID based on type
  let id: string
  if (metadataType.startsWith('Field:')) {
    // Field ID: ObjectName.FieldName for uniqueness
    id = `${record.ObjectApiName || 'Unknown'}.${record.QualifiedApiName || name}`
  } else if (metadataType.startsWith('CMDTRecord:')) {
    // CMDT Record ID: ParentType.DeveloperName for uniqueness
    id = `${record._parentType || 'Unknown'}.${record.DeveloperName || name}`
  } else if (metadataType.startsWith('CustomSettingRecord:')) {
    // Custom Setting Record ID: use actual record Id
    id = record.Id || `${record._parentType || 'Unknown'}.${record.Name || name}`
  } else {
    id = record.Id || record.DurableId || record.QualifiedApiName || `${metadataType}-${name}`
  }

  const searchTerms = generateSearchTerms(name, label, apiName)
  return { id, name, label, apiName, description, searchTerms, type: actualType, originalRecord: record }
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

interface SearchIndexOptions {
  useFuzzy?: boolean
  hideManagedPackage?: boolean
}

export interface ParsedQuery {
  searchTerm: string
  filterTerm: string | null
  isExactMatch: boolean
}

export function parseSearchQuery(query: string): ParsedQuery {
  let searchTerm = query.trim()
  let filterTerm: string | null = null
  let isExactMatch = false

  // Check for pipe filter: "search | filter"
  const pipeIndex = searchTerm.indexOf('|')
  if (pipeIndex !== -1) {
    filterTerm = searchTerm.slice(pipeIndex + 1).trim().toLowerCase()
    searchTerm = searchTerm.slice(0, pipeIndex).trim()
    if (!filterTerm) filterTerm = null
  }

  // Check for exact match: "term"
  if (searchTerm.startsWith('"') && searchTerm.endsWith('"') && searchTerm.length > 2) {
    isExactMatch = true
    searchTerm = searchTerm.slice(1, -1)
  }

  return { searchTerm, filterTerm, isExactMatch }
}

function matchesFilter(result: SearchResult, filter: string): boolean {
  const name = (result.name || '').toLowerCase()
  const description = (result.description || '').toLowerCase()
  return name.includes(filter) || description.includes(filter)
}

function isManagedPackage(record: any): boolean {
  const ns = record.NamespacePrefix
  return ns !== null && ns !== undefined && ns !== ''
}

export function searchIndex(
  query: string,
  metadataType: string,
  sfHost: string,
  useFuzzyOrOptions: boolean | SearchIndexOptions = true
): SearchResult[] {
  const options: SearchIndexOptions = typeof useFuzzyOrOptions === 'boolean'
    ? { useFuzzy: useFuzzyOrOptions }
    : useFuzzyOrOptions
  const { useFuzzy = true, hideManagedPackage = true } = options

  const indexKey = `${sfHost}:${metadataType}`
  const index = searchIndexes.get(indexKey)

  if (!index) {
    logger.debug('index:missing', { type: metadataType })
    return []
  }

  // Parse query for exact match and filter
  const { searchTerm, filterTerm, isExactMatch } = parseSearchQuery(query)

  // Empty search term returns all records (but still apply filter if present)
  if (!searchTerm) {
    let results = Array.from(index.records.values()).map((r) => toSearchResult(r))
    if (hideManagedPackage) {
      results = results.filter((r) => !isManagedPackage(r.metadata || {}))
    }
    if (filterTerm) {
      results = results.filter((r) => matchesFilter(r, filterTerm))
    }
    return results
  }

  let results: SearchResult[]

  if (isExactMatch) {
    // Exact match: filter records where name matches exactly (case-insensitive)
    const searchLower = searchTerm.toLowerCase()
    results = Array.from(index.records.values())
      .filter((r) => r.name.toLowerCase() === searchLower)
      .map((r) => toSearchResult(r))
  } else {
    // Fuzzy/prefix search
    const searchResults = index.miniSearch.search(searchTerm, {
      fuzzy: useFuzzy ? (term) => (term.length <= 3 ? false : 0.2) : false,
      prefix: true,
      boost: FIELD_BOOST,
      combineWith: 'AND'
    })

    results = searchResults
      .map((result) => {
        const indexed = index.records.get(result.id)
        return indexed ? toSearchResult(indexed, result.score) : null
      })
      .filter((r): r is SearchResult => r !== null)
  }

  if (hideManagedPackage) {
    results = results.filter((r) => !isManagedPackage(r.metadata || {}))
  }

  // Apply post-filter if present
  if (filterTerm) {
    results = results.filter((r) => matchesFilter(r, filterTerm))
  }

  return results
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
    case 'User': {
      const parts = [record.Username]
      if (record.Email) parts.push(record.Email)
      if (record.Profile?.Name) parts.push(record.Profile.Name)
      if (record.UserRole?.Name) parts.push(record.UserRole.Name)
      if (record.IsActive === false) parts.push('Inactive')
      result.description = parts.join(' | ')
      break
    }
    case 'Flow':
      result.description = indexed.description
      break
    case 'PermissionSet':
      result.description = record.Name !== record.Label ? record.Name : undefined
      break
    case 'LightningComponentBundle':
    case 'AuraDefinitionBundle':
      result.description = record.DeveloperName !== record.MasterLabel ? record.DeveloperName : undefined
      break
    case 'CustomLabel': {
      const value = indexed.description || ''
      result.description = value.length > 80 ? value.substring(0, 80) + '...' : value
      break
    }
    case 'CustomMetadataType':
      if (record._isTypeDefinition) {
        result.description = record.QualifiedApiName !== record.MasterLabel ? record.QualifiedApiName : 'Custom Metadata Type'
      } else {
        result.description = indexed.description
      }
      break
    case 'CustomSetting':
      if (record._isSettingDefinition) {
        // Always show QualifiedApiName for Tab autocomplete
        result.description = record.QualifiedApiName || 'Custom Setting'
      } else {
        result.description = indexed.description
      }
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
