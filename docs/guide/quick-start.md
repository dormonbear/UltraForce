# Quick Start

## Open Search

Press `Cmd+B` (Mac) or `Ctrl+B` (Windows) on any Salesforce page to open UltraForce.

## Basic Search

Type any keyword to search across all metadata types:

```
AccountHelper     # Finds Apex classes, triggers, etc.
Contact           # Finds objects, fields, flows, etc.
```

## Use Commands

Prefix your search with `:` and a command letter to filter results:

```
:o Account        # Objects & Fields only
:c Helper         # Code only (Apex, VF, LWC)
:u admin          # Users only
:f approval       # Flows only
```

## Field Search

Use dot notation to search fields:

```
Account.          # All Account fields
Account.Name      # Account Name field
contact.email     # Case-insensitive
```

## Navigate Results

- `Up/Down` arrows - Navigate results
- `Enter` - Open selected item
- `Tab` - Autocomplete field name
- `Esc` - Close modal

## Setup Navigation

Use `:g` command to jump to Setup pages:

```
:g setup          # Go to Setup home
:g users          # Go to Users setup
:g profiles       # Go to Profiles setup
```
