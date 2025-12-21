# Record Navigation

Navigate to record detail pages using record IDs.

## Supported URL Patterns

UltraForce detects records from various Salesforce URL patterns:

### Lightning URLs

```
/lightning/r/Account/001xxx/view
/lightning/r/001xxx/view
```

### Classic URLs

```
/001xxx
```

### Flexible View URLs

```
/lightning/r/flexipage/...
```

## Object Detection

When viewing a record, UltraForce:

1. Extracts the record ID from the URL
2. Detects the object type (from URL or API call)
3. Displays the org type indicator

### ID Prefix Detection

Salesforce record IDs have 3-character prefixes that identify the object:

| Prefix | Object |
|--------|--------|
| 001 | Account |
| 003 | Contact |
| 006 | Opportunity |
| 005 | User |
| 00Q | Lead |
| 500 | Case |

## Org Type Indicator

The search modal shows your current environment:

| Indicator | Environment |
|-----------|-------------|
| PROD | Production org |
| SANDBOX | Sandbox org |
| DEV | Developer Edition |
| SCRATCH | Scratch org |

## Navigation Actions

From a record page, you can:

- Search related metadata
- Navigate to object definition
- Open related Setup pages

## Tips

- Record detection works in both Classic and Lightning
- Works with all Salesforce domains including Enhanced Domains
- Supports Salesforce on Alibaba domains
