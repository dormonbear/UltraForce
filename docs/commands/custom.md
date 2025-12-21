# Custom Commands

Create custom commands with SOQL queries to search any Salesforce data.

## Creating Commands

1. Open UltraForce with `Cmd+B` / `Ctrl+B`
2. Click the settings icon
3. Navigate to "Custom Commands"
4. Click "Add Command"

## Command Properties

| Property | Description | Required |
|----------|-------------|----------|
| Command | Short key to trigger | Yes |
| Description | What this command does | Yes |
| SOQL Query | Query with `{query}` placeholder | Yes |
| Name Field | Field to display as name | Yes |
| Description Fields | Additional fields to show | No |
| Use Tooling API | Enable for metadata objects | No |

## SOQL Query Format

The query must include `{query}` as placeholder:

```sql
SELECT Id, Name, Field1, Field2
FROM ObjectName
WHERE Name LIKE '%{query}%'
ORDER BY Name
LIMIT 50
```

## Examples

### Debug Logs

```
Command: log
Description: Debug Logs
SOQL: SELECT Id, LogUser.Name, Operation, LogLength FROM ApexLog WHERE LogUser.Name LIKE '%{query}%' ORDER BY StartTime DESC LIMIT 50
Name Field: LogUser.Name
Description Fields: Operation, LogLength
Use Tooling API: Yes
```

### Accounts

```
Command: acc
Description: Accounts
SOQL: SELECT Id, Name, Industry, Website FROM Account WHERE Name LIKE '%{query}%' ORDER BY Name LIMIT 50
Name Field: Name
Description Fields: Industry, Website
Use Tooling API: No
```

### Contacts

```
Command: con
Description: Contacts
SOQL: SELECT Id, Name, Email, Account.Name FROM Contact WHERE Name LIKE '%{query}%' ORDER BY Name LIMIT 50
Name Field: Name
Description Fields: Email, Account.Name
Use Tooling API: No
```

### Cases

```
Command: case
Description: Cases
SOQL: SELECT Id, CaseNumber, Subject, Status FROM Case WHERE Subject LIKE '%{query}%' ORDER BY CreatedDate DESC LIMIT 50
Name Field: CaseNumber
Description Fields: Subject, Status
Use Tooling API: No
```

### Async Jobs

```
Command: job
Description: Async Apex Jobs
SOQL: SELECT Id, ApexClass.Name, Status, CreatedDate FROM AsyncApexJob WHERE ApexClass.Name LIKE '%{query}%' ORDER BY CreatedDate DESC LIMIT 50
Name Field: ApexClass.Name
Description Fields: Status
Use Tooling API: Yes
```

## REST API vs Tooling API

| API | Use For |
|-----|---------|
| REST API | Standard/Custom objects (Account, Contact, etc.) |
| Tooling API | Metadata objects (ApexLog, ApexClass, etc.) |

## Import / Export

### Export

1. Click "Export" button
2. JSON file downloads with all custom commands

### Import

1. Click "Import" button
2. Select JSON file
3. Commands merge with existing ones

## Tips

- Use relationship fields for richer results (e.g., `Owner.Name`)
- Add `ORDER BY` for consistent result ordering
- Use `LIMIT` to control performance
- Test queries in Developer Console first
