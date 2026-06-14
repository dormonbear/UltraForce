# Features Overview

UltraForce provides a comprehensive set of features for Salesforce metadata search and navigation.

## Core Features

### [Metadata Search](./metadata-search)

Search across all Salesforce metadata types with fuzzy matching and intelligent caching.

### [Field Search](./field-search)

Use dot notation to search object fields directly (e.g., `Account.Name`).

### [Record Navigation](./record-navigation)

Navigate to record detail pages and detect objects from record IDs.

### [Setup Navigation](./setup-navigation)

Jump directly to Setup pages using the `:g` command.

### Recent & Favorites

Open UltraForce with an empty query to see a home screen with your **Recent** items (ordered by most recently opened) and pinned **Favorites**. Both are isolated per Salesforce org.

### Accessibility

The search modal is an ARIA dialog with labelled controls and live-region announcements, visible keyboard focus rings, WCAG AA text contrast, and `prefers-reduced-motion` support.

## Search Capabilities

- **Fuzzy matching** - Find results even with typos
- **Prefix matching** - Match from the beginning of names
- **Case-insensitive** - Search without worrying about case
- **Multi-type search** - Search across all metadata simultaneously

## Performance

- **24-hour cache** - Metadata cached locally for instant searches
- **Background refresh** - Cache updates automatically after 2 hours
- **Incremental search** - Results update as you type
- **API efficiency** - Minimized API calls with smart caching

## Supported Metadata Types

| Category | Types |
|----------|-------|
| Objects | CustomObject, CustomField |
| Code | ApexClass, ApexTrigger, ApexPage, ApexComponent |
| Lightning | AuraDefinitionBundle, LightningComponentBundle |
| Automation | Flow, ValidationRule, WorkflowRule |
| Security | Profile, PermissionSet, PermissionSetGroup, CustomPermission |
| Configuration | CustomLabel, CustomMetadata, CustomSetting |
| Users | User, Queue, Group |
| Analytics | Report, Dashboard |
