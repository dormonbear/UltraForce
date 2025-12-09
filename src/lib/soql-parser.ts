import type { AutocompleteContext, SOQLParseResult } from '~types/soql'

export const SOQL_KEYWORDS = [
  'SELECT',
  'FROM',
  'WHERE',
  'AND',
  'OR',
  'NOT',
  'ORDER BY',
  'GROUP BY',
  'HAVING',
  'LIMIT',
  'OFFSET',
  'ASC',
  'DESC',
  'NULLS FIRST',
  'NULLS LAST',
  'LIKE',
  'IN',
  'NOT IN',
  'INCLUDES',
  'EXCLUDES',
  'TRUE',
  'FALSE',
  'NULL',
  'WITH SECURITY_ENFORCED',
  'WITH USER_MODE',
  'WITH SYSTEM_MODE',
  'FOR VIEW',
  'FOR REFERENCE',
  'FOR UPDATE',
  'ALL ROWS'
]

export const SOQL_FUNCTIONS = [
  'COUNT()',
  'COUNT(Id)',
  'COUNT_DISTINCT()',
  'SUM()',
  'AVG()',
  'MIN()',
  'MAX()',
  'CALENDAR_MONTH()',
  'CALENDAR_QUARTER()',
  'CALENDAR_YEAR()',
  'DAY_IN_MONTH()',
  'DAY_IN_WEEK()',
  'DAY_IN_YEAR()',
  'DAY_ONLY()',
  'FISCAL_MONTH()',
  'FISCAL_QUARTER()',
  'FISCAL_YEAR()',
  'HOUR_IN_DAY()',
  'WEEK_IN_MONTH()',
  'WEEK_IN_YEAR()',
  'toLabel()',
  'convertTimezone()',
  'convertCurrency()',
  'FORMAT()',
  'GROUPING()',
  'FIELDS(ALL)',
  'FIELDS(STANDARD)',
  'FIELDS(CUSTOM)',
  'TYPEOF',
  'DISTANCE()',
  'GEOLOCATION()'
]

export const DATE_LITERALS = [
  'TODAY',
  'TOMORROW',
  'YESTERDAY',
  'LAST_WEEK',
  'THIS_WEEK',
  'NEXT_WEEK',
  'LAST_MONTH',
  'THIS_MONTH',
  'NEXT_MONTH',
  'LAST_90_DAYS',
  'NEXT_90_DAYS',
  'LAST_N_DAYS:n',
  'NEXT_N_DAYS:n',
  'LAST_N_WEEKS:n',
  'NEXT_N_WEEKS:n',
  'LAST_N_MONTHS:n',
  'NEXT_N_MONTHS:n',
  'THIS_QUARTER',
  'LAST_QUARTER',
  'NEXT_QUARTER',
  'LAST_N_QUARTERS:n',
  'NEXT_N_QUARTERS:n',
  'THIS_YEAR',
  'LAST_YEAR',
  'NEXT_YEAR',
  'LAST_N_YEARS:n',
  'NEXT_N_YEARS:n',
  'THIS_FISCAL_QUARTER',
  'LAST_FISCAL_QUARTER',
  'NEXT_FISCAL_QUARTER',
  'THIS_FISCAL_YEAR',
  'LAST_FISCAL_YEAR',
  'NEXT_FISCAL_YEAR'
]

export function parseSOQL(query: string, cursorPosition: number): SOQLParseResult {
  const beforeCursor = query.substring(0, cursorPosition)
  const afterCursor = query.substring(cursorPosition)

  const fromMatch = query.match(/\bFROM\s+([a-zA-Z0-9_]+)/i)
  const fromObject = fromMatch ? fromMatch[1] : null

  const selectMatch = query.match(/\bSELECT\s+([\s\S]*?)\s+FROM/i)
  const selectFields = selectMatch
    ? selectMatch[1]
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean)
    : []

  const whereMatch = query.match(/\bWHERE\s+([\s\S]*?)(?:\bORDER\b|\bGROUP\b|\bLIMIT\b|\bOFFSET\b|$)/i)
  const whereClause = whereMatch ? whereMatch[1].trim() : null

  const { context, currentToken, relationshipPath } = detectContext(beforeCursor, afterCursor, fromObject)

  return {
    fromObject,
    selectFields,
    whereClause,
    cursorContext: context,
    currentToken,
    relationshipPath
  }
}

function detectContext(
  beforeCursor: string,
  _afterCursor: string,
  fromObject: string | null
): { context: AutocompleteContext; currentToken: string; relationshipPath: string | null } {
  const tokenMatch = beforeCursor.match(/([a-zA-Z0-9_.]*)$/)
  const currentToken = tokenMatch ? tokenMatch[1] : ''

  const hasRelationship = currentToken.includes('.')
  let relationshipPath: string | null = null

  if (hasRelationship) {
    const parts = currentToken.split('.')
    relationshipPath = parts.slice(0, -1).join('.')
  }

  if (/\bFROM\s+$/i.test(beforeCursor)) {
    return { context: 'object', currentToken, relationshipPath: null }
  }

  if (/[=!<>]\s*'?[^']*$/i.test(beforeCursor) && !/\bFROM\s*$/i.test(beforeCursor)) {
    const inClauseMatch = beforeCursor.match(/\bIN\s*\(\s*(?:'[^']*'\s*,\s*)*'?[^']*$/i)
    if (inClauseMatch) {
      return { context: 'fieldValue', currentToken: currentToken.replace(/^'/, ''), relationshipPath: null }
    }

    const comparisonMatch = beforeCursor.match(/([a-zA-Z0-9_.]+)\s*[=!<>]+\s*'?[^']*$/i)
    if (comparisonMatch) {
      return { context: 'fieldValue', currentToken: currentToken.replace(/^'/, ''), relationshipPath: null }
    }
  }

  if (/\bSELECT\s+$/i.test(beforeCursor) || /,\s*$/i.test(beforeCursor)) {
    if (fromObject) {
      return { context: 'field', currentToken, relationshipPath }
    }
    return { context: 'keyword', currentToken, relationshipPath: null }
  }

  if (fromObject && hasRelationship) {
    return { context: 'relationship', currentToken: currentToken.split('.').pop() || '', relationshipPath }
  }

  if (fromObject) {
    const afterFrom = beforeCursor.match(/\bFROM\s+[a-zA-Z0-9_]+\s+/i)
    const afterSelect = beforeCursor.match(/\bSELECT\s+/i)

    if (afterSelect && !afterFrom) {
      return { context: 'field', currentToken, relationshipPath }
    }

    if (afterFrom) {
      const hasWhere = /\bWHERE\b/i.test(beforeCursor)
      if (hasWhere) {
        const afterOperator = /\b(AND|OR)\s+$/i.test(beforeCursor)
        if (afterOperator || /\bWHERE\s+$/i.test(beforeCursor)) {
          return { context: 'field', currentToken, relationshipPath }
        }
      }
    }
  }

  if (/^\s*$/.test(beforeCursor) || /\bSELECT\b/i.test(beforeCursor) === false) {
    return { context: 'keyword', currentToken, relationshipPath: null }
  }

  return { context: 'field', currentToken, relationshipPath }
}

export function getKeywordSuggestions(searchTerm: string): string[] {
  const term = searchTerm.toLowerCase()
  return SOQL_KEYWORDS.filter((kw) => kw.toLowerCase().startsWith(term))
}

export function getFunctionSuggestions(searchTerm: string): string[] {
  const term = searchTerm.toLowerCase()
  return SOQL_FUNCTIONS.filter((fn) => fn.toLowerCase().startsWith(term))
}

export function getDateLiteralSuggestions(searchTerm: string): string[] {
  const term = searchTerm.toLowerCase()
  return DATE_LITERALS.filter((dl) => dl.toLowerCase().startsWith(term))
}

export function isValidSOQL(query: string): { valid: boolean; error?: string } {
  const trimmed = query.trim().toUpperCase()

  if (!trimmed.startsWith('SELECT')) {
    return { valid: false, error: 'Query must start with SELECT' }
  }

  if (!/\bFROM\b/i.test(query)) {
    return { valid: false, error: 'Query must contain FROM clause' }
  }

  return { valid: true }
}

export function formatSOQL(query: string): string {
  return query
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s*=\s*/g, ' = ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim()
}
