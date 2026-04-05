# Profile Sub-Menu Expansion Design

## Context

Current Profile Tab completion supports 3 sub-categories: Users, ObjectPermissions, FieldPermissions. The Salesforce Profile setup page has many more sections that are queryable via API and useful for quick navigation.

## Proposed Sub-Menu Categories

### Tier 1: High value, Standard REST API (implement first)

| Category | API | SOQL | Result Format | Navigation URL (`s=` param) |
|----------|-----|------|---------------|----------------------------|
| Users | REST | `SELECT Id, Name, Username, Email, IsActive FROM User WHERE ProfileId = '{id}'` | Name \| Username \| Active/Inactive | N/A (navigate to User record) |
| Object Permissions | REST | `SELECT ... FROM ObjectPermissions WHERE ParentId = '{psId}'` | SobjectType \| C R E D V M flags | `ObjectsAndTabs&o={objectRef}` |
| Field Permissions | REST | `SELECT ... FROM FieldPermissions WHERE ParentId = '{psId}'` | SobjectType.Field \| Read Edit flags | `FieldPermissions&o={SobjectType}` |
| Custom Permissions | REST | `SetupEntityAccess WHERE SetupEntityType = 'CustomPermission'` + `CustomPermission` | DeveloperName \| Description | `CustomPermissions` |

### Tier 2: High value, requires SetupEntityAccess pattern

| Category | SetupEntityType | Detail Object | Navigation URL |
|----------|-----------------|---------------|----------------|
| Apex Class Access | `ApexClass` | `ApexClass` (Tooling) | `ApexClassAccess` |
| VF Page Access | `ApexPage` | `ApexPage` (Tooling) | `ApexPageAccess` |
| Connected Apps | `ConnectedApplication` | `ConnectedApplication` | `ConnectedAppSettings` |
| Assigned Apps | `TabSet` | `AppMenuItem` | `ObjectsAndTabs` |

### Tier 3: Lower priority / limited API support

| Category | Notes | Navigation URL |
|----------|-------|----------------|
| System Permissions | 100+ boolean fields on PermissionSet, requires Tooling API, complex display | `UserPermissions` |
| Login Hours | Metadata API only (not SOQL) | `LoginHours` |
| Login IP Ranges | Metadata API only (not SOQL) | `LoginIpRanges` |
| External Data Source | `SetupEntityType = 'ExternalDataSource'`, rare usage | `ExternalDataSourceAccess` |
| Named Credential | `SetupEntityType = 'NamedCredential'`, rare usage | `NamedCredentialAccess` |

## Implementation Design

### Sub-Menu Structure

```
Profile Tab -> "System Administrator."
  Users                    (already done)
  Object Permissions       (already done)
  Field Permissions        (already done)
  Apex Class Access        (new - Tier 2)
  VF Page Access           (new - Tier 2)
  Custom Permissions       (new - Tier 1)
  Connected Apps           (new - Tier 2)
  Assigned Apps            (new - Tier 2)
  System Permissions       (new - Tier 3, navigate-only)
  Login Hours              (new - Tier 3, navigate-only)
  Login IP Ranges          (new - Tier 3, navigate-only)
```

### Query Pattern: SetupEntityAccess

Tier 2 categories share a common query pattern:

```sql
-- Step 1: Get entity IDs from SetupEntityAccess
SELECT SetupEntityId FROM SetupEntityAccess
WHERE ParentId = '{permissionSetId}' AND SetupEntityType = '{type}'

-- Step 2: Get entity details (may need Tooling API)
SELECT Id, Name FROM ApexClass WHERE Id IN ({entityIds})
```

New function in `profile-search.ts`:

```typescript
async function querySetupEntityAccess(
  permissionSetId: string,
  entityType: string,        // 'ApexClass', 'ApexPage', etc.
  detailObject: string,      // 'ApexClass', 'ApexPage', etc.
  detailFields: string,      // 'Id, Name' etc.
  useToolingApi: boolean,
  sfHost: string,
  sessionId: string
): Promise<SearchResult[]>
```

### Navigate-Only Categories (Tier 3)

Some categories (System Permissions, Login Hours, Login IP Ranges) have no easy SOQL query but are still useful as quick navigation shortcuts. These appear in the sub-menu but Tab on them navigates directly to the Profile setup page section instead of querying sub-data.

Result type: `ProfileSetupLink` (new)
- Tab: navigates to `/{profileId}?s={section}` in Classic or equivalent Lightning URL
- Enter: same behavior

### Navigation URL Construction

Lightning:
```
https://{setup-host}/lightning/setup/Profiles/page?address={encodeURIComponent('/{profileId}?s={section}')}
```

Classic:
```
https://{host}/{profileId}?s={section}
```

For sections with `&o=` parameter (ObjectPermissions, FieldPermissions):
- Standard objects: use API name
- Custom objects: use DurableId (01Ixx)

### Result Types Summary

| Type | Tab Behavior | Enter Behavior |
|------|-------------|----------------|
| Profile | `ProfileName.` (show sub-menu) | Navigate to Profile page |
| ProfileSubMenu | `ProfileName.SubCategory.` (query sub-data) | No action |
| User (from profile) | Filter by name | Navigate to User record |
| ObjectPermission | Filter by name | Navigate to object permission section |
| FieldPermission | Filter by name | Navigate to field permission section |
| ApexClassAccess | Filter by name | Navigate to Apex class access section |
| VFPageAccess | Filter by name | Navigate to VF page access section |
| CustomPermissionAccess | Filter by name | Navigate to custom permissions section |
| ProfileSetupLink | Navigate to section | Navigate to section |

## Implementation Order

1. **Phase 1** (current): Users, ObjectPermissions, FieldPermissions - DONE
2. **Phase 2**: Custom Permissions (REST API, simple)
3. **Phase 3**: Apex Class Access, VF Page Access (SetupEntityAccess pattern)
4. **Phase 4**: Connected Apps, Assigned Apps
5. **Phase 5**: Navigate-only links (System Permissions, Login Hours, Login IP Ranges)
