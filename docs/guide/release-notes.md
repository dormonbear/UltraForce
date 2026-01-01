# Release Notes

## v0.1.0

Release Date: 2026-01-01

### New Features

- **Reports & Dashboards Search**: Added support for searching Reports and Dashboards with `:r` command. Results display folder name and last modified user
- **Record Context Actions**: When viewing a record, quickly navigate to Page Layout, Record Type, or Fields configuration
- **Queue & Public Group Search**: Added `:q` command to search Queues and Public Groups
- **Version Update Notification**: Users are now notified when a new version is installed
- **API Statistics**: Track and view API call statistics in Settings
- **Custom Command Import/Export**: Import and export custom commands as JSON files
- **Documentation Site**: Added comprehensive documentation at ultraforce.dormon.net

### Improvements

- **Fuzzy Search Enhancement**: Improved typo-tolerant matching with better scoring
- **Metadata Cache Warmup**: Background pre-fetching of common metadata types for faster initial search
- **User Navigation Mode Detection**: Automatically detect user's Lightning/Classic preference
- **Unsupported Types Handling**: Gracefully handle metadata types that user doesn't have permission to access
- **Keyboard Shortcut Compatibility**: Fixed conflict with Salesforce's `/` shortcut key
- **Cache Rebuild**: Added ability to rebuild metadata cache from Settings

### Technical

- Added E2E test suite with Playwright
- Added ESLint configuration
- Improved error handling and logging
