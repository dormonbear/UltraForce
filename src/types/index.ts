// Type definitions for UltraForce Plasmo extension

export interface Organization {
  id: string
  name: string
  username: string
  email: string
  domain: string
  orgType: "Production" | "Sandbox"
  sessionId?: string
  refreshToken?: string
  isActive?: boolean
  createdAt?: string
  lastUsed?: string
}

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

export interface SearchQuery {
  terms: string[]
  filters: Record<string, string[]>
  originalInput: string
}

export interface SalesforceSession {
  sessionId: string
  domain: string
  organizationId: string
  userId: string
  isValid: boolean
}

export interface MetadataType {
  value: string
  label: string
  icon: string
  searchFields: string[]
  selectFields: string[]
  fromObject: string
  orderBy?: string
}

export interface SearchSettings {
  searchLimit: number
  autoSearch: boolean
  showDebug: boolean
  defaultTypes: string[]
  fuzzySearch: boolean
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  records?: T[]
  totalSize?: number
  done?: boolean
}

export interface SalesforceApiConfig {
  CLIENT_ID: string
  CLIENT_SECRET: string
  API_VERSION: string
}

// SOQL Query Types
export interface SOQLQuery {
  select: string[]
  from: string
  where?: string
  orderBy?: string
  limit?: number
}

// Chrome Extension Message Types
export interface ChromeMessage {
  action: string
  data?: any
  tabId?: number
  organization?: Organization
}

export interface ChromeResponse {
  success: boolean
  data?: any
  error?: string
}

// Storage Types
export interface ExtensionStorage {
  organizations: Organization[]
  activeOrganization?: Organization
  settings: SearchSettings
  searchHistory: string[]
  lastSyncTime?: string
}

// Component Props Types
export interface SearchModalProps {
  isVisible: boolean
  onClose: () => void
  onSearch: (query: string, selectedTypes: string[]) => void
  onResultClick: (result: SearchResult) => void
  searchResults: Record<string, SearchResult[]>
  isLoading: boolean
  currentOrg: Organization | null
}

export interface PopupProps {
  organizations: Organization[]
  currentOrg?: Organization
  onOrgSwitch: (org: Organization) => void
  onOpenOptions: () => void
}

// API Error Types
export interface SalesforceError {
  message: string
  errorCode: string
  fields?: string[]
}

export interface ApiError extends Error {
  status?: number
  code?: string
  details?: any
}

// Utility Types
export type MetadataTypeValue = 
  | "ApexClass"
  | "ApexTrigger" 
  | "ApexPage"
  | "ApexComponent"
  | "CustomObject"
  | "CustomField"
  | "ValidationRule"
  | "Flow"
  | "FlowDefinition"
  | "User"
  | "AuraDefinition"
  | "LightningComponentBundle"
  | "Layout"
  | "PermissionSet"
  | "Profile"
  | "CustomTab"
  | "StaticResource"

export type OrgType = "Production" | "Sandbox"

export type SearchScope = "current" | "all" | "recent"

// Event Types
export interface KeyboardShortcutEvent {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  preventDefault: () => void
  stopPropagation: () => void
}

export interface SearchEvent {
  query: string
  types: string[]
  timestamp: number
  resultCount: number
}