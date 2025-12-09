export interface SObjectDescribeField {
  name: string
  label: string
  type: string
  referenceTo: string[]
  relationshipName: string | null
  picklistValues?: { value: string; label: string; active: boolean }[]
  nillable: boolean
  calculated: boolean
  createable: boolean
  updateable: boolean
}

export interface SObjectDescribe {
  name: string
  label: string
  labelPlural: string
  keyPrefix: string | null
  fields: SObjectDescribeField[]
  childRelationships: {
    childSObject: string
    relationshipName: string | null
    field: string
  }[]
}

export interface GlobalDescribeSObject {
  name: string
  label: string
  labelPlural: string
  keyPrefix: string | null
  queryable: boolean
  searchable: boolean
  custom: boolean
}

export interface GlobalDescribe {
  sobjects: GlobalDescribeSObject[]
}

export type AutocompleteContext =
  | 'object'
  | 'field'
  | 'fieldValue'
  | 'keyword'
  | 'function'
  | 'relationship'

export interface AutocompleteSuggestion {
  value: string
  label: string
  type: AutocompleteContext
  dataType?: string
  suffix?: string
  rank: number
}

export interface SOQLParseResult {
  fromObject: string | null
  selectFields: string[]
  whereClause: string | null
  cursorContext: AutocompleteContext
  currentToken: string
  relationshipPath: string | null
}

export interface QueryResult {
  totalSize: number
  done: boolean
  records: Record<string, unknown>[]
  nextRecordsUrl?: string
}

export type ExportFormat = 'csv' | 'markdown' | 'excel'
