# Commands Overview

UltraForce uses a command system to filter and control searches.

## Command Syntax

Commands start with `:` followed by a key and optional query:

```
:[command] [query]
```

## Built-in Commands

| Command | Description | Types |
|---------|-------------|-------|
| `:o` | Objects & Fields | CustomObject, CustomField |
| `:c` | Code | ApexClass, ApexTrigger, ApexPage, ApexComponent, Aura, LWC |
| `:f` | Flows | Flow |
| `:u` | Users | User |
| `:p` | Permissions | Profile, PermissionSet, PermissionSetGroup, CustomPermission |
| `:l` | Labels | CustomLabel |
| `:m` | Metadata | CustomMetadata, CustomSetting |
| `:q` | Queues | Queue, Group |
| `:r` | Reports & Dashboards | Report, Dashboard |
| `:g` | Setup | Navigate to Setup pages |

## Usage Examples

```
:o Account        # Search Account object
:c Helper         # Search classes with "Helper"
:u john           # Search users named "john"
:f approval       # Search approval flows
:g users          # Go to Users setup
```

## Custom Commands

Create your own commands in Settings to filter by specific metadata types.

See [Custom Commands](./custom) for details.

## Command Hints

When you type `:`, UltraForce shows available commands. Continue typing to filter.

```
:           # Shows all commands
:c          # Shows :c command details
:co         # Filters to commands starting with "co"
```
