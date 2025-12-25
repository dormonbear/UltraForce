# Metadata Search

Search across all Salesforce metadata types from a single interface.

## How It Works

1. Press `Cmd+B` / `Ctrl+B` to open search
2. Type your search query
3. Results appear instantly from cached metadata
4. Press `Enter` to navigate to the selected item

## Search Modes

### Global Search

Type any keyword to search all metadata:

```
AccountHelper       # Matches Apex class, trigger, etc.
Contact             # Matches object, flows, fields
```

### Filtered Search

Use commands to filter by type:

```
:c AccountHelper    # Code only
:o Account          # Objects only
:f approval         # Flows only
```

## Fuzzy Matching

UltraForce uses MiniSearch for intelligent fuzzy matching:

```
acnt      ->  Account
hlper     ->  Helper
usr       ->  User
```

Disable fuzzy matching in Settings if you prefer exact matches.

## Result Ranking

Results are ranked by:

1. **Exact match** - Highest priority
2. **Prefix match** - Matches starting with query
3. **BM25 score** - Text relevance scoring
4. **Levenshtein distance** - For fuzzy matches

## Caching

Metadata is cached locally for performance:

| Setting | Value |
|---------|-------|
| Cache duration | 24 hours |
| Background refresh | After 2 hours |
| Storage | Chrome local storage |

Clear cache manually in Settings if needed.

## Supported Types

### Objects & Fields
- CustomObject
- CustomField

### Code
- ApexClass
- ApexTrigger
- ApexPage (Visualforce)
- ApexComponent

### Lightning
- AuraDefinitionBundle
- LightningComponentBundle

### Automation
- Flow
- ValidationRule
- WorkflowRule

### Security
- Profile
- PermissionSet
- PermissionSetGroup
- CustomPermission

### Configuration
- CustomLabel
- CustomMetadata
- CustomSetting
- Queue
- Group
