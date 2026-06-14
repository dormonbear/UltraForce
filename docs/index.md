# Introduction

UltraForce is a Chrome extension designed to enhance Salesforce developers and administrators' productivity by providing fast metadata search and navigation capabilities.

[Install from Chrome Web Store](https://chromewebstore.google.com/detail/ultraforce-for-salesforce/maemkmihjmlfilhpfeeindecjnagelkh)

## Demo

<div style="padding:56.25% 0 0 0;position:relative;"><iframe src="https://player.vimeo.com/video/1148676988?badge=0&autopause=0&player_id=0&app_id=58479" frameborder="0" allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media" style="position:absolute;top:0;left:0;width:100%;height:100%;" title="UltraForce Demo"></iframe></div>

## What is UltraForce?

UltraForce provides a command-palette style interface that allows you to:

- **Search metadata** - Quickly find Apex classes, triggers, objects, fields, flows, reports, and more
- **Navigate to Setup** - Jump directly to Setup pages without manual navigation
- **Search fields** - Use dot notation to search object fields (e.g., `Account.Name`)
- **Recent & Favorites** - Reopen recently used items or pin favorites, isolated per org
- **Direct record navigation** - Paste record IDs or URLs to preview and open records
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

- Google Chrome

## Salesforce Support

UltraForce supports all Salesforce domains including:

- Standard domains (*.salesforce.com)
- Enhanced Domains (*.lightning.force.com)
- Sandboxes and Developer Editions
- Salesforce on Alibaba (*.sfcrmproducts.cn, *.sfcrmapps.cn)
