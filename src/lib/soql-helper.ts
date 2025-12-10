import type { SOQLSuggestion, SOQLQueryResult, GlobalDescribe, SObjectDescribe, ExportFormat } from '~types/soql'
import { sfRest, API_VERSION } from './auth'

const SOQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'LIKE',
  'ORDER BY', 'ASC', 'DESC', 'NULLS FIRST', 'NULLS LAST',
  'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET', 'WITH', 'FOR VIEW', 'FOR REFERENCE'
]

const SOQL_FUNCTIONS = [
  'COUNT()', 'COUNT(Id)', 'COUNT_DISTINCT()', 'SUM()', 'AVG()', 'MIN()', 'MAX()',
  'CALENDAR_MONTH()', 'CALENDAR_YEAR()', 'DAY_IN_MONTH()', 'DAY_IN_WEEK()',
  'FORMAT()', 'convertCurrency()', 'toLabel()',
  'TODAY', 'YESTERDAY', 'TOMORROW', 'LAST_WEEK', 'THIS_WEEK', 'NEXT_WEEK',
  'LAST_MONTH', 'THIS_MONTH', 'NEXT_MONTH', 'LAST_90_DAYS', 'NEXT_90_DAYS',
  'LAST_N_DAYS:n', 'NEXT_N_DAYS:n'
]

const SOQL_OPERATORS = ['=', '!=', '<', '>', '<=', '>=', 'LIKE', 'IN', 'NOT IN', 'INCLUDES', 'EXCLUDES']

let globalDescribeCache: GlobalDescribe | null = null
let globalDescribeCacheTime = 0
const sobjectDescribeCache: Record<string, SObjectDescribe> = {}
const CACHE_TTL = 5 * 60 * 1000

async function getGlobalDescribe(sfHost: string): Promise<GlobalDescribe> {
  if (globalDescribeCache && Date.now() - globalDescribeCacheTime < CACHE_TTL) {
    return globalDescribeCache
  }
  const result = await sfRest(sfHost, `/services/data/v${API_VERSION}/sobjects/`)
  globalDescribeCache = result
  globalDescribeCacheTime = Date.now()
  return result
}

async function getSObjectDescribe(sfHost: string, sobjectName: string): Promise<SObjectDescribe | null> {
  const cacheKey = `${sfHost}:${sobjectName}`
  if (sobjectDescribeCache[cacheKey]) {
    return sobjectDescribeCache[cacheKey]
  }
  try {
    const result = await sfRest(sfHost, `/services/data/v${API_VERSION}/sobjects/${sobjectName}/describe/`)
    const describe: SObjectDescribe = {
      name: result.name,
      label: result.label,
      fields: result.fields.map((f: any) => ({
        name: f.name,
        label: f.label,
        type: f.type,
        referenceTo: f.referenceTo,
        relationshipName: f.relationshipName
      }))
    }
    sobjectDescribeCache[cacheKey] = describe
    return describe
  } catch {
    return null
  }
}

function parseSOQLContext(query: string, cursorPos: number): {
  context: 'keyword' | 'object' | 'field' | 'value' | 'unknown'
  currentWord: string
  fromObject: string | null
} {
  const beforeCursor = query.substring(0, cursorPos).toUpperCase()
  const fullQueryUpper = query.toUpperCase()
  const wordMatch = query.substring(0, cursorPos).match(/[\w.]*$/)
  const currentWord = wordMatch ? wordMatch[0] : ''

  // Look for FROM clause in the ENTIRE query, not just before cursor
  const fromMatch = fullQueryUpper.match(/FROM\s+(\w+)/i)
  const fromObject = fromMatch ? fromMatch[1] : null

  // Check if cursor is right after "FROM " - typing object name
  if (/FROM\s+[\w]*$/i.test(beforeCursor)) {
    return { context: 'object', currentWord, fromObject }
  }

  // Check if cursor is in SELECT clause (between SELECT and FROM, or after SELECT if no FROM yet)
  const selectMatch = fullQueryUpper.match(/SELECT\s+/i)
  const fromIndex = fullQueryUpper.indexOf('FROM')

  if (selectMatch) {
    const selectEndIndex = selectMatch.index! + selectMatch[0].length
    // Cursor is after SELECT keyword
    if (cursorPos >= selectEndIndex) {
      // If no FROM clause yet, or cursor is before FROM
      if (fromIndex === -1 || cursorPos <= fromIndex) {
        return { context: 'field', currentWord, fromObject }
      }
    }
  }

  // Check if cursor is after WHERE clause
  const whereIndex = beforeCursor.indexOf('WHERE')
  if (whereIndex !== -1) {
    const afterWhere = beforeCursor.substring(whereIndex)
    // Check if we're typing a value (after operator like =, !=, <, >, etc.)
    if (/[=<>!]+\s*[\w']*$/i.test(afterWhere)) {
      return { context: 'value', currentWord, fromObject }
    }
    // Check if we're right after AND/OR - need field
    if (/\b(AND|OR)\s+[\w]*$/i.test(afterWhere)) {
      return { context: 'field', currentWord, fromObject }
    }
    // Check if we're typing field name after WHERE or after a comma
    if (/WHERE\s+[\w]*$/i.test(afterWhere) || /,\s*[\w]*$/i.test(afterWhere)) {
      return { context: 'field', currentWord, fromObject }
    }
    // Default to field context in WHERE clause when typing a new condition
    if (/\s[\w]*$/i.test(afterWhere) && !/[=<>!]/.test(afterWhere.slice(-20))) {
      return { context: 'field', currentWord, fromObject }
    }
  }

  // Check ORDER BY clause
  if (/ORDER\s+BY\s+[\w\s,]*$/i.test(beforeCursor)) {
    return { context: 'field', currentWord, fromObject }
  }

  // Check GROUP BY clause
  if (/GROUP\s+BY\s+[\w\s,]*$/i.test(beforeCursor)) {
    return { context: 'field', currentWord, fromObject }
  }

  return { context: 'keyword', currentWord, fromObject }
}

export async function getSOQLSuggestions(
  sfHost: string,
  query: string,
  cursorPos: number
): Promise<SOQLSuggestion[]> {
  const { context, currentWord, fromObject } = parseSOQLContext(query, cursorPos)
  const searchTerm = currentWord.toLowerCase()
  const suggestions: SOQLSuggestion[] = []

  switch (context) {
    case 'keyword': {
      const keywords = [...SOQL_KEYWORDS, ...SOQL_FUNCTIONS].filter(k =>
        k.toLowerCase().startsWith(searchTerm)
      )
      keywords.slice(0, 15).forEach(k => {
        suggestions.push({ value: k, label: k, type: 'keyword' })
      })
      break
    }

    case 'object': {
      try {
        const global = await getGlobalDescribe(sfHost)
        const objects = global.sobjects
          .filter(o => o.queryable && o.name.toLowerCase().startsWith(searchTerm))
          .slice(0, 15)
        objects.forEach(o => {
          suggestions.push({ value: o.name, label: o.label, type: 'object', detail: o.name })
        })
      } catch {
        // ignore
      }
      break
    }

    case 'field': {
      if (fromObject) {
        try {
          const describe = await getSObjectDescribe(sfHost, fromObject)
          if (describe) {
            const fields = describe.fields
              .filter(f => f.name.toLowerCase().startsWith(searchTerm))
              .slice(0, 20)
            fields.forEach(f => {
              suggestions.push({
                value: f.name,
                label: f.label,
                type: 'field',
                detail: f.type
              })
            })
          }
        } catch {
          // ignore
        }
      }
      SOQL_FUNCTIONS.filter(f => f.toLowerCase().startsWith(searchTerm))
        .slice(0, 5)
        .forEach(f => {
          suggestions.push({ value: f, label: f, type: 'function' })
        })
      break
    }

    case 'value': {
      const dateLiterals = SOQL_FUNCTIONS.filter(f =>
        (f.startsWith('TODAY') || f.startsWith('YESTERDAY') || f.startsWith('LAST_') ||
         f.startsWith('THIS_') || f.startsWith('NEXT_')) &&
        f.toLowerCase().startsWith(searchTerm)
      )
      dateLiterals.slice(0, 10).forEach(d => {
        suggestions.push({ value: d, label: d, type: 'keyword' })
      })
      if ('true'.startsWith(searchTerm)) suggestions.push({ value: 'true', label: 'true', type: 'keyword' })
      if ('false'.startsWith(searchTerm)) suggestions.push({ value: 'false', label: 'false', type: 'keyword' })
      if ('null'.startsWith(searchTerm)) suggestions.push({ value: 'null', label: 'null', type: 'keyword' })
      break
    }
  }

  return suggestions
}

export function applySuggestion(query: string, cursorPos: number, suggestion: SOQLSuggestion): { newQuery: string; newCursorPos: number } {
  const beforeCursor = query.substring(0, cursorPos)
  const afterCursor = query.substring(cursorPos)
  const wordMatch = beforeCursor.match(/[\w.]*$/)
  const wordStart = wordMatch ? cursorPos - wordMatch[0].length : cursorPos

  let insertValue = suggestion.value
  if (suggestion.type === 'object') {
    insertValue += ' '
  } else if (suggestion.type === 'field') {
    insertValue += ', '
  } else if (suggestion.type === 'keyword' && !suggestion.value.includes('(')) {
    insertValue += ' '
  }

  const newQuery = query.substring(0, wordStart) + insertValue + afterCursor
  const newCursorPos = wordStart + insertValue.length

  return { newQuery, newCursorPos }
}

export async function executeSOQLQuery(sfHost: string, query: string): Promise<SOQLQueryResult> {
  const encodedQuery = encodeURIComponent(query.trim())
  const result = await sfRest(sfHost, `/services/data/v${API_VERSION}/query/?q=${encodedQuery}`)
  return result
}

export function exportResults(records: Record<string, unknown>[], format: ExportFormat): string {
  if (records.length === 0) return ''

  const allKeys = new Set<string>()
  records.forEach(r => {
    Object.keys(r).forEach(k => {
      if (k !== 'attributes') allKeys.add(k)
    })
  })
  const columns = Array.from(allKeys)

  const getValue = (record: Record<string, unknown>, key: string): string => {
    const val = record[key]
    if (val === null || val === undefined) return ''
    if (typeof val === 'object') return JSON.stringify(val)
    return String(val)
  }

  switch (format) {
    case 'csv': {
      const escape = (s: string) => {
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
          return `"${s.replace(/"/g, '""')}"`
        }
        return s
      }
      const header = columns.map(escape).join(',')
      const rows = records.map(r => columns.map(c => escape(getValue(r, c))).join(','))
      return [header, ...rows].join('\n')
    }

    case 'json': {
      const cleaned = records.map(r => {
        const obj: Record<string, unknown> = {}
        columns.forEach(c => { obj[c] = r[c] })
        return obj
      })
      return JSON.stringify(cleaned, null, 2)
    }

    case 'excel': {
      const header = columns.join('\t')
      const rows = records.map(r => columns.map(c => getValue(r, c).replace(/\t/g, ' ').replace(/\n/g, ' ')).join('\t'))
      return [header, ...rows].join('\n')
    }

    default:
      return ''
  }
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      document.execCommand('copy')
      return true
    } catch {
      return false
    } finally {
      document.body.removeChild(textarea)
    }
  }
}
