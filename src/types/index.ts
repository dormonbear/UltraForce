// Type definitions for UltraForce Plasmo extension

export interface SearchResult {
  id: string
  name: string
  type: string
  description?: string
  namespace?: string
  lastModified?: string
  createdBy?: string
  url?: string
  metadata?: Record<string, any>
  score?: number
}

export type NavigationMode = 'auto' | 'lightning' | 'classic'

export interface RecordContext {
  objectApiName: string | null
  recordId: string
  recordTypeId?: string | null
}

// Command System Types
export interface BuiltinCommand {
  key: string
  types: string[]
  description: string
  isBuiltin: true
}

export interface CustomCommand {
  key: string
  description: string
  soql: string
  useToolingApi: boolean
  isBuiltin: false
  nameField: string
  descriptionFields?: string[]
}

export type SearchCommand = BuiltinCommand | CustomCommand

export function isCustomCommand(cmd: SearchCommand): cmd is CustomCommand {
  return cmd.isBuiltin === false
}

export function isBuiltinCommand(cmd: SearchCommand): cmd is BuiltinCommand {
  return cmd.isBuiltin === true
}
