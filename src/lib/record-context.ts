import { sfRest, API_VERSION } from './auth'
import { isApiAvailable } from './salesforce-api'
import { buildSetupUrl, shouldUseLightning } from './url-builder'
import { logger } from './logger'
import type { NavigationMode } from '~types'

const GLOBAL_DESCRIBE_CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Module-level caches (replace instance caches from WindowManager)
const sobjectPrefixCache: Record<string, Record<string, string>> = {}
const sobjectCacheTimestamp: Record<string, number> = {}
const currentUserIdCache: Record<string, string> = {}
const currentUserProfileIdCache: Record<string, string> = {}
const userLightningPreferenceCache: Record<string, boolean> = {}

// Standard object key prefixes for Classic URL object resolution
const KEY_PREFIX_MAP: Record<string, string> = {
  '001': 'Account',
  '003': 'Contact',
  '005': 'User',
  '006': 'Opportunity',
  '00Q': 'Lead',
  '00T': 'Task',
  '00U': 'Event',
  '00O': 'Report',
  '00a': 'Asset',
  '00e': 'UserProfileFeed',
  '00l': 'EmailTemplate',
  '00N': 'CustomField',
  '00P': 'Document',
  '00S': 'Solution',
  '012': 'RecordType',
  '500': 'Case',
  '701': 'Campaign',
  '800': 'Order',
  '801': 'OrderItem'
}

export async function fetchRecordTypeId(
  sfHost: string,
  objectApiName: string,
  recordId: string
): Promise<string | null> {
  try {
    const record = await sfRest<{ RecordTypeId?: string }>(
      sfHost,
      `/services/data/v${API_VERSION}/sobjects/${objectApiName}/${recordId}?fields=RecordTypeId`
    )
    return record?.RecordTypeId || null
  } catch {
    return null
  }
}

export async function resolveObjectApiNameFromRecord(
  sfHost: string,
  recordId: string
): Promise<string | null> {
  const prefix = recordId.slice(0, 3)
  if (KEY_PREFIX_MAP[prefix]) {
    return KEY_PREFIX_MAP[prefix]
  }

  const hostKey = sfHost
  const hostCache = sobjectPrefixCache[hostKey] || {}
  const cacheTs = sobjectCacheTimestamp[hostKey] || 0

  if (hostCache[prefix] && Date.now() - cacheTs < GLOBAL_DESCRIBE_CACHE_DURATION) {
    return hostCache[prefix]
  }

  try {
    const resp = await sfRest<{ sobjects?: Array<{ keyPrefix?: string; name?: string }> }>(sfHost, `/services/data/v${API_VERSION}/sobjects/`)
    if (resp?.sobjects) {
      if (!sobjectPrefixCache[hostKey]) {
        sobjectPrefixCache[hostKey] = {}
      }
      resp.sobjects.forEach((obj) => {
        if (obj.keyPrefix && obj.name) {
          sobjectPrefixCache[hostKey][obj.keyPrefix] = obj.name
        }
      })
      sobjectCacheTimestamp[hostKey] = Date.now()
    }
    return sobjectPrefixCache[hostKey]?.[prefix] || null
  } catch (error) {
    logger.warn('Failed to resolve object from key prefix:', error)
    return null
  }
}

export async function getCurrentUserId(sfHost: string): Promise<string | null> {
  const hostKey = sfHost
  if (currentUserIdCache[hostKey]) {
    return currentUserIdCache[hostKey]
  }

  if (!isApiAvailable(sfHost)) {
    return null
  }

  try {
    const apex = encodeURIComponent('throw new System.TypeException(UserInfo.getUserId());')
    const resp = await sfRest<{ exceptionMessage?: string }>(
      sfHost,
      `/services/data/v${API_VERSION}/tooling/executeAnonymous/?anonymousBody=${apex}`
    )
    const userId = resp?.exceptionMessage?.replace('System.TypeException: ', '')
    if (userId && userId.startsWith('005')) {
      currentUserIdCache[hostKey] = userId
      return userId
    }
  } catch {
    // User may not have Author Apex permission
  }
  return null
}

export async function getCurrentUserProfileId(sfHost: string): Promise<string | null> {
  const hostKey = sfHost
  if (currentUserProfileIdCache[hostKey]) {
    return currentUserProfileIdCache[hostKey]
  }

  const userId = await getCurrentUserId(sfHost)
  if (!userId) {
    return null
  }

  try {
    const soql = encodeURIComponent(`SELECT ProfileId FROM User WHERE Id = '${userId}'`)
    const resp = await sfRest<{ records?: Array<{ ProfileId?: string }> }>(sfHost, `/services/data/v${API_VERSION}/query/?q=${soql}`)
    const profileId = resp?.records?.[0]?.ProfileId
    if (profileId) {
      currentUserProfileIdCache[hostKey] = profileId
      return profileId
    }
  } catch {
    // ignore
  }
  return null
}

export async function getUserLightningPreference(sfHost: string): Promise<boolean | null> {
  const hostKey = sfHost
  if (hostKey in userLightningPreferenceCache) {
    return userLightningPreferenceCache[hostKey]
  }

  const userId = await getCurrentUserId(sfHost)
  if (!userId) {
    userLightningPreferenceCache[hostKey] = true
    return true
  }

  try {
    const soql = encodeURIComponent(
      `SELECT UserPreferencesLightningExperiencePreferred FROM User WHERE Id = '${userId}'`
    )
    const resp = await sfRest<{ records?: Array<{ UserPreferencesLightningExperiencePreferred?: boolean }> }>(sfHost, `/services/data/v${API_VERSION}/query/?q=${soql}`)
    const preference = resp?.records?.[0]?.UserPreferencesLightningExperiencePreferred

    if (typeof preference === 'boolean') {
      userLightningPreferenceCache[hostKey] = preference
      return preference
    }
  } catch {
    // ignore
  }

  userLightningPreferenceCache[hostKey] = true
  return true
}

export async function getLayoutAssignment(
  sfHost: string,
  objectApiName: string,
  profileId: string,
  recordTypeId: string | null
): Promise<{ layoutId: string; objectDurableId: string } | null> {
  let objectDurableId: string | null = null
  try {
    const entityQuery = `SELECT DurableId FROM EntityDefinition WHERE QualifiedApiName='${objectApiName}' LIMIT 1`
    const entityResp = await sfRest<{ records?: Array<{ DurableId?: string }> }>(
      sfHost,
      `/services/data/v${API_VERSION}/tooling/query/?q=${encodeURIComponent(entityQuery)}`
    )
    objectDurableId = entityResp?.records?.[0]?.DurableId || null
  } catch (error) {
    logger.warn('EntityDefinition query failed:', error)
  }

  if (!objectDurableId) {
    return null
  }

  const queries = [
    recordTypeId
      ? `SELECT LayoutId FROM ProfileLayout WHERE TableEnumOrId='${objectDurableId}' AND ProfileId='${profileId}' AND RecordTypeId='${recordTypeId}' LIMIT 1`
      : null,
    `SELECT LayoutId FROM ProfileLayout WHERE TableEnumOrId='${objectDurableId}' AND ProfileId='${profileId}' AND RecordTypeId = NULL LIMIT 1`
  ].filter(Boolean) as string[]

  for (const q of queries) {
    try {
      const resp = await sfRest<{ records?: Array<{ LayoutId?: string }> }>(
        sfHost,
        `/services/data/v${API_VERSION}/tooling/query/?q=${encodeURIComponent(q)}`
      )
      const layoutId = resp?.records?.[0]?.LayoutId
      if (layoutId) {
        return { layoutId, objectDurableId }
      }
    } catch (error) {
      logger.warn('ProfileLayout query failed:', error)
    }
  }

  return null
}

export async function handleFieldsNavigation(
  sfHost: string,
  objectApiName: string,
  navigationMode: NavigationMode,
  userLightningPreference: boolean | null
): Promise<string | null> {
  const useLightning = shouldUseLightning(navigationMode, userLightningPreference)

  if (useLightning) {
    const entityQuery = `SELECT DurableId FROM EntityDefinition WHERE QualifiedApiName='${objectApiName}' LIMIT 1`
    const entityResp = await sfRest<{ records?: Array<{ DurableId?: string }> }>(
      sfHost,
      `/services/data/v${API_VERSION}/tooling/query/?q=${encodeURIComponent(entityQuery)}`
    )
    const objectDurableId = entityResp?.records?.[0]?.DurableId
    if (objectDurableId) {
      return buildSetupUrl(sfHost, `/lightning/setup/ObjectManager/${objectDurableId}/FieldsAndRelationships/view`)
    }
  } else {
    return `https://${sfHost}/p/setup/layout/LayoutFieldList?type=${objectApiName}&setupid=${objectApiName}Fields&retURL=%2Fui%2Fsetup%2FSetup%3Fsetupid%3D${objectApiName}`
  }

  return null
}

export async function handleRecordTypeNavigation(
  sfHost: string,
  objectApiName: string,
  recordTypeId: string,
  navigationMode: NavigationMode,
  userLightningPreference: boolean | null
): Promise<string | null> {
  const useLightning = shouldUseLightning(navigationMode, userLightningPreference)

  if (useLightning) {
    const entityQuery = `SELECT DurableId FROM EntityDefinition WHERE QualifiedApiName='${objectApiName}' LIMIT 1`
    const entityResp = await sfRest<{ records?: Array<{ DurableId?: string }> }>(
      sfHost,
      `/services/data/v${API_VERSION}/tooling/query/?q=${encodeURIComponent(entityQuery)}`
    )
    const objectDurableId = entityResp?.records?.[0]?.DurableId
    if (objectDurableId) {
      return buildSetupUrl(
        sfHost,
        `/lightning/setup/ObjectManager/${objectDurableId}/RecordTypes/${recordTypeId}/view`
      )
    }
  } else {
    return `https://${sfHost}/setup/ui/recordtypefields.jsp?id=${recordTypeId}&type=${objectApiName}&setupid=${objectApiName}Records`
  }

  return null
}

export async function getCurrentRecordLayoutInfo(
  sfHost: string,
  objectApiName: string,
  recordId: string
): Promise<{ objectApiName: string; objectDurableId: string; layoutId: string; recordId: string } | null> {
  try {
    let recordTypeId: string | null = null
    try {
      const record = await sfRest<{ RecordTypeId?: string }>(
        sfHost,
        `/services/data/v${API_VERSION}/sobjects/${objectApiName}/${recordId}?fields=RecordTypeId`
      )
      recordTypeId = record?.RecordTypeId || null
    } catch {
      // Record may not have RecordType field
    }

    const profileId = await getCurrentUserProfileId(sfHost)
    if (!profileId) {
      return null
    }

    const layoutResult = await getLayoutAssignment(sfHost, objectApiName, profileId, recordTypeId)
    if (!layoutResult) {
      return null
    }

    return {
      objectApiName,
      objectDurableId: layoutResult.objectDurableId,
      layoutId: layoutResult.layoutId,
      recordId
    }
  } catch (error) {
    logger.warn('Failed to resolve current record layout:', error)
    return null
  }
}

// Reset caches (for testing)
export function _resetCaches(): void {
  for (const key of Object.keys(currentUserIdCache)) delete currentUserIdCache[key]
  for (const key of Object.keys(currentUserProfileIdCache)) delete currentUserProfileIdCache[key]
  for (const key of Object.keys(userLightningPreferenceCache)) delete userLightningPreferenceCache[key]
  for (const key of Object.keys(sobjectPrefixCache)) delete sobjectPrefixCache[key]
  for (const key of Object.keys(sobjectCacheTimestamp)) delete sobjectCacheTimestamp[key]
}
