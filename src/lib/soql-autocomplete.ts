import type { AutocompleteSuggestion, SObjectDescribeField } from '~types/soql'
import {
  getGlobalDescribe,
  getSObjectDescribe,
  resolveRelationshipPath
} from './describe-cache'
import {
  parseSOQL,
  getKeywordSuggestions,
  getFunctionSuggestions,
  getDateLiteralSuggestions,
  SOQL_KEYWORDS
} from './soql-parser'

const MAX_SUGGESTIONS = 50

function rankSuggestion(value: string, label: string, searchTerm: string): number {
  const lowerValue = value.toLowerCase()
  const lowerLabel = label.toLowerCase()
  const term = searchTerm.toLowerCase()

  if (!term) return 5

  if (lowerValue === term) return 0
  if (lowerLabel === term) return 1
  if (lowerValue.startsWith(term)) return 2
  if (lowerLabel.startsWith(term)) return 3
  if (lowerValue.includes('__' + term)) return 4
  if (lowerValue.includes('_' + term)) return 5
  if (lowerLabel.includes(' ' + term)) return 6
  if (lowerValue.includes(term)) return 7
  if (lowerLabel.includes(term)) return 8
  return 9
}

function filterAndRank<T extends { value: string; label: string }>(
  items: T[],
  searchTerm: string
): T[] {
  const term = searchTerm.toLowerCase()

  return items
    .filter((item) => {
      if (!term) return true
      return (
        item.value.toLowerCase().includes(term) ||
        item.label.toLowerCase().includes(term)
      )
    })
    .sort((a, b) => {
      const rankA = rankSuggestion(a.value, a.label, searchTerm)
      const rankB = rankSuggestion(b.value, b.label, searchTerm)
      if (rankA !== rankB) return rankA - rankB
      return a.value.localeCompare(b.value)
    })
    .slice(0, MAX_SUGGESTIONS)
}

export async function getAutocompleteSuggestions(
  sfHost: string,
  query: string,
  cursorPosition: number
): Promise<AutocompleteSuggestion[]> {
  const parsed = parseSOQL(query, cursorPosition)
  const { cursorContext, currentToken, fromObject, relationshipPath } = parsed

  switch (cursorContext) {
    case 'object':
      return getObjectSuggestions(sfHost, currentToken)

    case 'field':
      if (!fromObject) {
        return getKeywordAndFunctionSuggestions(currentToken)
      }
      return getFieldSuggestions(sfHost, fromObject, currentToken, relationshipPath)

    case 'relationship':
      if (!fromObject || !relationshipPath) {
        return []
      }
      return getRelationshipFieldSuggestions(sfHost, fromObject, currentToken, relationshipPath)

    case 'fieldValue':
      return getFieldValueSuggestions(currentToken)

    case 'keyword':
      return getKeywordAndFunctionSuggestions(currentToken)

    default:
      return []
  }
}

async function getObjectSuggestions(
  sfHost: string,
  searchTerm: string
): Promise<AutocompleteSuggestion[]> {
  try {
    const globalDescribe = await getGlobalDescribe(sfHost)
    const queryableObjects = globalDescribe.sobjects.filter((obj) => obj.queryable)

    const items = queryableObjects.map((obj) => ({
      value: obj.name,
      label: obj.label
    }))

    return filterAndRank(items, searchTerm).map((item) => ({
      ...item,
      type: 'object' as const,
      suffix: ' ',
      rank: 0
    }))
  } catch (error) {
    console.warn('Failed to get object suggestions:', error)
    return []
  }
}

async function getFieldSuggestions(
  sfHost: string,
  sobjectName: string,
  searchTerm: string,
  relationshipPath: string | null
): Promise<AutocompleteSuggestion[]> {
  try {
    let fields: SObjectDescribeField[] | null

    if (relationshipPath) {
      fields = await resolveRelationshipPath(sfHost, sobjectName, relationshipPath)
    } else {
      const describe = await getSObjectDescribe(sfHost, sobjectName)
      fields = describe?.fields || null
    }

    if (!fields) return []

    const suggestions: AutocompleteSuggestion[] = []

    for (const field of fields) {
      suggestions.push({
        value: field.name,
        label: field.label,
        type: 'field',
        dataType: field.type,
        suffix: ', ',
        rank: 1
      })

      if (field.relationshipName && field.referenceTo.length > 0) {
        suggestions.push({
          value: field.relationshipName + '.',
          label: `${field.label} (${field.referenceTo[0]})`,
          type: 'relationship',
          dataType: 'reference',
          suffix: '',
          rank: 2
        })
      }
    }

    const items = suggestions.map((s) => ({ value: s.value, label: s.label }))
    const filtered = filterAndRank(items, searchTerm)

    return filtered.map((item, idx) => {
      const original = suggestions.find((s) => s.value === item.value && s.label === item.label)
      return {
        value: item.value,
        label: item.label,
        type: original?.type || 'field',
        dataType: original?.dataType,
        suffix: original?.suffix,
        rank: original?.rank || 1
      }
    })
  } catch (error) {
    console.warn('Failed to get field suggestions:', error)
    return []
  }
}

async function getRelationshipFieldSuggestions(
  sfHost: string,
  baseSObject: string,
  searchTerm: string,
  relationshipPath: string
): Promise<AutocompleteSuggestion[]> {
  return getFieldSuggestions(sfHost, baseSObject, searchTerm, relationshipPath)
}

function getFieldValueSuggestions(searchTerm: string): AutocompleteSuggestion[] {
  const suggestions: AutocompleteSuggestion[] = []

  suggestions.push(
    { value: 'TRUE', label: 'TRUE', type: 'keyword', rank: 1, suffix: ' ' },
    { value: 'FALSE', label: 'FALSE', type: 'keyword', rank: 1, suffix: ' ' },
    { value: 'NULL', label: 'NULL', type: 'keyword', rank: 1, suffix: ' ' }
  )

  const dateLiterals = getDateLiteralSuggestions(searchTerm)
  for (const dl of dateLiterals) {
    suggestions.push({
      value: dl,
      label: dl,
      type: 'keyword',
      rank: 2,
      suffix: ' '
    })
  }

  const items = suggestions.map((s) => ({ value: s.value, label: s.label }))
  const filtered = filterAndRank(items, searchTerm)
  return filtered.map((item) => {
    const original = suggestions.find((s) => s.value === item.value)
    return original || { ...item, type: 'keyword' as const, rank: 1, suffix: ' ' }
  })
}

function getKeywordAndFunctionSuggestions(searchTerm: string): AutocompleteSuggestion[] {
  const suggestions: AutocompleteSuggestion[] = []

  const keywords = getKeywordSuggestions(searchTerm)
  for (const kw of keywords) {
    suggestions.push({
      value: kw,
      label: kw,
      type: 'keyword',
      rank: 1,
      suffix: ' '
    })
  }

  const functions = getFunctionSuggestions(searchTerm)
  for (const fn of functions) {
    const hasParens = fn.includes('(')
    suggestions.push({
      value: hasParens ? fn.replace('()', '').replace('(', '') : fn,
      label: fn,
      type: 'function',
      rank: 2,
      suffix: hasParens ? '(' : ' '
    })
  }

  const items = suggestions.map((s) => ({ value: s.value, label: s.label }))
  const filtered = filterAndRank(items, searchTerm)
  return filtered.map((item) => {
    const original = suggestions.find((s) => s.value === item.value)
    return original || { ...item, type: 'keyword' as const, rank: 1, suffix: ' ' }
  })
}

export function insertSuggestion(
  query: string,
  cursorPosition: number,
  suggestion: AutocompleteSuggestion
): { newQuery: string; newCursorPosition: number } {
  const beforeCursor = query.substring(0, cursorPosition)
  const afterCursor = query.substring(cursorPosition)

  const tokenMatch = beforeCursor.match(/([a-zA-Z0-9_.]*)$/)
  const tokenStart = tokenMatch ? cursorPosition - tokenMatch[1].length : cursorPosition

  const insertText = suggestion.value + (suggestion.suffix || '')
  const newQuery = query.substring(0, tokenStart) + insertText + afterCursor
  const newCursorPosition = tokenStart + insertText.length

  return { newQuery, newCursorPosition }
}
