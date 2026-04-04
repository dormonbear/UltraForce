import type { SearchResult } from '~types'
import { sfRest, API_VERSION } from './auth'
import { logger } from './logger'
import { normalizeHost } from './domain-utils'

export interface ProfileDotNotationResult {
  profileId: string
  profileName: string
  subCategory: string
  filter: string
}

interface CachedProfile {
  id: string
  name: string
}

// Salesforce record interfaces for profile-related queries

interface SfQueryResponse<T> {
  records: T[]
  totalSize: number
  done: boolean
}

interface SfUserRecord {
  Id: string
  Name: string
  Username: string
  Email: string
  IsActive: boolean
}

interface SfPermissionSetRecord {
  Id: string
}

interface SfSetupEntityAccessRecord {
  SetupEntityId: string
}

interface SfObjectPermissionRecord {
  Id: string
  SobjectType: string
  PermissionsCreate: boolean
  PermissionsRead: boolean
  PermissionsEdit: boolean
  PermissionsDelete: boolean
  PermissionsViewAllRecords: boolean
  PermissionsModifyAllRecords: boolean
}

interface SfFieldPermissionRecord {
  Id: string
  SobjectType: string
  Field: string
  PermissionsRead: boolean
  PermissionsEdit: boolean
}

interface SfCustomPermissionRecord {
  Id: string
  DeveloperName: string
  Description: string | null
}

interface SfApexRecord {
  Id: string
  Name: string
  NamespacePrefix: string | null
}

interface SfAppMenuItemRecord {
  Id: string
  Label: string
  Name: string
  Type: string
}

interface SfConnectedAppRecord {
  Id: string
  Name: string
}

interface SfEntityDefinitionRecord {
  DurableId: string
  QualifiedApiName: string
}

// Cache PermissionSetId per profileId to avoid repeated queries
const permissionSetIdCache = new Map<string, string>()

export function parseProfileDotNotation(
  query: string,
  cachedProfiles: CachedProfile[]
): ProfileDotNotationResult | null {
  const firstDotIndex = query.indexOf('.')
  if (firstDotIndex === -1) return null

  const candidateName = query.substring(0, firstDotIndex).trim()
  if (candidateName.length === 0) return null

  // Case-insensitive match against cached profiles
  const matchedProfile = cachedProfiles.find(
    (p) => p.name.toLowerCase() === candidateName.toLowerCase()
  )
  if (!matchedProfile) return null

  const afterFirstDot = query.substring(firstDotIndex + 1)
  const secondDotIndex = afterFirstDot.indexOf('.')

  if (secondDotIndex === -1) {
    return {
      profileId: matchedProfile.id,
      profileName: matchedProfile.name,
      subCategory: '',
      filter: afterFirstDot.trim()
    }
  }

  const subCategory = afterFirstDot.substring(0, secondDotIndex).trim()
  const filter = afterFirstDot.substring(secondDotIndex + 1).trim()

  return {
    profileId: matchedProfile.id,
    profileName: matchedProfile.name,
    subCategory,
    filter
  }
}

export function buildProfileSubMenu(
  profileId: string,
  profileName: string
): SearchResult[] {
  return [
    {
      id: `${profileId}:Users`,
      name: 'Users',
      type: 'ProfileSubMenu',
      description: 'Users assigned to this profile',
      metadata: { profileId, profileName, subCategory: 'Users' }
    },
    {
      id: `${profileId}:ObjectPermissions`,
      name: 'Object Permissions',
      type: 'ProfileSubMenu',
      description: 'Object-level CRUD permissions',
      metadata: { profileId, profileName, subCategory: 'ObjectPermissions' }
    },
    {
      id: `${profileId}:FieldPermissions`,
      name: 'Field Permissions',
      type: 'ProfileSubMenu',
      description: 'Field-level read/edit permissions',
      metadata: { profileId, profileName, subCategory: 'FieldPermissions' }
    },
    {
      id: `${profileId}:CustomPermissions`,
      name: 'Custom Permissions',
      type: 'ProfileSubMenu',
      description: 'Custom permissions assigned to this profile',
      metadata: { profileId, profileName, subCategory: 'CustomPermissions' }
    },
    {
      id: `${profileId}:ApexClassAccess`,
      name: 'Apex Class Access',
      type: 'ProfileSubMenu',
      description: 'Apex class access for this profile',
      metadata: { profileId, profileName, subCategory: 'ApexClassAccess' }
    },
    {
      id: `${profileId}:VFPageAccess`,
      name: 'VF Page Access',
      type: 'ProfileSubMenu',
      description: 'Visualforce page access for this profile',
      metadata: { profileId, profileName, subCategory: 'VFPageAccess' }
    },
    {
      id: `${profileId}:ConnectedApps`,
      name: 'Connected Apps',
      type: 'ProfileSubMenu',
      description: 'Connected app access for this profile',
      metadata: { profileId, profileName, subCategory: 'ConnectedApps' }
    },
    {
      id: `${profileId}:AssignedApps`,
      name: 'Assigned Apps',
      type: 'ProfileSubMenu',
      description: 'App assignments for this profile',
      metadata: { profileId, profileName, subCategory: 'AssignedApps' }
    },
    {
      id: `${profileId}:SystemPermissions`,
      name: 'System Permissions',
      type: 'ProfileSetupLink',
      description: 'Navigate to system permissions',
      metadata: { profileId, profileName, subCategory: 'SystemPermissions', section: 'UserPermissions' }
    },
    {
      id: `${profileId}:LoginHours`,
      name: 'Login Hours',
      type: 'ProfileSetupLink',
      description: 'Navigate to login hours',
      metadata: { profileId, profileName, subCategory: 'LoginHours', section: 'LoginHours' }
    },
    {
      id: `${profileId}:LoginIPRanges`,
      name: 'Login IP Ranges',
      type: 'ProfileSetupLink',
      description: 'Navigate to login IP ranges',
      metadata: { profileId, profileName, subCategory: 'LoginIPRanges', section: 'LoginIpRanges' }
    }
  ]
}

async function fetchQuery<T>(
  soql: string,
  sfHost: string,
  _sessionId: string
): Promise<T[]> {
  const host = normalizeHost(sfHost)
  const queryPath = `/services/data/v${API_VERSION}/query?q=${encodeURIComponent(soql)}`
  const data = await sfRest<SfQueryResponse<T>>(host, queryPath)
  return data.records || []
}

async function getPermissionSetId(
  profileId: string,
  sfHost: string,
  sessionId: string
): Promise<string | null> {
  const cacheKey = `${sfHost}:${profileId}`
  if (permissionSetIdCache.has(cacheKey)) {
    return permissionSetIdCache.get(cacheKey)!
  }

  const soql = `SELECT Id FROM PermissionSet WHERE ProfileId = '${profileId}' LIMIT 1`
  const records = await fetchQuery<SfPermissionSetRecord>(soql, sfHost, sessionId)

  if (records.length === 0) return null

  const psId = records[0].Id
  permissionSetIdCache.set(cacheKey, psId)
  return psId
}

export async function queryProfileUsers(
  profileId: string,
  sfHost: string,
  sessionId: string
): Promise<SearchResult[]> {
  try {
    const soql = `SELECT Id, Name, Username, Email, IsActive FROM User WHERE ProfileId = '${profileId}' ORDER BY Name ASC LIMIT 200`
    const records = await fetchQuery<SfUserRecord>(soql, sfHost, sessionId)

    logger.debug('profile:users', { profileId, count: records.length })

    return records.map((record) => {
      const parts = [record.Username]
      if (record.Email) parts.push(record.Email)
      parts.push(record.IsActive ? 'Active' : 'Inactive')

      return {
        id: record.Id,
        name: record.Name,
        type: 'User',
        description: parts.join(' | '),
        metadata: { ...record, _fromProfile: true }
      }
    })
  } catch (error) {
    logger.error('profile:users failed', { profileId, error })
    return []
  }
}

async function fetchToolingQuery<T>(
  soql: string,
  sfHost: string,
  _sessionId: string
): Promise<T[]> {
  const host = normalizeHost(sfHost)
  const queryPath = `/services/data/v${API_VERSION}/tooling/query?q=${encodeURIComponent(soql)}`
  const data = await sfRest<SfQueryResponse<T>>(host, queryPath)
  return data.records || []
}

async function querySetupEntityAccess<T>(
  permissionSetId: string,
  entityType: string,
  detailObject: string,
  detailFields: string,
  useToolingApi: boolean,
  sfHost: string,
  sessionId: string
): Promise<T[]> {
  const accessSoql = `SELECT SetupEntityId FROM SetupEntityAccess WHERE ParentId = '${permissionSetId}' AND SetupEntityType = '${entityType}'`
  const accessRecords = await fetchQuery<SfSetupEntityAccessRecord>(accessSoql, sfHost, sessionId)

  if (accessRecords.length === 0) return []

  const entityIds = accessRecords.map((r) => `'${r.SetupEntityId}'`).join(',')
  const detailSoql = `SELECT ${detailFields} FROM ${detailObject} WHERE Id IN (${entityIds})`

  const queryFn = useToolingApi ? fetchToolingQuery<T> : fetchQuery<T>
  return queryFn(detailSoql, sfHost, sessionId)
}

export async function queryProfileCustomPermissions(
  profileId: string,
  sfHost: string,
  sessionId: string
): Promise<SearchResult[]> {
  try {
    const psId = await getPermissionSetId(profileId, sfHost, sessionId)
    if (!psId) {
      logger.warn('profile:no-permission-set', { profileId })
      return []
    }

    const records = await querySetupEntityAccess<SfCustomPermissionRecord>(
      psId, 'CustomPermission', 'CustomPermission',
      'Id, DeveloperName, Description', false, sfHost, sessionId
    )

    logger.debug('profile:custom-permissions', { profileId, count: records.length })

    return records.map((record) => ({
      id: record.Id,
      name: record.DeveloperName,
      type: 'CustomPermissionAccess',
      description: record.Description || '',
      metadata: { ...record, profileId }
    }))
  } catch (error) {
    logger.error('profile:custom-permissions failed', { profileId, error })
    return []
  }
}

export async function queryProfileApexClassAccess(
  profileId: string,
  sfHost: string,
  sessionId: string
): Promise<SearchResult[]> {
  try {
    const psId = await getPermissionSetId(profileId, sfHost, sessionId)
    if (!psId) {
      logger.warn('profile:no-permission-set', { profileId })
      return []
    }

    const records = await querySetupEntityAccess<SfApexRecord>(
      psId, 'ApexClass', 'ApexClass',
      'Id, Name, NamespacePrefix', true, sfHost, sessionId
    )

    logger.debug('profile:apex-class-access', { profileId, count: records.length })

    return records.map((record) => {
      const displayName = record.NamespacePrefix
        ? `${record.NamespacePrefix}.${record.Name}`
        : record.Name

      return {
        id: record.Id,
        name: displayName,
        type: 'ApexClassAccess',
        description: record.NamespacePrefix ? `Namespace: ${record.NamespacePrefix}` : '',
        metadata: { ...record, profileId }
      }
    })
  } catch (error) {
    logger.error('profile:apex-class-access failed', { profileId, error })
    return []
  }
}

export async function queryProfileVFPageAccess(
  profileId: string,
  sfHost: string,
  sessionId: string
): Promise<SearchResult[]> {
  try {
    const psId = await getPermissionSetId(profileId, sfHost, sessionId)
    if (!psId) {
      logger.warn('profile:no-permission-set', { profileId })
      return []
    }

    const records = await querySetupEntityAccess<SfApexRecord>(
      psId, 'ApexPage', 'ApexPage',
      'Id, Name, NamespacePrefix', true, sfHost, sessionId
    )

    logger.debug('profile:vf-page-access', { profileId, count: records.length })

    return records.map((record) => {
      const displayName = record.NamespacePrefix
        ? `${record.NamespacePrefix}.${record.Name}`
        : record.Name

      return {
        id: record.Id,
        name: displayName,
        type: 'VFPageAccess',
        description: record.NamespacePrefix ? `Namespace: ${record.NamespacePrefix}` : '',
        metadata: { ...record, profileId }
      }
    })
  } catch (error) {
    logger.error('profile:vf-page-access failed', { profileId, error })
    return []
  }
}

export async function queryProfileConnectedApps(
  profileId: string,
  sfHost: string,
  sessionId: string
): Promise<SearchResult[]> {
  try {
    const psId = await getPermissionSetId(profileId, sfHost, sessionId)
    if (!psId) {
      logger.warn('profile:no-permission-set', { profileId })
      return []
    }

    const records = await querySetupEntityAccess<SfConnectedAppRecord>(
      psId, 'ConnectedApplication', 'ConnectedApplication',
      'Id, Name', false, sfHost, sessionId
    )

    logger.debug('profile:connected-apps', { profileId, count: records.length })

    return records.map((record) => ({
      id: record.Id,
      name: record.Name,
      type: 'ConnectedAppAccess',
      description: '',
      metadata: { ...record, profileId }
    }))
  } catch (error) {
    logger.error('profile:connected-apps failed', { profileId, error })
    return []
  }
}

export async function queryProfileAssignedApps(
  profileId: string,
  sfHost: string,
  sessionId: string
): Promise<SearchResult[]> {
  try {
    const psId = await getPermissionSetId(profileId, sfHost, sessionId)
    if (!psId) {
      logger.warn('profile:no-permission-set', { profileId })
      return []
    }

    const records = await querySetupEntityAccess<SfAppMenuItemRecord>(
      psId, 'TabSet', 'AppMenuItem',
      'Id, Label, Name, Type', false, sfHost, sessionId
    )

    logger.debug('profile:assigned-apps', { profileId, count: records.length })

    return records.map((record) => ({
      id: record.Id,
      name: record.Label || record.Name,
      type: 'AssignedAppAccess',
      description: record.Type || '',
      metadata: { ...record, profileId }
    }))
  } catch (error) {
    logger.error('profile:assigned-apps failed', { profileId, error })
    return []
  }
}

function isCustomObject(name: string): boolean {
  return name.endsWith('__c') || name.endsWith('__mdt') || name.endsWith('__e') || name.endsWith('__b') || name.endsWith('__x')
}

async function fetchDurableIds(
  objectNames: string[],
  sfHost: string,
  sessionId: string
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (objectNames.length === 0) return map

  const nameList = objectNames.map((n) => `'${n}'`).join(',')
  const soql = `SELECT DurableId, QualifiedApiName FROM EntityDefinition WHERE QualifiedApiName IN (${nameList})`
  try {
    const records = await fetchQuery<SfEntityDefinitionRecord>(soql, sfHost, sessionId)
    for (const r of records) {
      map.set(r.QualifiedApiName, r.DurableId)
    }
  } catch (error) {
    logger.error('profile:fetch-durable-ids failed', { error })
  }
  return map
}

export async function queryProfileObjectPermissions(
  profileId: string,
  sfHost: string,
  sessionId: string
): Promise<SearchResult[]> {
  try {
    const psId = await getPermissionSetId(profileId, sfHost, sessionId)
    if (!psId) {
      logger.warn('profile:no-permission-set', { profileId })
      return []
    }

    const soql = `SELECT Id, SobjectType, PermissionsCreate, PermissionsRead, PermissionsEdit, PermissionsDelete, PermissionsViewAllRecords, PermissionsModifyAllRecords FROM ObjectPermissions WHERE ParentId = '${psId}' ORDER BY SobjectType ASC`
    const records = await fetchQuery<SfObjectPermissionRecord>(soql, sfHost, sessionId)

    logger.debug('profile:object-permissions', { profileId, count: records.length })

    // Fetch DurableIds for custom objects (needed for navigation URLs)
    const customNames = records
      .map((r) => r.SobjectType)
      .filter(isCustomObject)
    const durableIdMap = await fetchDurableIds(customNames, sfHost, sessionId)

    return records.map((record) => {
      const flags = [
        record.PermissionsCreate ? 'C' : '-',
        record.PermissionsRead ? 'R' : '-',
        record.PermissionsEdit ? 'E' : '-',
        record.PermissionsDelete ? 'D' : '-',
        record.PermissionsViewAllRecords ? 'V' : '-',
        record.PermissionsModifyAllRecords ? 'M' : '-'
      ].join(' ')

      // Custom objects use DurableId in profile URL, standard objects use API name
      const objectRef = durableIdMap.get(record.SobjectType) || record.SobjectType

      return {
        id: record.Id,
        name: record.SobjectType,
        type: 'ObjectPermission',
        description: flags,
        metadata: { ...record, profileId, objectRef }
      }
    })
  } catch (error) {
    logger.error('profile:object-permissions failed', { profileId, error })
    return []
  }
}

export async function queryProfileFieldPermissions(
  profileId: string,
  sfHost: string,
  sessionId: string
): Promise<SearchResult[]> {
  try {
    const psId = await getPermissionSetId(profileId, sfHost, sessionId)
    if (!psId) {
      logger.warn('profile:no-permission-set', { profileId })
      return []
    }

    const soql = `SELECT Id, SobjectType, Field, PermissionsRead, PermissionsEdit FROM FieldPermissions WHERE ParentId = '${psId}' ORDER BY SobjectType, Field ASC`
    const records = await fetchQuery<SfFieldPermissionRecord>(soql, sfHost, sessionId)

    logger.debug('profile:field-permissions', { profileId, count: records.length })

    return records.map((record) => {
      const flags = [
        record.PermissionsRead ? 'Read' : '-',
        record.PermissionsEdit ? 'Edit' : '-'
      ].join(' ')

      return {
        id: record.Id,
        name: record.Field,
        type: 'FieldPermission',
        description: flags,
        metadata: { ...record, profileId }
      }
    })
  } catch (error) {
    logger.error('profile:field-permissions failed', { profileId, error })
    return []
  }
}

export function filterProfileSubData(
  results: SearchResult[],
  filter: string
): SearchResult[] {
  if (!filter) return results
  const lowerFilter = filter.toLowerCase()
  return results.filter(
    (r) =>
      r.name.toLowerCase().includes(lowerFilter) ||
      r.description?.toLowerCase().includes(lowerFilter)
  )
}

export function clearPermissionSetIdCache(): void {
  permissionSetIdCache.clear()
}
