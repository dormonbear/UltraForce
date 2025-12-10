export interface SOQLSuggestion {
  value: string
  label: string
  type: 'keyword' | 'object' | 'field' | 'function' | 'operator'
  detail?: string
}

export interface SOQLQueryResult {
  totalSize: number
  done: boolean
  records: Record<string, unknown>[]
  nextRecordsUrl?: string
}

export interface SObjectField {
  name: string
  label: string
  type: string
  referenceTo?: string[]
  relationshipName?: string
}

export interface SObjectDescribe {
  name: string
  label: string
  fields: SObjectField[]
}

export interface GlobalDescribe {
  sobjects: Array<{
    name: string
    label: string
    queryable: boolean
  }>
}

export type ExportFormat = 'csv' | 'json' | 'excel'
