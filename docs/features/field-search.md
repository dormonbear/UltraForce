# Field Search

Search object fields using dot notation for quick field navigation.

## Syntax

```
ObjectName.FieldName
```

## Examples

### List All Fields

Type object name followed by a dot:

```
Account.          # Shows all Account fields
Contact.          # Shows all Contact fields
opportunity.      # Case-insensitive
```

### Search Specific Field

Include the field name to filter:

```
Account.Name      # Account Name field
Account.phone     # Account Phone field
Contact.email     # Contact Email field
```

### Partial Match

Field search supports partial matching:

```
Account.bill      # BillingStreet, BillingCity, etc.
Contact.mail      # MailingStreet, MailingCity, Email
```

## Autocomplete

With search text entered, press `Tab` to autocomplete the selected field into the search input. With the search text empty, `Tab` opens the scope picker.

输入搜索文本后，按 `Tab` 可将选中的字段自动补全到搜索框，方便构建查询或复制字段 API 名称。搜索文本为空时，按 `Tab` 会打开范围选择器。

## Navigation

Press `Enter` on a field result to navigate to:

- **Classic mode** - Object field definition page
- **Lightning mode** - Object Manager field page

## Field Information

Each field result displays:

- Field API name
- Field label
- Field type
- Parent object name

## Custom Objects

Field search works with custom objects:

```
MyObject__c.      # Custom object fields
MyObject__c.Name  # Custom object Name field
```

## Tips

- Field search is case-insensitive
- Works with both standard and custom fields
- Custom field names include `__c` suffix
- Results are sorted by relevance
