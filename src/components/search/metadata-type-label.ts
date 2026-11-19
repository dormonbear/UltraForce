import { t } from '~lib/i18n'

const TYPE_LABELS: Record<string, string> = {
  ApexClass: 'Apex Classes',
  ApexTrigger: 'Apex Triggers',
  ApexPage: 'Visualforce Pages',
  ApexComponent: 'Visualforce Components',
  LightningComponentBundle: 'Lightning Web Components',
  AuraDefinitionBundle: 'Aura Components',
  CustomObject: 'Objects',
  CustomField: 'Fields',
  Flow: 'Flows',
  User: 'Users',
  PermissionSet: 'Permission Sets',
  Profile: 'Profiles',
  CustomLabel: 'Custom Labels',
  CustomMetadataType: 'Custom Metadata Types',
  CustomSetting: 'Custom Settings',
  PermissionSetGroup: 'Permission Set Groups',
  CustomPermission: 'Custom Permissions',
  Queue: 'Queues',
  Group: 'Public Groups',
  Report: 'Reports',
  Dashboard: 'Dashboards'
}

export function getMetadataTypeLabel(type: string): string {
  return t(TYPE_LABELS[type] ?? type)
}
