// Search orchestration - coordinates metadata search across types, dot-notation, and realtime queries

import type { SearchResult } from '~types'
import { getSession, API_VERSION } from './auth'
import { logger } from './logger'
import { normalizeHost, escapeSoql } from './domain-utils'
import {
  searchIndex,
  hasSearchIndex
} from './fuzzy-search'
import {
  parseProfileDotNotation,
  buildProfileSubMenu,
  queryProfileUsers,
  queryProfileObjectPermissions,
  queryProfileFieldPermissions,
  queryProfileCustomPermissions,
  queryProfileApexClassAccess,
  queryProfileVFPageAccess,
  queryProfileConnectedApps,
  queryProfileAssignedApps,
  filterProfileSubData
} from './profile-search'
import {
  fetchAllPages,
  ensureCMDTRecordIndex,
  ensureCustomSettingRecordIndex,
  ensureFieldIndex,
  ensureMetadataIndex
} from './metadata-fetcher'

interface SfUserSearchRecord extends Record<string, unknown> {
  Id: string
  Name: string
  Username: string
  Email: string
  FederationIdentifier: string | null
  IsActive: boolean
  Profile: { Name: string } | null
  UserRole: { Name: string } | null
}

interface SfGroupSearchRecord extends Record<string, unknown> {
  Id: string
  Name: string
  DeveloperName: string
  Email?: string
}

interface DotNotationResult { objectName: string; fieldQuery: string; isCMDT: boolean }

function parseDotNotation(query: string): DotNotationResult | null {
  const dotIndex = query.indexOf('.')
  if (dotIndex === -1) return null
  const objectName = query.substring(0, dotIndex).trim()
  const fieldQuery = query.substring(dotIndex + 1).trim()
  if (objectName.length === 0) return null
  return { objectName, fieldQuery, isCMDT: objectName.toLowerCase().endsWith('__mdt') }
}

/**
 * Main search entry point - dispatches to dot-notation, realtime, or cached index search
 * based on query format and selected metadata types.
 */
export async function searchSalesforceMetadata(
  query: string,
  selectedTypes: string[],
  sfHost: string,
  options: { useFuzzy?: boolean; hideManagedPackage?: boolean } = {}
): Promise<Record<string, SearchResult[]>> {
  const { useFuzzy = true, hideManagedPackage = true } = options

  if (!sfHost) {
    logger.error('searchSalesforceMetadata: missing sfHost')
    return {}
  }

  const session = await getSession(sfHost)
  if (!session) {
    logger.error('searchSalesforceMetadata: no session', { host: sfHost })
    return {}
  }

  const apiHost = normalizeHost(session.hostname)
  const results: Record<string, SearchResult[]> = {}
  const dotNotation = parseDotNotation(query)

  if (dotNotation) {
    const dotResults = await handleDotNotationSearch(
      dotNotation,
      query,
      selectedTypes,
      apiHost,
      session,
      useFuzzy,
      hideManagedPackage
    )
    if (dotResults) return dotResults
  }

  // Realtime SOQL searches for User/Queue/Group (not cached)
  const realtimeSearches: Array<{ type: string; search: () => Promise<SearchResult[]> }> = []
  if (selectedTypes.includes('User') && query.trim())
    realtimeSearches.push({ type: 'User', search: () => searchUsersRealtime(query, apiHost) })
  if (selectedTypes.includes('Queue') && query.trim())
    realtimeSearches.push({ type: 'Queue', search: () => searchGroupsRealtime(query, 'Queue', apiHost) })
  if (selectedTypes.includes('Group') && query.trim())
    realtimeSearches.push({ type: 'Group', search: () => searchGroupsRealtime(query, 'Regular', apiHost) })

  for (const { type, search } of realtimeSearches) {
    try {
      results[type] = await search()
    } catch (error) {
      logger.error(`search:${type.toLowerCase()} failed`, { error })
      results[type] = []
    }
  }

  const typesToSearch = selectedTypes.filter((t) => t !== 'CustomField' && t !== 'User' && t !== 'Queue' && t !== 'Group')
  if (typesToSearch.length > 0) {
    const otherResults = await searchMetadataTypes(query, typesToSearch, apiHost, useFuzzy, hideManagedPackage)
    Object.assign(results, otherResults)
  }

  return results
}

/** Returns null if the dot-notation doesn't match any special handler (falls through to normal search). */
async function handleDotNotationSearch(
  dotNotation: DotNotationResult,
  query: string,
  selectedTypes: string[],
  apiHost: string,
  session: { key: string; hostname: string },
  useFuzzy: boolean,
  hideManagedPackage: boolean
): Promise<Record<string, SearchResult[]> | null> {
  const { objectName, fieldQuery, isCMDT } = dotNotation
  const results: Record<string, SearchResult[]> = {}

  // CMDT record search: "MyType__mdt.RecordName"
  if (isCMDT && selectedTypes.includes('CustomMetadataType')) {
    logger.debug('search:cmdt-record', { cmdt: objectName, query: fieldQuery })
    try {
      await ensureCMDTRecordIndex(objectName, apiHost)
      results['CustomMetadataType'] = hasSearchIndex(`CMDTRecord:${objectName}`, apiHost)
        ? searchIndex(fieldQuery, `CMDTRecord:${objectName}`, apiHost, { useFuzzy, hideManagedPackage })
        : []
    } catch (error) {
      logger.error('search:cmdt-record failed', { cmdt: objectName, error })
      results['CustomMetadataType'] = []
    }
    await mergeOtherTypes(results, query, selectedTypes, 'CustomMetadataType', apiHost, useFuzzy, hideManagedPackage)
    return results
  }

  // Custom Setting record search: "MySetting__c.RecordName"
  if (!isCMDT && selectedTypes.includes('CustomSetting')) {
    const isCustomSetting = await checkIsCustomSetting(objectName, apiHost)
    if (isCustomSetting) {
      logger.debug('search:custom-setting-record', { setting: objectName, query: fieldQuery })
      try {
        await ensureCustomSettingRecordIndex(objectName, apiHost)
        results['CustomSetting'] = hasSearchIndex(`CustomSettingRecord:${objectName}`, apiHost)
          ? searchIndex(fieldQuery, `CustomSettingRecord:${objectName}`, apiHost, { useFuzzy, hideManagedPackage })
          : []
      } catch (error) {
        logger.error('search:custom-setting-record failed', { setting: objectName, error })
        results['CustomSetting'] = []
      }
      await mergeOtherTypes(results, query, selectedTypes, 'CustomSetting', apiHost, useFuzzy, hideManagedPackage)
      return results
    }
  }

  // Profile sub-data search: "System Administrator.Users.john"
  if (!isCMDT && selectedTypes.includes('Profile')) {
    const profileResult = await handleProfileDotSearch(query, apiHost, session, selectedTypes, useFuzzy, hideManagedPackage)
    if (profileResult) return profileResult
  }

  // Field search: "Account.Name" or "account."
  if (!isCMDT && selectedTypes.includes('CustomField')) {
    logger.debug('search:field', { object: objectName, query: fieldQuery })
    try {
      await ensureFieldIndex(objectName, apiHost)
      results['CustomField'] = hasSearchIndex(`Field:${objectName}`, apiHost)
        ? searchIndex(fieldQuery, `Field:${objectName}`, apiHost, { useFuzzy, hideManagedPackage })
        : []
    } catch (error) {
      logger.error('search:field failed', { object: objectName, error })
      results['CustomField'] = []
    }
    await mergeOtherTypes(results, query, selectedTypes, 'CustomField', apiHost, useFuzzy, hideManagedPackage)
    return results
  }

  return null
}

/** Profile dot-notation: returns null if the query doesn't match a cached profile name. */
async function handleProfileDotSearch(
  query: string,
  apiHost: string,
  session: { key: string; hostname: string },
  selectedTypes: string[],
  useFuzzy: boolean,
  hideManagedPackage: boolean
): Promise<Record<string, SearchResult[]> | null> {
  const cachedProfiles = searchIndex('', 'Profile', apiHost, { useFuzzy: false, hideManagedPackage: false })
    .map((r) => ({ id: r.id, name: r.name }))

  const profileDot = parseProfileDotNotation(query, cachedProfiles)
  if (!profileDot) return null

  const { profileId, profileName, subCategory, filter } = profileDot
  const results: Record<string, SearchResult[]> = {}

  if (!subCategory) {
    logger.debug('search:profile-submenu', { profile: profileName })
    let subMenu = buildProfileSubMenu(profileId, profileName)
    if (filter) {
      subMenu = subMenu.filter((item) =>
        item.name.toLowerCase().includes(filter.toLowerCase())
      )
    }
    results['Profile'] = subMenu
  } else {
    logger.debug('search:profile-subdata', { profile: profileName, subCategory, filter })
    let subResults = await dispatchProfileSubQuery(subCategory, profileId, apiHost, session.key)
    subResults = subResults.map((r) => ({
      ...r,
      metadata: { ...r.metadata, profileName, _subCategory: subCategory }
    }))
    if (filter) {
      subResults = filterProfileSubData(subResults, filter)
    }
    results['Profile'] = subResults
  }

  await mergeOtherTypes(results, query, selectedTypes, 'Profile', apiHost, useFuzzy, hideManagedPackage)
  return results
}

async function dispatchProfileSubQuery(
  subCategory: string,
  profileId: string,
  apiHost: string,
  sessionKey: string
): Promise<SearchResult[]> {
  switch (subCategory) {
    case 'Users': return queryProfileUsers(profileId, apiHost, sessionKey)
    case 'ObjectPermissions': return queryProfileObjectPermissions(profileId, apiHost, sessionKey)
    case 'FieldPermissions': return queryProfileFieldPermissions(profileId, apiHost, sessionKey)
    case 'CustomPermissions': return queryProfileCustomPermissions(profileId, apiHost, sessionKey)
    case 'ApexClassAccess': return queryProfileApexClassAccess(profileId, apiHost, sessionKey)
    case 'VFPageAccess': return queryProfileVFPageAccess(profileId, apiHost, sessionKey)
    case 'ConnectedApps': return queryProfileConnectedApps(profileId, apiHost, sessionKey)
    case 'AssignedApps': return queryProfileAssignedApps(profileId, apiHost, sessionKey)
    default: return []
  }
}

async function mergeOtherTypes(
  results: Record<string, SearchResult[]>, query: string, selectedTypes: string[],
  excludeType: string, apiHost: string, useFuzzy: boolean, hideManagedPackage: boolean
): Promise<void> {
  const otherTypes = selectedTypes.filter((t) => t !== excludeType)
  if (otherTypes.length > 0) {
    Object.assign(results, await searchMetadataTypes(query, otherTypes, apiHost, useFuzzy, hideManagedPackage))
  }
}

async function searchUsersRealtime(
  searchTerm: string,
  sfHost: string
): Promise<SearchResult[]> {
  const host = normalizeHost(sfHost)
  const start = Date.now()
  const escaped = escapeSoql(searchTerm)
  const searchPattern = `%${escaped}%`

  const query = `SELECT Id, Name, Username, Email, FederationIdentifier, IsActive, Profile.Name, UserRole.Name FROM User WHERE Name LIKE '${searchPattern}' OR Username LIKE '${searchPattern}' OR Email LIKE '${searchPattern}' OR FederationIdentifier LIKE '${searchPattern}' ORDER BY Name ASC LIMIT 50`
  const queryPath = `/services/data/v${API_VERSION}/query?q=${encodeURIComponent(query)}`

  logger.debug('search:user:soql', { query })

  try {
    const records = await fetchAllPages<SfUserSearchRecord>(host, queryPath)
    logger.debug('search:user', { term: searchTerm, count: records.length, ms: Date.now() - start })

    return records.map((record) => {
      const parts = [record.Username]
      if (record.Email) parts.push(record.Email)
      if (record.Profile?.Name) parts.push(record.Profile.Name)
      if (record.UserRole?.Name) parts.push(record.UserRole.Name)
      if (record.IsActive === false) parts.push('Inactive')

      return {
        id: record.Id,
        name: record.Name,
        type: 'User',
        description: parts.join(' | '),
        metadata: record as Record<string, unknown>
      }
    })
  } catch (error) {
    logger.error('search:user failed', { term: searchTerm, error })
    return []
  }
}

async function searchGroupsRealtime(
  searchTerm: string,
  groupType: 'Queue' | 'Regular',
  sfHost: string
): Promise<SearchResult[]> {
  const host = normalizeHost(sfHost)
  const start = Date.now()
  const escaped = escapeSoql(searchTerm)
  const searchPattern = `%${escaped}%`
  const resultType = groupType === 'Queue' ? 'Queue' : 'Group'

  const query = groupType === 'Queue'
    ? `SELECT Id, Name, DeveloperName, Email FROM Group WHERE Type = 'Queue' AND (Name LIKE '${searchPattern}' OR DeveloperName LIKE '${searchPattern}') ORDER BY Name ASC LIMIT 50`
    : `SELECT Id, Name, DeveloperName FROM Group WHERE Type = 'Regular' AND (Name LIKE '${searchPattern}' OR DeveloperName LIKE '${searchPattern}') ORDER BY Name ASC LIMIT 50`

  const queryPath = `/services/data/v${API_VERSION}/query?q=${encodeURIComponent(query)}`
  logger.debug(`search:${resultType.toLowerCase()}:soql`, { query })

  try {
    const records = await fetchAllPages<SfGroupSearchRecord>(host, queryPath)
    logger.debug(`search:${resultType.toLowerCase()}`, { term: searchTerm, count: records.length, ms: Date.now() - start })

    return records.map((record) => {
      const parts = [record.DeveloperName]
      if (record.Email) parts.push(record.Email)

      return {
        id: record.Id,
        name: record.Name,
        type: resultType,
        description: parts.join(' | '),
        metadata: record as Record<string, unknown>
      }
    })
  } catch (error) {
    logger.error(`search:${resultType.toLowerCase()} failed`, { term: searchTerm, error })
    return []
  }
}

const customSettingCache = new Map<string, Set<string>>()

async function checkIsCustomSetting(objectName: string, sfHost: string): Promise<boolean> {
  const host = normalizeHost(sfHost)

  if (!customSettingCache.has(host)) {
    await ensureMetadataIndex('CustomSetting', host)
    const settings = searchIndex('', 'CustomSetting', host, { useFuzzy: false, hideManagedPackage: false })
    const settingNames = new Set(settings.map((s) => s.metadata?.QualifiedApiName?.toLowerCase()).filter(Boolean))
    customSettingCache.set(host, settingNames)
  }

  const settingNames = customSettingCache.get(host)
  return settingNames?.has(objectName.toLowerCase()) || false
}

/** Searches cached metadata indexes for all requested types in parallel. */
export async function searchMetadataTypes(
  query: string,
  selectedTypes: string[],
  apiHost: string,
  useFuzzy: boolean,
  hideManagedPackage: boolean
): Promise<Record<string, SearchResult[]>> {
  const results: Record<string, SearchResult[]> = {}

  const searchPromises = selectedTypes.map(async (metadataType) => {
    try {
      await ensureMetadataIndex(metadataType, apiHost)
      const searchResults = searchIndex(query, metadataType, apiHost, { useFuzzy, hideManagedPackage })
      return { type: metadataType, results: searchResults }
    } catch (error) {
      logger.error('search:metadata failed', { type: metadataType, error })
      return { type: metadataType, results: [] }
    }
  })

  const searchResults = await Promise.all(searchPromises)
  searchResults.forEach(({ type, results: typeResults }) => {
    results[type] = typeResults
  })

  return results
}

