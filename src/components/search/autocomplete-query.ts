import { getCommandPrefix, type ParsedCommand } from '~lib/command-parser'
import type { SearchResult } from '~types'

export function getAutocompleteQuery(selectedResult: SearchResult, parsedCommand: ParsedCommand): string | undefined {
  const prefix = getCommandPrefix(parsedCommand)
  if (selectedResult.type === 'CustomObject') {
    const objectApiName = selectedResult.metadata?.QualifiedApiName || selectedResult.name
    return `${prefix}${objectApiName}.`
  } else if (selectedResult.type === 'CustomField') {
    const objectApiName =
      selectedResult.metadata?.ObjectApiName || selectedResult.metadata?.EntityDefinition?.QualifiedApiName
    const fieldApiName = selectedResult.metadata?.QualifiedApiName || selectedResult.name
    if (objectApiName) {
      return `${prefix}${objectApiName}.${fieldApiName}`
    }
  } else if (selectedResult.type === 'CustomMetadataType') {
    if (selectedResult.metadata?._isTypeDefinition) {
      const cmdtApiName = selectedResult.metadata?.QualifiedApiName || selectedResult.name
      return `${prefix}${cmdtApiName}.`
    } else {
      const parentType = selectedResult.metadata?._parentType
      const recordName = selectedResult.metadata?.DeveloperName || selectedResult.name
      if (parentType) {
        return `${prefix}${parentType}.${recordName}`
      }
    }
  } else if (selectedResult.type === 'CustomSetting') {
    if (selectedResult.metadata?._isSettingDefinition) {
      const settingApiName = selectedResult.metadata?.QualifiedApiName || selectedResult.name
      return `${prefix}${settingApiName}.`
    } else {
      const parentType = selectedResult.metadata?._parentType
      const recordName = selectedResult.metadata?.Name || selectedResult.name
      if (parentType) {
        return `${prefix}${parentType}.${recordName}`
      }
    }
  } else if (selectedResult.type === 'Profile') {
    const profileName = selectedResult.name
    return `${prefix}${profileName}.`
  } else if (selectedResult.type === 'ProfileSubMenu') {
    const { profileName, subCategory } = selectedResult.metadata || {}
    if (profileName && subCategory) {
      return `${prefix}${profileName}.${subCategory}.`
    }
  } else if (
    selectedResult.type === 'ObjectPermission' ||
    selectedResult.type === 'FieldPermission' ||
    selectedResult.type === 'CustomPermissionAccess' ||
    selectedResult.type === 'ApexClassAccess' ||
    selectedResult.type === 'VFPageAccess' ||
    selectedResult.type === 'ConnectedAppAccess' ||
    selectedResult.type === 'AssignedAppAccess'
  ) {
    const { profileName, _subCategory } = selectedResult.metadata || {}
    if (profileName && _subCategory) {
      return `${prefix}${profileName}.${_subCategory}.${selectedResult.name}`
    }
  }
}
