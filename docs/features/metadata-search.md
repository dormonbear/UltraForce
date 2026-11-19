# Metadata Search

Search across all Salesforce metadata types from a single interface.

## How It Works

1. Press `Cmd+B` / `Ctrl+B` to open search
2. Type your search query
3. The search bar and panel join into one card, with a type badge beside each result / 搜索栏与面板合为一张卡片，每条结果旁都有类型徽标
4. Press `Enter` to navigate to the selected item

## Search Modes

### Global Search

Type any keyword to search all metadata:

```
AccountHelper       # Matches Apex class, trigger, etc.
Contact             # Matches object, flows, fields
```

### Filtered Search

Type a command and a space to set a scope, or choose one with `Tab` when the search text is empty. If a scoped search finds no matches, the message names the active scope and shows the search text.

输入命令并按空格可设定搜索范围，或在搜索文本为空时按 `Tab` 选择范围。范围内没有匹配结果时，提示会显示当前范围和搜索词。

```
:c AccountHelper    # Code only
:o Account          # Objects and fields / 对象和字段
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
