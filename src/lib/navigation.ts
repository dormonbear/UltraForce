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

function buildLightningUrl(result: SearchResult, baseUrl: string, setupHost: string | null): string | null {
  switch (result.type) {
    case 'ApexClass':
      return `${baseUrl}/lightning/setup/ApexClasses/page?address=%2F${result.id}`
    case 'ApexTrigger':
      return `${baseUrl}/lightning/setup/ApexTriggers/page?address=%2F${result.id}`
    case 'ApexPage':
      return `${baseUrl}/lightning/setup/ApexPages/page?address=%2F${result.id}`
    case 'ApexComponent':
      return `${baseUrl}/lightning/setup/ApexComponents/page?address=%2F${result.id}`
    case 'LightningComponentBundle':
      return `${baseUrl}/lightning/setup/LightningComponentBundles/page?address=%2F${result.id}`
    case 'AuraDefinitionBundle':
      return `${baseUrl}/lightning/setup/AuraBundles/page?address=%2F${result.id}`
    case 'Flow':
      return `${baseUrl}/builder_platform_interaction/flowBuilder.app?flowId=${result.id}`
    case 'User':
      return `https://${setupHost}/lightning/setup/ManageUsers/page?address=%2F${result.id}%3Fnoredirect%3D1%26isUserEntityOverride%3D1`
    case 'CustomObject':
      return `${baseUrl}/lightning/o/${result.metadata?.QualifiedApiName}/list`
    case 'CustomField': {
      const objectName = result.metadata?.ObjectApiName || result.metadata?.EntityDefinition?.QualifiedApiName
      const durableId = result.metadata?.DurableId || ''
      const fieldId = durableId.includes('.') ? durableId.split('.')[1] : durableId
      if (objectName && fieldId) {
        return `https://${setupHost}/lightning/setup/ObjectManager/${objectName}/FieldsAndRelationships/${fieldId}/view`
      }
      return `${baseUrl}/lightning/r/${result.type}/${result.id}/view`
    }
    case 'PermissionSet':
      return `${baseUrl}/lightning/setup/PermSets/page?address=%2F${result.id}`
    case 'Profile':
      return `${baseUrl}/lightning/setup/EnhancedProfiles/page?address=%2F${result.id}`
    case 'ProfileSubMenu':
      return null // Tab-only navigation, no click action
    case 'ObjectPermission': {
      const objProfileId = result.metadata?.profileId
      const objectRef = result.metadata?.objectRef || result.name
      const objAddr = encodeURIComponent(`/${objProfileId}?s=ObjectsAndTabs&o=${objectRef}`)
      return `https://${setupHost}/lightning/setup/Profiles/page?address=${objAddr}`
    }
    case 'FieldPermission': {
      const fieldProfileId = result.metadata?.profileId
      const fieldSobjectType = result.metadata?.SobjectType
      const fieldAddr = encodeURIComponent(`/${fieldProfileId}?s=FieldPermissions&o=${fieldSobjectType}`)
      return `https://${setupHost}/lightning/setup/Profiles/page?address=${fieldAddr}`
    }
    case 'CustomPermissionAccess': {
      const cpProfileId = result.metadata?.profileId
      const cpAddr = encodeURIComponent(`/${cpProfileId}?s=CustomPermissions`)
      return `https://${setupHost}/lightning/setup/Profiles/page?address=${cpAddr}`
    }
    case 'ApexClassAccess': {
      const acProfileId = result.metadata?.profileId
      const acAddr = encodeURIComponent(`/${acProfileId}?s=ApexClassAccess`)
      return `https://${setupHost}/lightning/setup/Profiles/page?address=${acAddr}`
    }
    case 'VFPageAccess': {
      const vfProfileId = result.metadata?.profileId
      const vfAddr = encodeURIComponent(`/${vfProfileId}?s=ApexPageAccess`)
      return `https://${setupHost}/lightning/setup/Profiles/page?address=${vfAddr}`
    }
    case 'ConnectedAppAccess': {
      const caProfileId = result.metadata?.profileId
      const caAddr = encodeURIComponent(`/${caProfileId}?s=ConnectedAppSettings`)
      return `https://${setupHost}/lightning/setup/Profiles/page?address=${caAddr}`
    }
    case 'AssignedAppAccess': {
      const aaProfileId = result.metadata?.profileId
      const aaAddr = encodeURIComponent(`/${aaProfileId}?s=ObjectsAndTabs`)
      return `https://${setupHost}/lightning/setup/Profiles/page?address=${aaAddr}`
    }
    case 'ProfileSetupLink': {
      const pslProfileId = result.metadata?.profileId
      const pslSection = result.metadata?.section
      const pslAddr = encodeURIComponent(`/${pslProfileId}?s=${pslSection}`)
      return `https://${setupHost}/lightning/setup/Profiles/page?address=${pslAddr}`
    }
    case 'CustomLabel':
      return `${baseUrl}/lightning/setup/ExternalStrings/page?address=%2F${result.id}`
    case 'CustomMetadataType': {
      const recordId = result.metadata?.Id || result.metadata?.DurableId || result.id
      if (result.metadata?._isTypeDefinition) {
        return `https://${setupHost}/lightning/setup/CustomMetadata/page?address=%2F${recordId}`
      }
      return `https://${setupHost}/lightning/setup/CustomMetadata/page?address=%2F${recordId}`
    }
    case 'CustomSetting': {
      const settingId = result.metadata?.DurableId || result.id
      if (result.metadata?._isSettingDefinition) {
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
    case 'Report':
      return `${baseUrl}/lightning/r/Report/${result.id}/view`
    case 'Dashboard':
      return `${baseUrl}/lightning/r/Dashboard/${result.id}/view`
    default:
      return `${baseUrl}/lightning/r/${result.type}/${result.id}/view`
  }
}

function buildClassicUrl(result: SearchResult, baseUrl: string): string | null {
  switch (result.type) {
    case 'ApexClass':
    case 'ApexTrigger':
    case 'ApexPage':
    case 'ApexComponent':
    case 'LightningComponentBundle':
    case 'AuraDefinitionBundle':
    case 'User':
    case 'PermissionSet':
    case 'Profile':
      return `${baseUrl}/${result.id}`
    case 'ProfileSubMenu':
      return null // Tab-only navigation, no click action
    case 'ObjectPermission': {
      const classicObjRef = result.metadata?.objectRef || result.name
      return `${baseUrl}/${result.metadata?.profileId}?s=ObjectsAndTabs&o=${classicObjRef}`
    }
    case 'FieldPermission':
      return `${baseUrl}/${result.metadata?.profileId}?s=FieldPermissions&o=${result.metadata?.SobjectType}`
    case 'CustomPermissionAccess':
      return `${baseUrl}/${result.metadata?.profileId}?s=CustomPermissions`
    case 'ApexClassAccess':
      return `${baseUrl}/${result.metadata?.profileId}?s=ApexClassAccess`
    case 'VFPageAccess':
      return `${baseUrl}/${result.metadata?.profileId}?s=ApexPageAccess`
    case 'ConnectedAppAccess':
      return `${baseUrl}/${result.metadata?.profileId}?s=ConnectedAppSettings`
    case 'AssignedAppAccess':
      return `${baseUrl}/${result.metadata?.profileId}?s=ObjectsAndTabs`
    case 'ProfileSetupLink':
      return `${baseUrl}/${result.metadata?.profileId}?s=${result.metadata?.section}`
    case 'Flow':
      return `${baseUrl}/builder_platform_interaction/flowBuilder.app?flowId=${result.id}`
    case 'CustomObject': {
      const objectDurableId = result.metadata?.DurableId
      if (objectDurableId && objectDurableId.startsWith('01I')) {
        return `${baseUrl}/${objectDurableId}`
      }
      const keyPrefix = result.metadata?.KeyPrefix
      if (keyPrefix) {
        return `${baseUrl}/${keyPrefix}`
      }
      const apiName = result.metadata?.QualifiedApiName
      return `${baseUrl}/p/setup/layout/LayoutFieldList?type=${apiName}&setupid=${apiName}Fields`
    }
    case 'CustomField': {
      const durableId = result.metadata?.DurableId || ''
      const fieldId = durableId.includes('.') ? durableId.split('.')[1] : durableId
      if (fieldId) {
        return `${baseUrl}/${fieldId}`
      }
      return `${baseUrl}/${result.id}`
    }
    case 'CustomLabel':
      return `${baseUrl}/${result.id}`
    case 'CustomMetadataType': {
      const classicRecordId = result.metadata?.Id || result.metadata?.DurableId || result.id
      return `${baseUrl}/${classicRecordId}`
    }
    case 'CustomSetting': {
      const settingId = result.metadata?.DurableId || result.id
      if (result.metadata?._isSettingDefinition) {
        return `${baseUrl}/setup/ui/viewCustomSettings.apexp?id=${settingId}`
      }
      return `${baseUrl}/${result.id}`
    }
    case 'CustomQuery':
      return `${baseUrl}/${result.id}`
    case 'Queue':
      return `${baseUrl}/p/own/Queue/d?id=${result.id}&setupid=Queues`
    case 'Group':
      return `${baseUrl}/setup/own/groupdetail.jsp?id=${result.id}&setupid=PublicGroups`
    case 'Report':
    case 'Dashboard':
      return `${baseUrl}/${result.id}`
    default:
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
