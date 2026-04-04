// Custom command execution - runs user-defined SOQL queries and formats results

import type { SearchResult } from '~types'
import { getSession, API_VERSION } from './auth'
import { logger } from './logger'
import { normalizeHost, escapeSoql } from './domain-utils'
import { parseSearchQuery } from './fuzzy-search'
import { fetchAllPages } from './metadata-fetcher'

export interface CustomCommandOptions {
  soqlTemplate: string
  searchQuery: string
  useToolingApi: boolean
  nameField: string
  descriptionFields?: string[]
}

/**
 * Executes a user-defined SOQL query template, substituting {query} with the search term.
 * Results are optionally filtered by exact match or secondary filter term.
 */
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

    let results: SearchResult[] = records.map((record) => ({
      id: (record.Id as string) || (record.DurableId as string) || '',
      name: getFieldValue(record, nameField) || 'Unknown',
      type: 'CustomQuery',
      description: buildDescriptionFromFields(record, descriptionFields, nameField),
      metadata: record as Record<string, unknown>
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('custom-command:error', { soql, error: message })
    throw new Error(formatCustomCommandError(message))
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

/** Traverses dot-notation field paths like "Profile.Name" on a record. */
function getFieldValue(record: Record<string, unknown>, fieldPath: string): string {
  if (!fieldPath) return ''
  const parts = fieldPath.split('.')
  let value: unknown = record
  for (const part of parts) {
    if (value === null || value === undefined) return ''
    value = (value as Record<string, unknown>)[part]
  }
  return value != null ? String(value) : ''
}

function buildDescriptionFromFields(record: Record<string, unknown>, descriptionFields?: string[], nameField?: string): string {
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

/** Builds a fallback description from the first 3 non-standard fields. */
function buildCustomResultDescription(record: Record<string, unknown>, nameField?: string): string {
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
