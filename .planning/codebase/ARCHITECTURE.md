# Architecture

**Analysis Date:** 2026-04-04

## Pattern Overview

**Overall:** Chrome Extension with Content Script + Shadow DOM UI + Background Service Worker

**Key Characteristics:**
- Content script injects a Shadow DOM container into Salesforce pages; React renders inside it for style isolation
- Background service worker handles cookie access (cross-origin cookie reads are restricted to the background context)
- All state lives in `UltraForceWindowManager` (singleton class) — no Zustand or Redux
- Communication between content script and background via `chrome.runtime.sendMessage`
- Persistent settings stored in `chrome.storage.local`; metadata cache also stored there with 24h TTL

## Layers

**Background Script:**
- Purpose: Cookie-based session retrieval; cannot be done from content script context
- Location: `src/background/index.ts`
- Contains: Message handlers for `getSfHost` and `getSession`, extension install initialization
- Depends on: Chrome cookies API, Chrome storage API
- Used by: All content scripts via `chrome.runtime.sendMessage`

**Content Scripts:**
- Purpose: Inject UI into Salesforce pages, handle keyboard shortcuts, enhance Setup pages
- Locations:
  - `src/contents/salesforce-search.tsx` — primary entry point: initializes WindowManager, sets up shortcuts
  - `src/contents/keyboard-shield.ts` — MAIN world script; monkey-patches `EventTarget.prototype.addEventListener` at `document_start` to suppress Salesforce keyboard shortcuts when modal is open
  - `src/contents/setup-enhancer.ts` — auto-scrolls Setup pages to load lazy content, enabling full field enumeration
- Depends on: `UltraForceWindowManager`, `salesforce-api`, `auth`
- Used by: Injected by Plasmo framework into all matched Salesforce domains

**Window Manager (Orchestration Layer):**
- Purpose: Singleton controller that owns all extension state, mounts React UI into Shadow DOM, orchestrates search calls, handles navigation
- Location: `src/lib/window-manager.ts` (1636 lines — largest file)
- Contains: `WindowManagerState`, Shadow DOM container creation, React root lifecycle, search dispatch, URL building for Lightning/Classic navigation, record context detection, setup shortcuts
- Depends on: `salesforce-api`, `auth`, `keyboard-interceptor`, React, all UI components
- Used by: `salesforce-search.tsx` content script

**Search & API Layer:**
- Purpose: Metadata fetching from Salesforce APIs, fuzzy indexing, caching, command parsing
- Locations:
  - `src/lib/salesforce-api.ts` (~1140 lines) — main orchestrator: SOQL queries per metadata type, cache integration, profile sub-menu logic, custom commands, Tooling API support
  - `src/lib/fuzzy-search.ts` — MiniSearch wrapper with in-memory indexes per metadata type
  - `src/lib/metadata-cache.ts` — chrome.storage.local cache with 24h TTL, 2h background refresh, version-stamped
  - `src/lib/profile-search.ts` — profile-specific sub-queries (permissions, users, object access, etc.)
  - `src/lib/auth.ts` — `sfRest()` wrapper for authenticated API calls; forwards to background for session cookie
  - `src/lib/command-parser.ts` — parses `:cmd query` syntax into typed `ParsedCommand` objects
  - `src/lib/domain-utils.ts` — normalizes Salesforce domain variants; escapes SOQL strings
  - `src/lib/unsupported-types.ts` — tracks which metadata types lack API support in a given org
- Depends on: `auth`, `metadata-cache`, `fuzzy-search`, Chrome storage
- Used by: `window-manager.ts`, `SearchModal.tsx`

**UI Components:**
- Purpose: React presentation layer; receives all state as props, emits callbacks upward to WindowManager
- Location: `src/components/search/`
- Contains:
  - `SearchModal.tsx` — main container, local UI state (query, selected index, settings panel visibility), keyboard navigation
  - `SearchInput.tsx` — controlled input with dot-notation detection for field search
  - `SearchResults.tsx` — result list wrapper
  - `ResultItem.tsx` — individual result row with contextual action buttons
  - `SettingsPanel.tsx` — extension settings UI (shortcut key, navigation mode, custom commands, etc.)
  - `CommandHints.tsx` — displays available `:cmd` shortcuts
  - `EmptyState.tsx` — no-results and loading placeholders
  - `UpdateNotification.tsx` — version bump banner
  - `styles.ts` — CSS-in-JS string constants for Shadow DOM injection
- Depends on: `command-parser`, `salesforce-api` (for unsupported type list), `version-check`, types
- Used by: `window-manager.ts` (React root render)

**Support Libraries:**
- `src/lib/logger.ts` — thin wrapper; silences logs in production
- `src/lib/api-stats.ts` — counts API requests for debug display
- `src/lib/version-check.ts` — compares installed version against latest release
- `src/lib/keyboard-interceptor.ts` — reusable keyboard event filter used inside Shadow DOM context
- `src/components/ErrorBoundary.tsx` — class component wrapping React tree in Shadow DOM

## Data Flow

**Search Flow:**

1. User presses keyboard shortcut (default `Alt+B`) on a Salesforce page
2. `salesforce-search.tsx` calls `windowManager.toggle()`
3. `UltraForceWindowManager.show()` sets `state.isVisible = true`, re-renders React root with `isVisible: true`
4. User types in `SearchInput`; `SearchModal` calls `onSearch(query, types, useFuzzy, hideManagedPkg)`
5. `WindowManager.handleSearch()` calls `searchSalesforceMetadata()` in `salesforce-api.ts`
6. `salesforce-api.ts` checks `MetadataCache` first; on miss, issues SOQL query via `sfRest()`, stores result in cache, builds MiniSearch index via `fuzzy-search.ts`
7. Results returned as `Record<string, SearchResult[]>` keyed by metadata type
8. `WindowManager` updates `state.searchResults`, triggers React re-render
9. `SearchResults` renders `ResultItem` rows

**Authentication Flow:**

1. Content script calls `getSfHost(window.location.href)` from `auth.ts`
2. `auth.ts` sends `{message: 'getSfHost', url}` to background via `chrome.runtime.sendMessage`
3. Background script reads `sid` cookie from matched Salesforce domain, returns hostname
4. `sfRest()` sends `{message: 'getSession', sfHost}` to get the session key
5. All subsequent API calls inject `Authorization: Bearer <sid>` header

**Navigation Flow:**

1. User selects a result in `SearchResults`
2. `SearchModal` calls `onResultClick(result)`
3. `WindowManager.handleResultClick()` builds URL based on `NavigationMode` (`auto`/`lightning`/`classic`) and metadata type
4. URL opened in new tab via `chrome.tabs.create` or `window.open`

**Command Parsing Flow:**

1. Input starting with `:` triggers `parseCommand(input)` in `command-parser.ts`
2. Returns `ParsedCommand` with `commandKey`, `query`, and resolved `types[]`
3. `SearchModal` passes resolved `types` to `onSearch`; dot-notation (`Object.Field`) triggers field sub-search path

## Key Abstractions

**UltraForceWindowManager:**
- Purpose: Central controller and state container; single source of truth for extension runtime state
- File: `src/lib/window-manager.ts`
- Pattern: Singleton with async factory (`getInstance()`), Promise-guarded initialization, cleanup on re-init

**MetadataCache:**
- Purpose: Persistent cache for Salesforce metadata with versioning and background refresh
- File: `src/lib/metadata-cache.ts`
- Pattern: Singleton class, keyed by `orgId + metadataType`, stored in `chrome.storage.local`

**SearchCommand System:**
- Purpose: Extensible typed dispatch — builtin shortcuts (`:o`, `:c`, etc.) and user-defined SOQL commands
- Files: `src/lib/command-parser.ts`, `src/types/index.ts`
- Pattern: Union type `BuiltinCommand | CustomCommand`; type guards `isBuiltinCommand()` / `isCustomCommand()`

**Shadow DOM Container:**
- Purpose: Style isolation from Salesforce host page CSS
- Created in: `UltraForceWindowManager.createContainer()` with `attachShadow({mode: 'closed'})`
- Styles injected: `src/components/search/styles.ts` (CSS-in-JS string appended as `<style>` tag)

## Entry Points

**Primary Content Script:**
- Location: `src/contents/salesforce-search.tsx`
- Triggers: Injected by Plasmo on all matched `https://*.salesforce.com/*` (and variants) URLs
- Responsibilities: Instantiates `UltraForceWindowManager`, binds keyboard shortcut, listens for storage changes, handles Chrome runtime messages

**Keyboard Shield:**
- Location: `src/contents/keyboard-shield.ts`
- Triggers: `run_at: document_start` in MAIN world (same JS context as the page)
- Responsibilities: Monkey-patches `addEventListener` to suppress Salesforce keyboard shortcuts while modal is open

**Setup Enhancer:**
- Location: `src/contents/setup-enhancer.ts`
- Triggers: `run_at: document_idle`, matches Setup page URLs only
- Responsibilities: Scrolls Setup lists to trigger lazy loads; watches for SPA navigation via URL polling

**Background Service Worker:**
- Location: `src/background/index.ts`
- Triggers: Persistent service worker registered in Plasmo manifest
- Responsibilities: Cookie reads for session auth, initial settings install, ping handler

## Error Handling

**Strategy:** Try/catch at each async boundary; errors logged via `logger`; UI shown a `searchError` string prop

**Patterns:**
- `WindowManager.initialize()` catches init errors, calls `setupMinimalFallback()` (keyboard shortcut only)
- `salesforce-api.ts` marks metadata types as unsupported on 4xx errors (persisted in `unsupported-types.ts`)
- `ErrorBoundary` in `src/components/ErrorBoundary.tsx` wraps entire React tree; renders fallback UI on uncaught errors
- Session expiry (401) throws a user-facing message: "Session expired. Please refresh the page."

## Cross-Cutting Concerns

**Logging:** `src/lib/logger.ts` — wraps `console.*`; silences output based on `debugMode` flag
**Validation:** No schema validation library; Salesforce ID checked via regex `^[a-zA-Z0-9]{15}$|^[a-zA-Z0-9]{18}$`
**Authentication:** Cookie-based; background script holds exclusive cookie access; content scripts request session via messaging
**Settings Persistence:** `chrome.storage.local` under key `ultraforce_search_settings`; `WindowManager` listens for `chrome.storage.onChanged` to hot-reload settings

---

*Architecture analysis: 2026-04-04*
