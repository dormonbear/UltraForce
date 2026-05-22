// Salesforce metadata type definitions and SOQL query configurations
// Extracted from salesforce-api.ts for independent testability

export interface SearchOptions {
  useFuzzy?: boolean
  hideManagedPackage?: boolean
}

// Salesforce record interfaces based on actual SOQL query shapes

export interface SfApexRecord {
  Id: string
  Name: string
  NamespacePrefix: string | null
  LastModifiedDate: string
  LastModifiedBy: { Name: string }
}

export interface SfBundleRecord {
  Id: string
  DeveloperName: string
  NamespacePrefix: string | null
  MasterLabel: string
  LastModifiedDate: string
  LastModifiedBy: { Name: string }
}

export interface SfEntityDefinition {
  QualifiedApiName: string
  Label: string
  DurableId: string
  KeyPrefix: string | null
  IsCustomSetting?: boolean
}

export interface SfFieldDefinition {
  DurableId: string
  QualifiedApiName: string
  Label: string
  DataType: string
  EntityDefinition: { QualifiedApiName: string }
  NamespacePrefix: string | null
}

export interface SfFlow {
  Id: string
  MasterLabel: string
  VersionNumber: number
  Status: string
}

export interface SfUser {
  Id: string
  Name: string
  Username: string
  Email: string
  FederationIdentifier: string | null
  IsActive: boolean
  Profile: { Name: string }
  UserRole: { Name: string } | null
}

export interface SfPermissionSet {
  Id: string
  Name: string
  Label: string
  NamespacePrefix: string | null
}

export interface SfProfile {
  Id: string
  Name: string
}

export interface SfCustomLabel {
  Id: string
  Name: string
  MasterLabel: string
  Value: string
  NamespacePrefix: string | null
}

export interface SfCustomMetadataType {
  DurableId: string
  QualifiedApiName: string
  Label: string
  NamespacePrefix: string | null
}

export interface SfCustomSetting {
  DurableId: string
  QualifiedApiName: string
  DeveloperName: string
  Label: string
  NamespacePrefix: string | null
}

export interface SfQueue {
  Id: string
  Name: string
  DeveloperName: string
  Email: string
}

export interface SfGroup {
  Id: string
  Name: string
  DeveloperName: string
}

export interface SfReport {
  Id: string
  Name: string
  DeveloperName: string
  NamespacePrefix: string | null
  FolderName: string
  Description: string
  LastModifiedDate: string
  LastModifiedBy: { Name: string }
}

export interface SfDashboard {
  Id: string
  Title: string
  DeveloperName: string
  NamespacePrefix: string | null
  FolderName: string
  Description: string
  LastModifiedDate: string
  LastModifiedBy: { Name: string }
}

export const METADATA_TYPES: Record<string, { query: string }> = {
  ApexClass: {
    query: `SELECT Id, Name, NamespacePrefix, LastModifiedDate, LastModifiedBy.Name FROM ApexClass ORDER BY Name ASC LIMIT 50000`
  },
  ApexTrigger: {
    query: `SELECT Id, Name, NamespacePrefix, LastModifiedDate, LastModifiedBy.Name FROM ApexTrigger ORDER BY Name ASC LIMIT 10000`
  },
  ApexPage: {
    query: `SELECT Id, Name, NamespacePrefix, LastModifiedDate, LastModifiedBy.Name FROM ApexPage ORDER BY Name ASC LIMIT 10000`
  },
  ApexComponent: {
    query: `SELECT Id, Name, NamespacePrefix, LastModifiedDate, LastModifiedBy.Name FROM ApexComponent ORDER BY Name ASC LIMIT 10000`
  },
  LightningComponentBundle: {
    query: `SELECT Id, DeveloperName, NamespacePrefix, MasterLabel, LastModifiedDate, LastModifiedBy.Name FROM LightningComponentBundle ORDER BY DeveloperName ASC LIMIT 10000`
  },
  AuraDefinitionBundle: {
    query: `SELECT Id, DeveloperName, NamespacePrefix, MasterLabel, LastModifiedDate, LastModifiedBy.Name FROM AuraDefinitionBundle ORDER BY DeveloperName ASC LIMIT 10000`
  },
  CustomObject: {
    query: `SELECT QualifiedApiName, Label, DurableId, KeyPrefix, IsCustomSetting FROM EntityDefinition WHERE IsCustomizable = true AND IsCustomSetting = false AND (NOT QualifiedApiName LIKE '%__mdt') ORDER BY QualifiedApiName ASC LIMIT 10000`
  },
  Flow: {
    query: `SELECT Id, MasterLabel, VersionNumber, Status FROM Flow ORDER BY MasterLabel ASC LIMIT 10000`
  },
  User: {
    query: `SELECT Id, Name, Username, Email, FederationIdentifier, IsActive, Profile.Name, UserRole.Name FROM User ORDER BY Name ASC LIMIT 5000`
  },
  PermissionSet: {
    query: `SELECT Id, Name, Label, NamespacePrefix FROM PermissionSet ORDER BY Label ASC LIMIT 2000`
  },
  Profile: {
    query: `SELECT Id, Name FROM Profile ORDER BY Name ASC LIMIT 1000`
  },
  CustomLabel: {
    query: `SELECT Id, Name, MasterLabel, Value, NamespacePrefix FROM ExternalString ORDER BY Name ASC`
  },
  CustomMetadataType: {
    query: `SELECT DurableId, QualifiedApiName, Label, NamespacePrefix FROM EntityDefinition WHERE QualifiedApiName LIKE '%__mdt' ORDER BY QualifiedApiName ASC LIMIT 500`
  },
  CustomSetting: {
    query: `SELECT DurableId, QualifiedApiName, DeveloperName, Label, NamespacePrefix FROM EntityDefinition WHERE IsCustomSetting = true ORDER BY QualifiedApiName ASC LIMIT 2000`
  },
  Queue: {
    query: `SELECT Id, Name, DeveloperName, Email FROM Group WHERE Type = 'Queue' ORDER BY Name ASC LIMIT 2000`
  },
  Group: {
    query: `SELECT Id, Name, DeveloperName FROM Group WHERE Type = 'Regular' ORDER BY Name ASC LIMIT 2000`
  },
  Report: {
    query: `SELECT Id, Name, DeveloperName, NamespacePrefix, FolderName, Description, LastModifiedDate, LastModifiedBy.Name FROM Report ORDER BY Name ASC LIMIT 100`
  },
  Dashboard: {
    query: `SELECT Id, Title, DeveloperName, NamespacePrefix, FolderName, Description, LastModifiedDate, LastModifiedBy.Name FROM Dashboard ORDER BY Title ASC LIMIT 100`
  }
}
