# Release Notes

## v0.1.2

Release Date: 2026-04-05

### Improvements

- **Performance & Stability**: Internal architecture improvements for faster and more reliable search
- **Font Rendering**: Bundled Inter font locally for consistent UI appearance without external requests

## v0.1.1

Release Date: 2026-02-07

### Bug Fixes

- **Keyboard Input on Lightning Pages**: Fixed issue where Salesforce Lightning shortcuts (e.g. 'e' for edit, 'd' for details) would intercept keystrokes, preventing character input in the search modal

### Improvements

- **Code Quality**: Extracted shared utilities (domain-utils), unified code style, removed dead code, consolidated duplicate type definitions
- **Test Coverage**: Added 62 unit tests covering domain utilities and keyboard interceptor

### Technical

- Added Vitest test infrastructure with jsdom environment
- Extracted `keyboard-interceptor` module with full keyboard event handling (printable chars, Backspace/Delete, Ctrl/Cmd shortcuts, navigation keys, IME composition)
- Extracted `domain-utils` module (normalizeHost, isSalesforceDomain, escapeSoql)
- Cleaned ~280 lines of dead code from auth.ts, types/index.ts, salesforce-api.ts

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
