# UltraForce for Salesforce

A Chrome extension for lightning-fast Salesforce metadata search.

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/maemkmihjmlfilhpfeeindecjnagelkh)](https://chromewebstore.google.com/detail/ultraforce-for-salesforce/maemkmihjmlfilhpfeeindecjnagelkh)

## Install

[Get it on Chrome Web Store](https://chromewebstore.google.com/detail/ultraforce-for-salesforce/maemkmihjmlfilhpfeeindecjnagelkh?authuser=0&hl=en)

## Usage

1. Log in to any Salesforce org in your browser
2. Press `Cmd+B` (Mac) or `Ctrl+B` (Windows) to open UltraForce
3. Start typing to search

## Search Types

- **Apex Classes** - Search by class name
- **Apex Triggers** - Search by trigger name
- **Custom Objects** - Search by object API name or label
- **Fields** - Use dot-notation: `Account.Name` or `Account.`
- **Flows** - Search by flow name
- **Users** - Search by name, username, email, or federation ID
- **Permission Sets** - Search by permission set name
- **Profiles** - Search by profile name
- **Custom Labels** - Search by label name or value content
- **Custom Metadata Types** - Search types, use dot-notation for records: `My_Setting__mdt.`
- **Custom Settings** - Search settings, use dot-notation for records: `My_Setting__c.`

## Commands

Type `:` to see available commands for quick filtering:

| Command | Description | Example |
|---------|-------------|---------|
| `:o` | Objects & Fields | `:o account` |
| `:c` | Apex (Classes + Triggers) | `:c mycontroller` |
| `:w` | Flows | `:w approval` |
| `:u` | Users | `:u john` |
| `:p` | Permission Sets | `:p admin` |
| `:r` | Profiles | `:r system` |
| `:l` | Custom Labels | `:l error_message` |
| `:s` | Custom Settings | `:s my_setting` |
| `:g` | Setup Shortcuts | `:g deploy` |

## Direct Record Navigation

Enter a Salesforce record ID (15 or 18 characters) directly and press Enter to navigate to that record.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Cmd/Ctrl + B` | Open/Close UltraForce |
| `Up/Down` | Navigate results |
| `Enter` | Open selected result (or navigate to record ID) |
| `Tab` | Autocomplete (Object → `.` for fields, CMDT/Custom Setting → `.` for records) |
| `Esc` | Close |

## Settings

Click the gear icon to configure:

- **Search Types** - Choose which metadata types to search
- **Keyboard Shortcut** - Customize the activation key
- **Close on Navigate** - Auto-close after opening a result
- **Fuzzy Search** - Enable typo-tolerant matching
- **Hide Managed Package** - Filter out managed package components
- **Max Results Per Type** - Limit the number of results shown per metadata type
- **Navigation Mode** - Auto / Lightning / Classic
- **Custom Commands** - Configure your own command shortcuts

## Security and Privacy

UltraForce communicates directly between your web browser and Salesforce servers. **No data is sent to third parties.**

### Data Storage

We store minimal data in browser localStorage to save your preferences (search settings, keyboard shortcuts, custom commands). None of the stored data contains Salesforce record data (Accounts, Contacts, etc.).

### API Access

The extension communicates via official Salesforce APIs on behalf of the currently logged-in user. This means UltraForce can only access data and features that you already have permission to access in Salesforce.

### Session Handling

All Salesforce API calls reuse the access token/session from your browser's existing Salesforce session. To acquire this access token, UltraForce requires permission to read browser cookie information for Salesforce domains.

## Inspired by

- [EasyMeta](https://chromewebstore.google.com/detail/easymeta/jmlnbdjigfmgodkdaaikakhfabfjohcd) - Chrome extension for Salesforce metadata
- [Salesforce Inspector Reloaded](https://github.com/tprouvot/Salesforce-Inspector-reloaded) - Chrome extension for Salesforce admins and developers
- [Raycast](https://www.raycast.com/) - Productivity tool with beautiful UI/UX

## License

MIT License
