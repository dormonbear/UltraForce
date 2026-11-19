# Built-in Commands

These commands are always available and cannot be overridden.

Type a command followed by a space to apply it as a scope chip, then enter your search text. You can also pick a command by pressing `Tab` when the search text is empty. See [Scope Picker and Chips](./index#scope-picker-and-chips).

输入命令并按空格可将其应用为范围标签，然后输入搜索词。搜索文本为空时，也可按 `Tab` 选择命令。详见[范围选择器和范围标签](./index#scope-picker-and-chips)。

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

## :r - Reports & Dashboards

Search reports and dashboards by name and folder.

```
:r pipeline       # Pipeline report
:r sales          # Sales dashboard
```

**Types:** Report, Dashboard

## :g - Setup Navigation

Navigate to Setup pages.

```
:g setup          # Setup home
:g users          # Users page
:g apex           # Apex classes
```

See [Setup Navigation](/features/setup-navigation) for available pages.
