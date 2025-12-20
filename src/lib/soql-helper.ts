import type {
  SOQLSuggestion,
  SOQLQueryResult,
  GlobalDescribe,
  SObjectDescribe,
  SObjectField,
  ExportFormat,
  SOQLContext,
  SOQLParseResult
} from '~types/soql'
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

const DATE_LITERALS = [
  'TODAY', 'YESTERDAY', 'TOMORROW', 'LAST_WEEK', 'THIS_WEEK', 'NEXT_WEEK',
  'LAST_MONTH', 'THIS_MONTH', 'NEXT_MONTH', 'LAST_90_DAYS', 'NEXT_90_DAYS',
  'LAST_N_DAYS:n', 'NEXT_N_DAYS:n', 'LAST_QUARTER', 'THIS_QUARTER', 'NEXT_QUARTER',
  'LAST_YEAR', 'THIS_YEAR', 'NEXT_YEAR', 'LAST_FISCAL_QUARTER', 'THIS_FISCAL_QUARTER',
  'NEXT_FISCAL_QUARTER', 'LAST_FISCAL_YEAR', 'THIS_FISCAL_YEAR', 'NEXT_FISCAL_YEAR'
]

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
  const cacheKey = `${sfHost}:${sobjectName.toLowerCase()}`
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
        referenceTo: f.referenceTo || [],
        relationshipName: f.relationshipName || null,
        aggregatable: f.aggregatable ?? true,
        groupable: f.groupable ?? true,
        sortable: f.sortable ?? true,
        filterable: f.filterable ?? true,
        nillable: f.nillable ?? false,
        picklistValues: f.picklistValues?.map((p: any) => ({
          value: p.value,
          label: p.label,
          active: p.active
        })) || []
      })),
      childRelationships: result.childRelationships?.map((r: any) => ({
        childSObject: r.childSObject,
        relationshipName: r.relationshipName,
        field: r.field
      })).filter((r: any) => r.relationshipName) || []
    }
    sobjectDescribeCache[cacheKey] = describe
    return describe
  } catch {
    return null
  }
}

function findSubqueryContext(query: string, cursorPos: number): { isInSubquery: boolean; subqueryRelationshipName?: string; subqueryStart?: number; subqueryEnd?: number } {
  const beforeCursor = query.substring(0, cursorPos)

  let depth = 0
  let subqueryStart = -1

  for (let i = beforeCursor.length - 1; i >= 0; i--) {
    if (beforeCursor[i] === ')') {
      depth++
    } else if (beforeCursor[i] === '(') {
      if (depth === 0) {
        subqueryStart = i
        break
      }
      depth--
    }
  }

  if (subqueryStart === -1) {
    return { isInSubquery: false }
  }

  const afterParen = query.substring(subqueryStart + 1)
  if (!/^\s*SELECT\b/i.test(afterParen)) {
    return { isInSubquery: false }
  }

  let subqueryEnd = -1
  depth = 1
  for (let i = subqueryStart + 1; i < query.length; i++) {
    if (query[i] === '(') depth++
    else if (query[i] === ')') {
      depth--
      if (depth === 0) {
        subqueryEnd = i
        break
      }
    }
  }

  const subqueryContent = query.substring(subqueryStart + 1, subqueryEnd !== -1 ? subqueryEnd : undefined)
  const fromMatch = subqueryContent.match(/FROM\s+(\w+)/i)
  const subqueryRelationshipName = fromMatch ? fromMatch[1] : undefined

  return { isInSubquery: true, subqueryRelationshipName, subqueryStart, subqueryEnd }
}

function findMainFromObject(query: string): string | null {
  const upper = query.toUpperCase()
  let depth = 0
  let i = 0

  while (i < upper.length) {
    if (upper[i] === '(') {
      depth++
    } else if (upper[i] === ')') {
      depth--
    } else if (depth === 0 && upper.substring(i, i + 4) === 'FROM') {
      const afterFrom = query.substring(i + 4).match(/^\s+(\w+)/i)
      if (afterFrom) {
        return afterFrom[1]
      }
    }
    i++
  }
  return null
}

function parseSOQLContext(query: string, cursorPos: number): SOQLParseResult {
  const beforeCursor = query.substring(0, cursorPos)
  const beforeCursorUpper = beforeCursor.toUpperCase()
  const fullQueryUpper = query.toUpperCase()

  const wordMatch = beforeCursor.match(/[\w.]*$/)
  const currentWord = wordMatch ? wordMatch[0] : ''

  const fromObject = findMainFromObject(query)

  const subqueryInfo = findSubqueryContext(query, cursorPos)
  const { isInSubquery, subqueryRelationshipName } = subqueryInfo

  let effectiveQuery = query
  let effectiveCursorPos = cursorPos
  let effectiveFromObject = fromObject

  if (isInSubquery && subqueryInfo.subqueryStart !== undefined) {
    effectiveQuery = query.substring(subqueryInfo.subqueryStart + 1, subqueryInfo.subqueryEnd !== undefined ? subqueryInfo.subqueryEnd : undefined)
    effectiveCursorPos = cursorPos - subqueryInfo.subqueryStart - 1
  }

  const effectiveQueryUpper = effectiveQuery.toUpperCase()
  const effectiveBeforeCursor = effectiveQuery.substring(0, effectiveCursorPos)
  const effectiveBeforeCursorUpper = effectiveBeforeCursor.toUpperCase()

  const selectMatch = effectiveQueryUpper.match(/SELECT\s+/i)
  const fromIndex = effectiveQueryUpper.indexOf('FROM')
  const whereIndex = effectiveBeforeCursorUpper.indexOf('WHERE')
  const groupByIndex = effectiveBeforeCursorUpper.indexOf('GROUP BY')
  const orderByIndex = effectiveBeforeCursorUpper.indexOf('ORDER BY')
  const limitIndex = effectiveBeforeCursorUpper.indexOf('LIMIT')
  const offsetIndex = effectiveBeforeCursorUpper.indexOf('OFFSET')

  const isInSelectClause = selectMatch
    ? effectiveCursorPos >= (selectMatch.index! + selectMatch[0].length) && (fromIndex === -1 || effectiveCursorPos <= fromIndex)
    : false
  const isInWhereClause = whereIndex !== -1 && (groupByIndex === -1 || effectiveCursorPos < groupByIndex) && (orderByIndex === -1 || effectiveCursorPos < orderByIndex) && (limitIndex === -1 || effectiveCursorPos < limitIndex)
  const isInGroupByClause = groupByIndex !== -1 && (orderByIndex === -1 || effectiveCursorPos < orderByIndex) && effectiveCursorPos > groupByIndex && (limitIndex === -1 || effectiveCursorPos < limitIndex)
  const isInOrderByClause = orderByIndex !== -1 && effectiveCursorPos > orderByIndex && (limitIndex === -1 || effectiveCursorPos < limitIndex)
  const isAfterLimit = limitIndex !== -1 && effectiveCursorPos > limitIndex
  const isAfterOffset = offsetIndex !== -1 && effectiveCursorPos > offsetIndex

  const relationshipPath = currentWord.includes('.') ? currentWord.split('.') : undefined
  const fieldName = extractFieldNameBeforeCursor(effectiveBeforeCursor)

  const baseResult = {
    fromObject: effectiveFromObject,
    isInSelectClause,
    isInWhereClause,
    isInGroupByClause,
    isInOrderByClause,
    isInSubquery,
    subqueryRelationshipName
  }

  if (/FROM\s+[\w]*$/i.test(effectiveBeforeCursorUpper)) {
    if (isInSubquery) {
      return { context: 'object', currentWord, ...baseResult, fromObject }
    }
    return { context: 'object', currentWord, ...baseResult }
  }

  if (isInGroupByClause && /GROUP\s+BY\s+[\w\s,]*$/i.test(effectiveBeforeCursorUpper)) {
    return { context: 'groupby', currentWord, relationshipPath, ...baseResult }
  }

  if (isInOrderByClause && /ORDER\s+BY\s+[\w\s,]*$/i.test(effectiveBeforeCursorUpper)) {
    return { context: 'orderby', currentWord, relationshipPath, ...baseResult }
  }

  // After LIMIT/OFFSET - suggest OFFSET or indicate query complete
  if (isAfterLimit || isAfterOffset) {
    // After "LIMIT <number>" - suggest OFFSET
    if (/LIMIT\s+\d+\s+[\w]*$/i.test(effectiveBeforeCursorUpper) && !isAfterOffset) {
      return { context: 'keyword', currentWord, ...baseResult }
    }
    // After "OFFSET <number>" - query is complete, no suggestions needed
    if (/OFFSET\s+\d+\s*$/i.test(effectiveBeforeCursorUpper)) {
      return { context: 'unknown', currentWord, ...baseResult }
    }
    // Still typing LIMIT/OFFSET number
    return { context: 'unknown', currentWord, ...baseResult }
  }

  if (currentWord.includes('.') && currentWord.split('.').length >= 2) {
    return { context: 'relationship', currentWord, relationshipPath, ...baseResult }
  }

  if (isInSelectClause) {
    return { context: 'field', currentWord, relationshipPath, ...baseResult }
  }

  if (isInWhereClause) {
    const afterWhere = effectiveBeforeCursorUpper.substring(whereIndex)
    const tail = effectiveBeforeCursor.substring(Math.max(0, effectiveCursorPos - 120))
    const tailUpper = tail.toUpperCase()

    if (/(?:=|!=|<=|>=|<|>)\s*$/i.test(tailUpper) || /\b(?:LIKE|INCLUDES|EXCLUDES|IN|NOT\s+IN)\s*$/i.test(tailUpper)) {
      return { context: 'value', currentWord, fieldName, ...baseResult }
    }
    if (/(?:=|!=|<=|>=|<|>|\bLIKE\b|\bINCLUDES\b|\bEXCLUDES\b|\bIN\b|\bNOT\s+IN\b)\s+[\w'()]*$/i.test(tailUpper)) {
      return { context: 'value', currentWord, fieldName, ...baseResult }
    }

    if (/\b(AND|OR)\s+[\w]*$/i.test(afterWhere)) {
      return { context: 'field', currentWord, relationshipPath, ...baseResult }
    }
    if (/WHERE\s+[\w]*$/i.test(afterWhere) || /,\s*[\w]*$/i.test(afterWhere)) {
      return { context: 'field', currentWord, relationshipPath, ...baseResult }
    }
    if (/[\w.]+\s+$/i.test(tailUpper)) {
      return { context: 'operator', currentWord, ...baseResult }
    }
    if (/(?:'[^']*'|\)|\bTRUE\b|\bFALSE\b|\bNULL\b|\d+)\s+$/i.test(tailUpper)) {
      return { context: 'logical', currentWord, ...baseResult }
    }
    if (/\s[\w]*$/i.test(afterWhere) && !/[=<>!]/.test(afterWhere.slice(-20))) {
      return { context: 'field', currentWord, relationshipPath, ...baseResult }
    }
  }

  return { context: 'keyword', currentWord, ...baseResult }
}

function extractFieldNameBeforeCursor(beforeCursor: string): string | undefined {
  const match = beforeCursor.match(/(\w+)\s*(?:=|!=|<=|>=|<|>|LIKE|IN|NOT\s+IN|INCLUDES|EXCLUDES)\s*[\w'()]*$/i)
  return match ? match[1] : undefined
}

function normalizeForFuzzy(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function fuzzyScore(needleRaw: string, candidateRaw: string): number | null {
  const needle = normalizeForFuzzy(needleRaw)
  const candidate = normalizeForFuzzy(candidateRaw)

  if (!needle) return 0

  const substringIndex = candidate.indexOf(needle)
  if (substringIndex !== -1) return substringIndex

  let needleIndex = 0
  let startIndex = -1
  let lastMatchIndex = -1
  let gaps = 0

  for (let i = 0; i < candidate.length && needleIndex < needle.length; i++) {
    if (candidate[i] === needle[needleIndex]) {
      if (startIndex === -1) startIndex = i
      if (lastMatchIndex !== -1) gaps += i - lastMatchIndex - 1
      lastMatchIndex = i
      needleIndex++
    }
  }

  if (needleIndex !== needle.length) return null

  return 100 + startIndex + gaps
}

function isCursorInSelectClause(query: string, cursorPos: number): boolean {
  const upper = query.toUpperCase()
  const selectMatch = upper.match(/SELECT\s+/)
  if (!selectMatch?.index) return false

  const selectEndIndex = selectMatch.index + selectMatch[0].length
  if (cursorPos < selectEndIndex) return false

  const fromIndex = upper.indexOf('FROM')
  return fromIndex === -1 || cursorPos <= fromIndex
}

function filterFieldsByContext(fields: SObjectField[], parseResult: SOQLParseResult): SObjectField[] {
  return fields.filter(f => {
    if (parseResult.isInGroupByClause && !f.groupable) return false
    if (parseResult.isInOrderByClause && !f.sortable) return false
    return true
  })
}

async function getRelationshipFields(
  sfHost: string,
  fromObject: string,
  relationshipPath: string[],
  useFuzzy: boolean,
  searchTerm: string
): Promise<SOQLSuggestion[]> {
  const suggestions: SOQLSuggestion[] = []

  if (relationshipPath.length < 2) return suggestions

  const pathWithoutLast = relationshipPath.slice(0, -1)
  const currentInput = relationshipPath[relationshipPath.length - 1].toLowerCase()

  let currentObject = fromObject
  for (const segment of pathWithoutLast) {
    const describe = await getSObjectDescribe(sfHost, currentObject)
    if (!describe) return suggestions

    const field = describe.fields.find(f =>
      f.relationshipName?.toLowerCase() === segment.toLowerCase()
    )
    if (!field || !field.referenceTo || field.referenceTo.length === 0) return suggestions

    currentObject = field.referenceTo[0]
  }

  const describe = await getSObjectDescribe(sfHost, currentObject)
  if (!describe) return suggestions

  const prefix = pathWithoutLast.join('.')

  const keywordMatches = (candidate: string): boolean =>
    useFuzzy ? fuzzyScore(currentInput, candidate) !== null : candidate.toLowerCase().startsWith(currentInput)

  describe.fields
    .filter(f => keywordMatches(f.name) || keywordMatches(f.label))
    .slice(0, 20)
    .forEach(f => {
      suggestions.push({
        value: `${prefix}.${f.name}`,
        label: f.label,
        type: 'field',
        detail: `${currentObject}.${f.name} (${f.type})`
      })

      if (f.relationshipName && f.referenceTo && f.referenceTo.length > 0) {
        suggestions.push({
          value: `${prefix}.${f.relationshipName}.`,
          label: `${f.relationshipName} ->`,
          type: 'relationship',
          detail: `Ref to ${f.referenceTo.join(', ')}`
        })
      }
    })

  return suggestions
}

async function getPicklistValues(
  sfHost: string,
  fromObject: string,
  fieldName: string,
  useFuzzy: boolean,
  searchTerm: string
): Promise<SOQLSuggestion[]> {
  const suggestions: SOQLSuggestion[] = []

  if (!fromObject || !fieldName) return suggestions

  const describe = await getSObjectDescribe(sfHost, fromObject)
  if (!describe) return suggestions

  const field = describe.fields.find(f => f.name.toLowerCase() === fieldName.toLowerCase())
  if (!field) return suggestions

  if (['picklist', 'multipicklist'].includes(field.type) && field.picklistValues) {
    const keywordMatches = (candidate: string): boolean =>
      useFuzzy ? fuzzyScore(searchTerm, candidate) !== null : candidate.toLowerCase().startsWith(searchTerm.toLowerCase())

    field.picklistValues
      .filter(p => p.active && keywordMatches(p.value))
      .slice(0, 20)
      .forEach(p => {
        suggestions.push({
          value: `'${p.value}'`,
          label: p.label || p.value,
          type: 'value',
          detail: 'Picklist'
        })
      })
  }

  return suggestions
}

export async function getSOQLSuggestions(
  sfHost: string,
  query: string,
  cursorPos: number,
  useFuzzy = false
): Promise<SOQLSuggestion[]> {
  const parseResult = parseSOQLContext(query, cursorPos)
  const { context, currentWord, fromObject, relationshipPath, fieldName } = parseResult
  const searchTerm = currentWord.toLowerCase()
  const suggestions: SOQLSuggestion[] = []

  const keywordMatches = (candidate: string): boolean =>
    useFuzzy ? fuzzyScore(searchTerm, candidate) !== null : candidate.toLowerCase().startsWith(searchTerm)

  switch (context) {
    case 'logical': {
      ;['AND', 'OR', 'ORDER BY', 'GROUP BY', 'LIMIT'].forEach((k) => {
        if (keywordMatches(k)) suggestions.push({ value: k, label: k, type: 'keyword' })
      })
      break
    }

    case 'operator': {
      const operators = SOQL_OPERATORS
        .map((op) => ({ op, score: useFuzzy ? (fuzzyScore(searchTerm, op) ?? Number.POSITIVE_INFINITY) : 0 }))
        .filter(({ op, score }) => (useFuzzy ? Number.isFinite(score) : op.toLowerCase().startsWith(searchTerm)))
        .sort((a, b) => a.score - b.score || a.op.length - b.op.length)
        .slice(0, 12)

      operators.forEach(({ op }) => suggestions.push({ value: op, label: op, type: 'operator' }))
      break
    }

    case 'keyword': {
      const beforeUpper = query.substring(0, cursorPos).toUpperCase()

      // After LIMIT <number> or OFFSET <number>, suggest trailing clauses
      if (/(?:LIMIT|OFFSET)\s+\d+\s+[\w]*$/i.test(beforeUpper)) {
        const trailingKeywords = ['OFFSET', 'FOR UPDATE', 'FOR VIEW', 'FOR REFERENCE']
        // Don't suggest OFFSET if already have one
        const hasOffset = /OFFSET\s+\d+/i.test(beforeUpper)
        trailingKeywords
          .filter(k => !(k === 'OFFSET' && hasOffset))
          .filter(k => keywordMatches(k))
          .forEach(k => {
            suggestions.push({ value: k, label: k, type: 'keyword' })
          })
        break
      }

      const keywords = [...SOQL_KEYWORDS, ...SOQL_FUNCTIONS]
        .map((k) => ({ k, score: useFuzzy ? (fuzzyScore(searchTerm, k) ?? Number.POSITIVE_INFINITY) : 0 }))
        .filter(({ k, score }) => (useFuzzy ? Number.isFinite(score) : k.toLowerCase().startsWith(searchTerm)))
        .sort((a, b) => a.score - b.score || a.k.length - b.k.length)

      keywords.slice(0, 15).forEach(({ k }) => {
        suggestions.push({ value: k, label: k, type: 'keyword' })
      })
      break
    }

    case 'object': {
      try {
        if (parseResult.isInSubquery && fromObject) {
          const parentDescribe = await getSObjectDescribe(sfHost, fromObject)
          if (parentDescribe?.childRelationships) {
            const childRels = parentDescribe.childRelationships
              .filter(r => r.relationshipName && keywordMatches(r.relationshipName))
              .slice(0, 15)

            childRels.forEach(r => {
              suggestions.push({
                value: r.relationshipName!,
                label: r.relationshipName!,
                type: 'object',
                detail: `Child: ${r.childSObject}`
              })
            })
          }
        } else {
          const global = await getGlobalDescribe(sfHost)
          const objects = global.sobjects
            .filter((o) => o.queryable)
            .map((o) => {
              if (!useFuzzy) return { o, score: 0 }
              const nameScore = fuzzyScore(searchTerm, o.name)
              const labelScore = fuzzyScore(searchTerm, o.label)
              const score = Math.min(
                nameScore ?? Number.POSITIVE_INFINITY,
                labelScore === null ? Number.POSITIVE_INFINITY : labelScore + 5
              )
              return { o, score }
            })
            .filter(({ o, score }) => (useFuzzy ? Number.isFinite(score) : o.name.toLowerCase().startsWith(searchTerm)))
            .sort((a, b) => a.score - b.score || a.o.name.length - b.o.name.length)
            .slice(0, 15)

          objects.forEach(({ o }) => {
            suggestions.push({ value: o.name, label: o.label, type: 'object', detail: o.name })
          })
        }
      } catch {
        // ignore
      }
      break
    }

    case 'relationship': {
      let targetObject = fromObject

      if (parseResult.isInSubquery && parseResult.subqueryRelationshipName && fromObject) {
        const parentDescribe = await getSObjectDescribe(sfHost, fromObject)
        if (parentDescribe?.childRelationships) {
          const childRel = parentDescribe.childRelationships.find(
            r => r.relationshipName?.toLowerCase() === parseResult.subqueryRelationshipName?.toLowerCase()
          )
          if (childRel) {
            targetObject = childRel.childSObject
          }
        }
      }

      if (targetObject && relationshipPath) {
        const relSuggestions = await getRelationshipFields(sfHost, targetObject, relationshipPath, useFuzzy, searchTerm)
        suggestions.push(...relSuggestions)
      }
      break
    }

    case 'groupby':
    case 'orderby':
    case 'field': {
      const isInSelectClause = parseResult.isInSelectClause ?? isCursorInSelectClause(query, cursorPos)

      if (isInSelectClause) {
        const prioritized: SOQLSuggestion[] = [
          { value: 'Id', label: 'Id', type: 'field', detail: 'common', sortOrder: 0 },
          { value: 'Name', label: 'Name', type: 'field', detail: 'common', sortOrder: 1 },
          { value: 'COUNT(Id)', label: 'COUNT(Id)', type: 'function', detail: 'aggregate', sortOrder: 2 }
        ]

        for (const s of prioritized) {
          const match = useFuzzy ? fuzzyScore(searchTerm, s.value) !== null : s.value.toLowerCase().startsWith(searchTerm)
          if (match) suggestions.push(s)
        }
      }

      let targetObject = fromObject
      let targetObjectLabel = fromObject

      if (parseResult.isInSubquery && parseResult.subqueryRelationshipName && fromObject) {
        const parentDescribe = await getSObjectDescribe(sfHost, fromObject)
        if (parentDescribe?.childRelationships) {
          const childRel = parentDescribe.childRelationships.find(
            r => r.relationshipName?.toLowerCase() === parseResult.subqueryRelationshipName?.toLowerCase()
          )
          if (childRel) {
            targetObject = childRel.childSObject
            targetObjectLabel = `${childRel.relationshipName} (${childRel.childSObject})`
          }
        }
      }

      if (targetObject) {
        try {
          const describe = await getSObjectDescribe(sfHost, targetObject)
          if (describe) {
            const filteredFields = filterFieldsByContext(describe.fields, parseResult)

            const fields = filteredFields
              .map((f) => {
                if (!useFuzzy) return { f, score: 0 }
                const nameScore = fuzzyScore(searchTerm, f.name)
                const labelScore = fuzzyScore(searchTerm, f.label)
                const score = Math.min(
                  nameScore ?? Number.POSITIVE_INFINITY,
                  labelScore === null ? Number.POSITIVE_INFINITY : labelScore + 5
                )
                return { f, score }
              })
              .filter(({ f, score }) => (useFuzzy ? Number.isFinite(score) : f.name.toLowerCase().startsWith(searchTerm)))
              .sort((a, b) => a.score - b.score || a.f.name.length - b.f.name.length)
              .slice(0, 25)

            fields.forEach(({ f }) => {
              suggestions.push({
                value: f.name,
                label: f.label,
                type: 'field',
                detail: parseResult.isInSubquery ? `${targetObjectLabel}.${f.type}` : f.type
              })

              if (f.relationshipName && f.referenceTo && f.referenceTo.length > 0) {
                suggestions.push({
                  value: `${f.relationshipName}.`,
                  label: `${f.relationshipName} ->`,
                  type: 'relationship',
                  detail: `Ref to ${f.referenceTo.join(', ')}`
                })
              }
            })

            if (isInSelectClause && !parseResult.isInSubquery && describe.childRelationships) {
              const childRels = describe.childRelationships
                .filter(r => r.relationshipName && keywordMatches(r.relationshipName))
                .slice(0, 5)

              childRels.forEach(r => {
                suggestions.push({
                  value: `(SELECT Id FROM ${r.relationshipName})`,
                  label: `${r.relationshipName} (subquery)`,
                  type: 'relationship',
                  detail: `Child: ${r.childSObject}`
                })
              })
            }
          }
        } catch {
          // ignore
        }
      }

      SOQL_FUNCTIONS.filter((f) => keywordMatches(f))
        .slice(0, 5)
        .forEach(f => {
          suggestions.push({ value: f, label: f, type: 'function' })
        })
      break
    }

    case 'value': {
      const beforeUpper = query.substring(0, cursorPos).toUpperCase()

      if (/\b(?:IN|NOT\s+IN)\s*$/i.test(beforeUpper)) {
        suggestions.push({ value: '(', label: '(', type: 'operator' })
        suggestions.push({ value: '(SELECT Id FROM ', label: '(SELECT Id FROM ...)', type: 'keyword', detail: 'subquery' })
      }

      if (fromObject && fieldName) {
        const picklistSuggestions = await getPicklistValues(sfHost, fromObject, fieldName, useFuzzy, searchTerm)
        suggestions.push(...picklistSuggestions)
      }

      DATE_LITERALS.filter(d => keywordMatches(d))
        .slice(0, 10)
        .forEach(d => {
          suggestions.push({ value: d, label: d, type: 'keyword', detail: 'Date Literal' })
        })

      if (keywordMatches('true')) suggestions.push({ value: 'true', label: 'true', type: 'keyword' })
      if (keywordMatches('false')) suggestions.push({ value: 'false', label: 'false', type: 'keyword' })
      if (keywordMatches('null')) suggestions.push({ value: 'null', label: 'null', type: 'keyword' })
      break
    }
  }

  const seen = new Set<string>()
  return suggestions.filter((s) => {
    const key = `${s.type}:${s.value}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function applySuggestion(query: string, cursorPos: number, suggestion: SOQLSuggestion): { newQuery: string; newCursorPos: number } {
  const beforeCursor = query.substring(0, cursorPos)
  const afterCursor = query.substring(cursorPos)
  const wordMatch = beforeCursor.match(/[\w.]*$/)
  const wordStart = wordMatch ? cursorPos - wordMatch[0].length : cursorPos

  let insertValue = suggestion.value
  const isInSelectClause = isCursorInSelectClause(query, cursorPos)

  if (suggestion.type === 'object') {
    insertValue += ' '
  } else if (suggestion.type === 'relationship') {
    // Don't add space for relationship navigation (ends with .)
    if (!insertValue.endsWith('.') && !insertValue.endsWith(')')) {
      insertValue += ' '
    }
  } else if (suggestion.type === 'field') {
    insertValue += isInSelectClause ? ', ' : ' '
  } else if (suggestion.type === 'function') {
    insertValue += isInSelectClause ? ', ' : ' '
  } else if (suggestion.type === 'value') {
    insertValue += ' '
  } else if (suggestion.type === 'operator') {
    if (suggestion.value !== '(') insertValue += ' '
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
