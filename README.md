# UltraForce for Salesforce

A Chrome extension for lightning-fast Salesforce metadata search.

[![CI](https://github.com/dormonbear/UltraForce/actions/workflows/ci.yml/badge.svg)](https://github.com/dormonbear/UltraForce/actions/workflows/ci.yml)
[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/maemkmihjmlfilhpfeeindecjnagelkh)](https://chromewebstore.google.com/detail/ultraforce-for-salesforce/maemkmihjmlfilhpfeeindecjnagelkh)
[![Chrome Web Store users](https://img.shields.io/chrome-web-store/users/maemkmihjmlfilhpfeeindecjnagelkh)](https://chromewebstore.google.com/detail/ultraforce-for-salesforce/maemkmihjmlfilhpfeeindecjnagelkh)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Security Policy](https://img.shields.io/badge/security-policy-blue.svg)](SECURITY.md)

## Install

[Get it on Chrome Web Store](https://chromewebstore.google.com/detail/ultraforce-for-salesforce/maemkmihjmlfilhpfeeindecjnagelkh?authuser=0&hl=en)

## Demo

Press `Cmd+B` or `Ctrl+B` on a Salesforce page, type a metadata name, and open the result directly.

Demo media should be added at `docs/assets/ultraforce-demo.gif` before a public launch.

## Usage

1. Log in to any Salesforce org in your browser
2. Press `Cmd+B` (Mac) or `Ctrl+B` (Windows) to open UltraForce
3. Start typing to search

## Search Types

- **Apex Classes / Triggers** - Search by name
- **Visualforce / LWC / Aura** - Search by component name
- **Custom Objects** - Search by object API name or label
- **Fields** - Use dot-notation: `Account.Name` or `Account.`
- **Flows** - Search by flow name
- **Users** - Search by name, username, email, or federation ID
- **Profiles & Permission Sets** - Profiles, permission sets, permission set groups, custom permissions
- **Custom Labels** - Search by label name or value content
- **Custom Metadata Types** - Search types, use dot-notation for records: `My_Setting__mdt.`
- **Custom Settings** - Search settings, use dot-notation for records: `My_Setting__c.`
- **Queues & Public Groups** - Search by name
- **Reports & Dashboards** - Search by name and folder

## Accessibility

UltraForce is built to be keyboard- and screen-reader friendly: the modal is an ARIA dialog with labelled controls and live-region announcements, every interactive element shows a visible focus ring during keyboard navigation, secondary text meets WCAG AA contrast, and animations are disabled when `prefers-reduced-motion` is set.

## Commands

Type `:` to see available commands for quick filtering:

| Command | Description | Example |
|---------|-------------|---------|
| `:o` | Objects & Fields | `:o account` |
| `:c` | Custom Code (Apex, Triggers, VF, LWC, Aura) | `:c mycontroller` |
| `:f` | Flows | `:f approval` |
| `:u` | Users | `:u john` |
| `:p` | Profiles & Permissions (Profile, Perm Set, Perm Set Group, Custom Permission) | `:p admin` |
| `:l` | Custom Labels | `:l error_message` |
| `:m` | Custom Metadata & Settings | `:m my_setting` |
| `:q` | Queues & Public Groups | `:q support` |
| `:r` | Reports & Dashboards | `:r pipeline` |
| `:g` | Setup Shortcuts | `:g deploy` |

## Home Screen: Recent & Favorites

Open UltraForce with an empty query to see your home screen:

- **Recent** - Items you have opened, ordered by most recently used (the item you just opened is always on top). Isolated per org.
- **Favorites** - Pin frequently-used items with the star icon to keep them at the top. Persisted across sessions.

## Direct Record Navigation

Paste one or more Salesforce record IDs (15 or 18 characters) or record URLs into the search box. UltraForce previews the resolved record (object type and name); press Enter to open it. Multiple IDs can be pasted at once.

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

We store minimal data in the browser's extension storage (`chrome.storage.local`) to save your preferences (search settings, keyboard shortcut, custom commands) along with a locally cached metadata index, recent history, and favorites. Recent history and favorites are isolated per Salesforce org. None of the stored data is sent anywhere.

### API Access

The extension communicates via official Salesforce APIs on behalf of the currently logged-in user. This means UltraForce can only access data and features that you already have permission to access in Salesforce.

### Session Handling

All Salesforce API calls reuse the access token/session from your browser's existing Salesforce session. To acquire this access token, UltraForce requires permission to read browser cookie information for Salesforce domains.

## Inspired by

- [EasyMeta](https://chromewebstore.google.com/detail/easymeta/jmlnbdjigfmgodkdaaikakhfabfjohcd) - Chrome extension for Salesforce metadata
- [Salesforce Inspector Reloaded](https://github.com/tprouvot/Salesforce-Inspector-reloaded) - Chrome extension for Salesforce admins and developers
- [Raycast](https://www.raycast.com/) - Productivity tool with beautiful UI/UX

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, development workflow, and testing expectations. See
[SECURITY.md](SECURITY.md) to report vulnerabilities privately.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.

## License

MIT License
