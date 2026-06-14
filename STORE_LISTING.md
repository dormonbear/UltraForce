# Chrome Web Store Listing

Ready-to-paste copy for the Chrome Web Store developer console. Keep this in
sync with `README.md` and the docs when features change.

## Name

UltraForce for Salesforce

## Summary (max 132 characters)

Lightning-fast, keyboard-first metadata search and navigation for Salesforce. Press Cmd/Ctrl+B and jump to anything.

## Category

Developer Tools

## Detailed Description

UltraForce is a command-palette for Salesforce. Press Cmd+B (Mac) or Ctrl+B
(Windows) on any Salesforce page and instantly search your org's metadata, then
jump straight to it -- no clicking through Setup menus.

Built for admins and developers who live in Setup all day.

WHAT YOU CAN SEARCH
- Apex classes & triggers, Visualforce, Lightning Web Components, and Aura bundles
- Custom objects and fields (type "Account.Name" or "Account." to search fields)
- Flows
- Users (by name, username, email, or federation ID)
- Profiles, permission sets, permission set groups, and custom permissions
- Custom labels (by name or value)
- Custom metadata types and custom settings (with record-level lookup)
- Queues and public groups
- Reports and dashboards
- Setup pages -- jump anywhere in Setup by name

QUICK COMMANDS
Type ":" to filter by type:
  :o  Objects & Fields        :c  Custom Code (Apex/VF/LWC/Aura)
  :f  Flows                   :u  Users
  :p  Profiles & Permissions  :l  Custom Labels
  :m  Custom Metadata & Settings   :q  Queues & Public Groups
  :r  Reports & Dashboards    :g  Go to Setup

RECENT & FAVORITES
Open with an empty box to see your recently used items (most recent first) and
pinned favorites. Both are kept separate per org.

SMART RECORD NAVIGATION
Paste one or more record IDs (15 or 18 chars) or record URLs to preview and open
records directly.

FAST & RELIABLE
- Fuzzy, typo-tolerant matching powered by MiniSearch
- Local metadata cache with automatic background refresh for near-instant results
- Custom commands -- define your own ":" shortcuts and SOQL-backed searches

ACCESSIBLE
Full keyboard navigation with visible focus indicators, screen-reader support
(ARIA dialog, labelled controls, live-region announcements), WCAG AA text
contrast, and reduced-motion support.

WORKS EVERYWHERE
Supports all Salesforce domains: Lightning, Classic, Enhanced Domains,
sandboxes, Developer Editions, and Salesforce on Alibaba Cloud
(sfcrmproducts.cn / sfcrmapps.cn).

PRIVACY
UltraForce talks directly between your browser and Salesforce. No data is sent
to third parties. It reuses your existing Salesforce session, so it can only
access what you already have permission to see. Settings, cache, recent history,
and favorites are stored locally in your browser.

## Permission Justifications

- storage: Cache metadata and save your settings, recent history, and favorites locally.
- activeTab / tabs: Open the search modal on the current tab and open results in new tabs.
- cookies: Read your existing Salesforce session cookie to call Salesforce APIs as you.
- host permissions (Salesforce domains): Inject the search UI and call Salesforce APIs on Salesforce pages only.
