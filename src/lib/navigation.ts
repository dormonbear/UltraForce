import { getSetupHost, shouldUseLightning, isChinaDomain } from './url-builder'
import type { SearchResult, NavigationMode } from '~types'
import type { ObjectAction } from '~components/search/ResultItem'

export interface NavigationContext {
  sfHost: string | null
  navigationMode: NavigationMode
  userLightningPreference: boolean | null
}

// Standard object key prefixes for Classic URL object resolution
export const KEY_PREFIX_MAP: Record<string, string> = {
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

export function buildNavigationUrl(result: SearchResult, context: NavigationContext): string | null {
  // Setup shortcuts have absolute URLs
  if (result.type === 'SetupShortcut' && result.url) {
    return result.url
  }

  if (!context.sfHost || !result.id) {
    return null
  }

  const baseUrl = `https://${context.sfHost}`
  const useLightning = shouldUseLightning(context.navigationMode, context.userLightningPreference)
  const setupHost = getSetupHost(context.sfHost)

  if (useLightning) {
    return buildLightningUrl(result, baseUrl, setupHost)
  }
  return buildClassicUrl(result, baseUrl)
}

// Types addressed as /lightning/setup/<area>/page?address=%2F<id>
const LIGHTNING_SETUP_AREAS: Record<string, string> = {
  ApexClass: 'ApexClasses',
  ApexTrigger: 'ApexTriggers',
  ApexPage: 'ApexPages',
  ApexComponent: 'ApexComponents',
  LightningComponentBundle: 'LightningComponentBundles',
  AuraDefinitionBundle: 'AuraBundles',
  PermissionSet: 'PermSets',
  Profile: 'EnhancedProfiles',
  CustomLabel: 'ExternalStrings'
}

// Profile detail sections. Both themes address these as <profileId>?s=<section>,
// so the query is shared and only the surrounding URL shape differs.
const PROFILE_SECTIONS: Record<string, string> = {
  ObjectPermission: 'ObjectsAndTabs',
  FieldPermission: 'FieldPermissions',
  CustomPermissionAccess: 'CustomPermissions',
  ApexClassAccess: 'ApexClassAccess',
  VFPageAccess: 'ApexPageAccess',
  ConnectedAppAccess: 'ConnectedAppSettings',
  AssignedAppAccess: 'ObjectsAndTabs'
}

// ProfileSetupLink carries its section in metadata rather than the table
function isProfileSectionType(type: string): boolean {
  return type === 'ProfileSetupLink' || type in PROFILE_SECTIONS
}

function profileSectionQuery(result: SearchResult): string {
  const section = result.type === 'ProfileSetupLink' ? result.metadata?.section : PROFILE_SECTIONS[result.type]
  const query = `/${result.metadata?.profileId}?s=${section}`
  if (result.type === 'ObjectPermission') {
    return `${query}&o=${result.metadata?.objectRef || result.name}`
  }
  if (result.type === 'FieldPermission') {
    return `${query}&o=${result.metadata?.SobjectType}`
  }
  return query
}

// Resolves the field id out of a CustomField DurableId ("Account.00Nxxx" -> "00Nxxx")
function customFieldId(result: SearchResult): string {
  const durableId = result.metadata?.DurableId || ''
  return durableId.includes('.') ? durableId.split('.')[1] : durableId
}

function buildLightningUrl(result: SearchResult, baseUrl: string, setupHost: string | null): string | null {
  const setupArea = LIGHTNING_SETUP_AREAS[result.type]
  if (setupArea) {
    return `${baseUrl}/lightning/setup/${setupArea}/page?address=%2F${result.id}`
  }

  if (isProfileSectionType(result.type)) {
    const address = encodeURIComponent(profileSectionQuery(result))
    return `https://${setupHost}/lightning/setup/Profiles/page?address=${address}`
  }

  switch (result.type) {
    case 'ProfileSubMenu':
      return null // Tab-only navigation, no click action
    case 'Flow':
      return `${baseUrl}/builder_platform_interaction/flowBuilder.app?flowId=${result.id}`
    case 'User':
      return `https://${setupHost}/lightning/setup/ManageUsers/page?address=%2F${result.id}%3Fnoredirect%3D1%26isUserEntityOverride%3D1`
    case 'CustomObject':
      return `${baseUrl}/lightning/o/${result.metadata?.QualifiedApiName}/list`
    case 'CustomField': {
      const objectName = result.metadata?.ObjectApiName || result.metadata?.EntityDefinition?.QualifiedApiName
      const fieldId = customFieldId(result)
      if (objectName && fieldId) {
        return `https://${setupHost}/lightning/setup/ObjectManager/${objectName}/FieldsAndRelationships/${fieldId}/view`
      }
      return `${baseUrl}/lightning/r/${result.type}/${result.id}/view`
    }
    case 'CustomMetadataType': {
      const recordId = result.metadata?.Id || result.metadata?.DurableId || result.id
      return `https://${setupHost}/lightning/setup/CustomMetadata/page?address=%2F${recordId}`
    }
    case 'CustomSetting': {
      if (result.metadata?._isSettingDefinition) {
        const settingId = result.metadata?.DurableId || result.id
        return `https://${setupHost}/lightning/setup/CustomSettings/page?address=%2Fsetup%2Fui%2FviewCustomSettings.apexp%3Fid%3D${settingId}`
      }
      return `https://${setupHost}/lightning/setup/CustomSettings/page?address=%2F${result.id}`
    }
    case 'CustomQuery':
      return `${baseUrl}/lightning/r/sObject/${result.id}/view`
    case 'Queue':
      return `https://${setupHost}/lightning/setup/Queues/page?address=%2Fp%2Fown%2FQueue%2Fd%3Fid%3D${result.id}`
    case 'Group':
      return `https://${setupHost}/lightning/setup/PublicGroups/page?address=%2Fsetup%2Fown%2Fgroupdetail.jsp%3Fid%3D${result.id}`
    default:
      // Report, Dashboard and every unlisted type resolve to their record page
      return `${baseUrl}/lightning/r/${result.type}/${result.id}/view`
  }
}

function buildClassicUrl(result: SearchResult, baseUrl: string): string | null {
  if (isProfileSectionType(result.type)) {
    return `${baseUrl}${profileSectionQuery(result)}`
  }

  switch (result.type) {
    case 'ProfileSubMenu':
      return null // Tab-only navigation, no click action
    case 'Flow':
      return `${baseUrl}/builder_platform_interaction/flowBuilder.app?flowId=${result.id}`
    case 'CustomObject': {
      const keyPrefix = result.metadata?.KeyPrefix
      if (keyPrefix) {
        return `${baseUrl}/${keyPrefix}`
      }
      const objectDurableId = result.metadata?.DurableId
      if (objectDurableId && objectDurableId.startsWith('01I')) {
        return `${baseUrl}/${objectDurableId}`
      }
      const apiName = result.metadata?.QualifiedApiName
      return `${baseUrl}/p/setup/layout/LayoutFieldList?type=${apiName}&setupid=${apiName}Fields`
    }
    case 'CustomField':
      return `${baseUrl}/${customFieldId(result) || result.id}`
    case 'CustomMetadataType': {
      const classicRecordId = result.metadata?.Id || result.metadata?.DurableId || result.id
      return `${baseUrl}/${classicRecordId}`
    }
    case 'CustomSetting': {
      if (result.metadata?._isSettingDefinition) {
        const settingId = result.metadata?.DurableId || result.id
        return `${baseUrl}/setup/ui/viewCustomSettings.apexp?id=${settingId}`
      }
      return `${baseUrl}/${result.id}`
    }
    case 'Queue':
      return `${baseUrl}/p/own/Queue/d?id=${result.id}&setupid=Queues`
    case 'Group':
      return `${baseUrl}/setup/own/groupdetail.jsp?id=${result.id}&setupid=PublicGroups`
    default:
      // Classic addresses every other type by record id
      return `${baseUrl}/${result.id}`
  }
}

export function buildIdNavigationUrl(id: string, context: NavigationContext): string | null {
  if (!context.sfHost) {
    return null
  }
  return `https://${context.sfHost}/${id}`
}

export function buildActionUrl(
  result: SearchResult,
  action: ObjectAction,
  context: NavigationContext
): string | null {
  if (!context.sfHost) {
    return null
  }

  const baseUrl = `https://${context.sfHost}`

  // Handle preview action for ApexPage
  if (action === 'preview' && result.type === 'ApexPage') {
    const pageName = result.namespace ? `${result.namespace}__${result.name}` : result.name
    return `${baseUrl}/apex/${pageName}`
  }

  if (!result.metadata?.DurableId) {
    return null
  }

  const objectId = result.metadata.DurableId
  const objectApiName = result.metadata.QualifiedApiName
  // China (Alibaba) domains don't support Classic setup pages for layouts
  const useLightning = shouldUseLightning(context.navigationMode, context.userLightningPreference) || isChinaDomain(context.sfHost)

  if (useLightning) {
    return buildLightningActionUrl(action, baseUrl, objectId, objectApiName)
  }
  return buildClassicActionUrl(action, baseUrl, objectId, objectApiName, result.metadata)
}

function buildLightningActionUrl(
  action: ObjectAction,
  baseUrl: string,
  objectId: string,
  objectApiName: string
): string | null {
  switch (action) {
    case 'list':
      return `${baseUrl}/lightning/o/${objectApiName}/list`
    case 'fields':
      return `${baseUrl}/lightning/setup/ObjectManager/${objectId}/FieldsAndRelationships/view`
    case 'layouts':
      return `${baseUrl}/lightning/setup/ObjectManager/${objectId}/PageLayouts/view`
    case 'recordtypes':
      return `${baseUrl}/lightning/setup/ObjectManager/${objectId}/RecordTypes/view`
    case 'validationrules':
      return `${baseUrl}/lightning/setup/ObjectManager/${objectId}/ValidationRules/view`
    case 'details':
      return `${baseUrl}/lightning/setup/ObjectManager/${objectId}/Details/view`
    default:
      return null
  }
}

function buildClassicActionUrl(
  action: ObjectAction,
  baseUrl: string,
  objectId: string,
  objectApiName: string,
  metadata: Record<string, any>
): string | null {
  const isCustomObject = objectId && objectId.startsWith('01I')
  if (action === 'list') {
    const keyPrefix = metadata?.KeyPrefix
    return keyPrefix
      ? `${baseUrl}/${keyPrefix}`
      : `${baseUrl}/p/setup/layout/LayoutFieldList?type=${objectApiName}`
  }
  // Custom objects (DurableId starts with '01I') - use DurableId-based URL
  if (isCustomObject) {
    return `${baseUrl}/${objectId}`
  }
  switch (action) {
    case 'fields':
      return `${baseUrl}/p/setup/layout/LayoutFieldList?type=${objectApiName}&setupid=${objectApiName}Fields`
    case 'layouts':
      return `${baseUrl}/ui/setup/layout/PageLayouts?type=${objectApiName}&setupid=${objectApiName}Layouts`
    case 'recordtypes':
      return `${baseUrl}/setup/ui/recordtypeselect.jsp?type=${objectApiName}&setupid=${objectApiName}Records`
    case 'validationrules':
      return `${baseUrl}/p/setup/vr/listvr.jsp?type=${objectApiName}&setupid=${objectApiName}ValidationRules`
    case 'details':
      return `${baseUrl}/p/setup/layout/LayoutFieldList?type=${objectApiName}&setupid=${objectApiName}Fields`
    default:
      return null
  }
}
