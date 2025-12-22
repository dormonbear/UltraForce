# Custom Commands

Create custom commands with SOQL queries to search any Salesforce data.

## Creating a Command

1. Open Settings
2. Go to "Custom Commands"
3. Click "Add Command"
4. Enter:
   - **Command** - Short key (e.g., `log`)
   - **Description** - What this command searches
   - **SOQL Query** - Query with `{query}` placeholder
   - **Name Field** - Field to display as result name
   - **Description Fields** - Additional fields to show (optional)
   - **Use Tooling API** - Enable for metadata queries

## Example Commands

### Search Debug Logs

```
Command: log
Description: Debug Logs
SOQL: SELECT Id, LogUser.Name, Operation, LogLength FROM ApexLog WHERE LogUser.Name LIKE '%{query}%' ORDER BY StartTime DESC LIMIT 50
Name Field: LogUser.Name
Description Fields: Operation, LogLength
Use Tooling API: Yes
```

Usage: `:log admin` searches logs by user name.

### Search Custom Object Records

```
Command: acc
Description: Accounts
SOQL: SELECT Id, Name, Industry, Website FROM Account WHERE Name LIKE '%{query}%' ORDER BY Name LIMIT 50
Name Field: Name
Description Fields: Industry, Website
Use Tooling API: No
```

Usage: `:acc acme` searches Account records.

### Search Email Templates

```
Command: tpl
Description: Email Templates
SOQL: SELECT Id, Name, Subject, FolderName FROM EmailTemplate WHERE Name LIKE '%{query}%' ORDER BY Name LIMIT 50
Name Field: Name
Description Fields: Subject, FolderName
Use Tooling API: No
```

Usage: `:tpl welcome` searches email templates.

## SOQL Query Requirements

- Must contain `{query}` placeholder for search term
- Use `LIKE '%{query}%'` for partial matching
- Include `LIMIT` to control result count
- Supports relationship fields (e.g., `Owner.Name`)

## Command Key Rules

- Must start with a letter
- Only letters and numbers allowed
- Maximum 10 characters
- Cannot duplicate built-in commands

## Import / Export

Commands can be exported to JSON and imported on other browsers or shared with team members.

## Built-in Commands

These cannot be overridden:

| Command | Description |
|---------|-------------|
| `:o` | Objects & Fields |
| `:c` | Apex, VF, LWC, Aura |
| `:f` | Flows |
| `:u` | Users |
| `:p` | Profiles & Permissions |
| `:l` | Custom Labels |
| `:m` | Custom Metadata |
| `:q` | Queues & Groups |
| `:g` | Setup Navigation |
