# Profile Tab Completion & Sub-data Query Design

## Overview

Add two-level Tab completion for Profile search results, enabling users to drill into Profile sub-data (Users, Object Permissions, Field Permissions) via dot-notation.

## Interaction Flow

```
:p System Admin          -> Search Profile list (existing)
       | Tab
System Administrator.    -> Show sub-menu (Users / ObjectPermissions / FieldPermissions)
       | Select Users, Tab
System Administrator.Users.        -> Query users assigned to this Profile
System Administrator.Users.john    -> Filter users by name
       | Enter
       Navigate to user detail page /{userId}

       | Select ObjectPermissions, Tab
System Administrator.ObjectPermissions.          -> Query object permissions
System Administrator.ObjectPermissions.Account   -> Filter by object name
       | Enter
       Navigate to Profile setup page /{profileId}

       | Select FieldPermissions, Tab
System Administrator.FieldPermissions.           -> Query field permissions
System Administrator.FieldPermissions.Account    -> Filter by object/field
       | Enter
       Navigate to Profile setup page /{profileId}
```

## Dot-notation Parsing

Two-level dot notation: `ProfileName.SubCategory.FilterQuery`

| Input | Parsed | Behavior |
|-------|--------|----------|
| `System Administrator.` | profileName, subCategory=empty | Show sub-menu |
| `System Administrator.Users.` | profileName, subCategory=Users, filter=empty | Query user list |
| `System Administrator.Users.john` | profileName, subCategory=Users, filter=john | Filter users |

Detection: first segment matches a cached Profile Name.

## SOQL Queries

### PermissionSet Id (needed for ObjectPermissions/FieldPermissions)

```sql
SELECT Id FROM PermissionSet
WHERE ProfileId = '{profileId}' AND IsOwnedByProfile = true
LIMIT 1
```

### Users

```sql
SELECT Id, Name, Username, Email, IsActive
FROM User WHERE ProfileId = '{profileId}'
ORDER BY Name ASC LIMIT 200
```

API: REST API (Data API)

### Object Permissions

```sql
SELECT Id, SobjectType,
       PermissionsCreate, PermissionsRead, PermissionsEdit, PermissionsDelete,
       PermissionsViewAllRecords, PermissionsModifyAllRecords
FROM ObjectPermissions
WHERE ParentId = '{permissionSetId}'
ORDER BY SobjectType ASC
```

API: REST API

### Field Permissions

```sql
SELECT Id, SobjectType, Field, PermissionsRead, PermissionsEdit
FROM FieldPermissions
WHERE ParentId = '{permissionSetId}'
ORDER BY SobjectType, Field ASC
```

API: REST API

## Sub-menu Virtual Results

When input is `ProfileName.` (one-level dot), return 3 fixed virtual results:

- Users - "Users assigned to this profile"
- Object Permissions - "Object-level CRUD permissions"
- Field Permissions - "Field-level security settings"

Type: `ProfileSubMenu`

## Tab Completion Logic

| Source type | Tab completes to |
|-------------|-----------------|
| Profile | `ProfileName.` |
| ProfileSubMenu | `ProfileName.SubCategory.` |
| User (from Profile query) | `ProfileName.Users.Username` |
| ObjectPermissions result | `ProfileName.ObjectPermissions.SobjectType` |
| FieldPermissions result | `ProfileName.FieldPermissions.SobjectType.Field` |

## Enter Navigation

| Result type | Target |
|------------|--------|
| ProfileSubMenu | No navigation (Tab only) |
| User (from Profile query) | `/{userId}` |
| ObjectPermissions | `/{profileId}` |
| FieldPermissions | `/{profileId}` |

## File Changes

| File | Changes |
|------|---------|
| `src/lib/salesforce-api.ts` | New query functions, extend search for Profile dot-notation |
| `src/components/search/SearchModal.tsx` | Tab handler for Profile/ProfileSubMenu types |
| `src/lib/window-manager.ts` | Navigation for ProfileSubMenu (block Enter) |
| Type definitions | Add ProfileSubMenu to MetadataType |

## Caching

- PermissionSet Id: in-memory Map keyed by profileId, page lifecycle
- Sub-data query results: in-memory only, not persisted to chrome.storage
- Rationale: permission data changes frequently, query fresh each time

## Error Handling

- API failure: show "Failed to load profile data" in results area
- Profile name mismatch: fall back to normal search
- Insufficient permissions: hide unavailable sub-menu items
