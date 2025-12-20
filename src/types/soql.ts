export interface SOQLSuggestion {
  value: string
  label: string
  type: 'keyword' | 'object' | 'field' | 'function' | 'operator' | 'value' | 'relationship'
  detail?: string
  sortOrder?: number
}

export interface SOQLQueryResult {
  totalSize: number
  done: boolean
  records: Record<string, unknown>[]
  nextRecordsUrl?: string
}

export interface PicklistValue {
  value: string
  label: string
  active: boolean
}

export interface SObjectField {
  name: string
  label: string
  type: string
  referenceTo?: string[]
  relationshipName?: string
  aggregatable?: boolean
  groupable?: boolean
  sortable?: boolean
  filterable?: boolean
  nillable?: boolean
  picklistValues?: PicklistValue[]
}

export interface ChildRelationship {
  childSObject: string
  relationshipName: string | null
  field: string
}

export interface SObjectDescribe {
  name: string
  label: string
  fields: SObjectField[]
  childRelationships?: ChildRelationship[]
}

export interface GlobalDescribe {
  sobjects: Array<{
    name: string
    label: string
    queryable: boolean
  }>
}

export type ExportFormat = 'csv' | 'json' | 'excel'

export type SOQLContext =
  | 'keyword'
  | 'object'
  | 'field'
  | 'operator'
  | 'value'
  | 'logical'
  | 'relationship'
  | 'groupby'
  | 'orderby'
  | 'unknown'

export interface SOQLParseResult {
  context: SOQLContext
  currentWord: string
  fromObject: string | null
  relationshipPath?: string[]
  fieldName?: string
  isInSelectClause?: boolean
  isInWhereClause?: boolean
  isInGroupByClause?: boolean
  isInOrderByClause?: boolean
  isInSubquery?: boolean
  subqueryRelationshipName?: string
  subqueryObject?: string
}
