const TYPE_ICONS: Record<string, string> = {
  ApexClass: '</>',
  ApexTrigger: '</>',
  CustomObject: 'O',
  CustomField: 'F',
  Flow: 'FL',
  User: 'U',
  PermissionSet: 'PS',
  Profile: 'PR',
  LightningComponentBundle: 'LW',
  AuraDefinitionBundle: 'AU',
  ApexPage: 'VF',
  ApexComponent: 'VC',
  CustomLabel: 'CL',
  Record: 'R',
  SetupShortcut: 'S',
  CustomMetadataType: 'CM',
  CustomSetting: 'CS'
}

export default function TypeBadge({ type }: { type: string }) {
  return (
    <span className="home-item-badge" data-type={type} aria-hidden="true">
      {TYPE_ICONS[type] || type.charAt(0).toUpperCase()}
    </span>
  )
}
