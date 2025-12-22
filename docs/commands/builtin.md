# Built-in Commands

These commands are always available and cannot be overridden.

## :o - Objects & Fields

Search objects and fields.

```
:o Account        # Account object
:o Name           # Fields named "Name"
:o custom         # Custom objects
```

**Types:** CustomObject, CustomField

## :c - Code

Search all code-related metadata.

```
:c AccountHelper  # Apex classes
:c trigger        # Triggers
:c page           # VF pages
```

**Types:** ApexClass, ApexTrigger, ApexPage, ApexComponent, AuraDefinitionBundle, LightningComponentBundle

## :f - Flows

Search Flow metadata.

```
:f approval       # Approval flows
:f screen         # Screen flows
:f auto           # Auto-launched flows
```

**Types:** Flow

## :u - Users

Search users by name.

```
:u admin          # Admin users
:u john           # Users named John
:u @example       # By email
```

**Types:** User

## :p - Permissions

Search profiles and permission sets.

```
:p admin          # Admin profiles
:p sales          # Sales permission sets
:p custom         # Custom profiles
```

**Types:** Profile, PermissionSet, PermissionSetGroup, CustomPermission

## :l - Labels

Search custom labels.

```
:l error          # Error labels
:l button         # Button labels
:l message        # Message labels
```

**Types:** CustomLabel

## :m - Metadata

Search custom metadata and settings.

```
:m config         # Config metadata
:m setting        # Custom settings
```

**Types:** CustomMetadataType, CustomSetting

## :q - Queues

Search queues and public groups.

```
:q support        # Support queue
:q sales          # Sales group
```

**Types:** Queue, Group

## :g - Setup Navigation

Navigate to Setup pages.

```
:g setup          # Setup home
:g users          # Users page
:g apex           # Apex classes
```

See [Setup Navigation](/features/setup-navigation) for available pages.
