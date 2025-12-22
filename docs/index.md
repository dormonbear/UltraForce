# Introduction

UltraForce is a Chrome extension designed to enhance Salesforce developers and administrators' productivity by providing fast metadata search and navigation capabilities.

[Install from Chrome Web Store](https://chromewebstore.google.com/detail/ultraforce-for-salesforce/maemkmihjmlfilhpfeeindecjnagelkh)

## What is UltraForce?

UltraForce provides a command-palette style interface that allows you to:

- **Search metadata** - Quickly find Apex classes, triggers, objects, fields, flows, and more
- **Navigate to Setup** - Jump directly to Setup pages without manual navigation
- **Search fields** - Use dot notation to search object fields (e.g., `Account.Name`)
- **Custom commands** - Create your own shortcuts for frequently used searches

## Key Features

### Fast Search

UltraForce uses intelligent caching and MiniSearch for fuzzy matching, providing near-instant search results even in large orgs.

### Command System

Use commands prefixed with `:` to filter your searches:

```
:o Account        # Search objects and fields
:c AccountHelper  # Search Apex code
:u john           # Search users
:f approval       # Search flows
```

### Keyboard-First

Open UltraForce with `Cmd+B` (Mac) or `Ctrl+B` (Windows), then navigate results with arrow keys and Enter.

## Browser Support

UltraForce works on Chromium-based browsers:

- Google Chrome
- Microsoft Edge
- Brave

## Salesforce Support

UltraForce supports all Salesforce domains including:

- Standard domains (*.salesforce.com)
- Enhanced Domains (*.lightning.force.com)
- Sandboxes and Developer Editions
- Salesforce on Alibaba (*.sfcrmproducts.cn, *.sfcrmapps.cn)
