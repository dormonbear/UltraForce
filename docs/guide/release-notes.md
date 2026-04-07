# Release Notes

## v0.2.1

Release Date: 2026-04-07

### New Features

- (describe new features here)

### Improvements

- (describe improvements here)

### Bug Fixes

- (describe bug fixes here)

## v0.2.0

Release Date: 2026-04-06

### New Features

- **Recent History + Frecency**: Modal home screen shows recently visited records and setup pages, ranked by frequency and recency. Remove items or pin them to favorites.
- **Setup Page Favorites**: Pin frequently-used items to the top of the modal home screen. Star icon toggle available on search results and home screen. Persisted across sessions.
- **Smart ID Navigator**: Paste Salesforce record IDs (15/18-char) or URLs into the search input to see record previews with object type and name. Supports pasting multiple IDs at once.
- **Contextual Suggestions**: On record pages, quick actions for Clone and Object Setup. On setup pages, related setup pages in the same category are suggested.

### Improvements

- Modal empty state replaced with rich home screen showing favorites and recent history
- Record action buttons no longer highlight by default
- Favorite star icon consistent across all views (14x14, gold fill when pinned)

## v0.1.3

Release Date: 2026-04-05

### Bug Fixes

- **Search Modal Visual Effect**: Fixed missing frosted glass background effect on the search modal
- **Search Functionality**: Fixed issue where typing in the search input did not trigger search results

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
