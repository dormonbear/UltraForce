# Phase 03 Research: State Migration

## Current State Architecture

### WindowManagerState (13 fields in 3 categories)

| Category | Fields | Storage |
|----------|--------|---------|
| **UI (transient)** | `isVisible`, `isInitialized`, `searchResults`, `isLoading`, `searchError` | In-memory only |
| **Session (page-derived)** | `sfHost`, `hasSession`, `userLightningPreference`, `recordContext` | Derived from auth/cookies at init |
| **Settings (persistent)** | `closeOnNavigate`, `navigationMode`, `fuzzySearch` | `chrome.storage.local` (`ultraforce_search_settings`) |

### State Duplication Problem

Settings exist in **three places** today:
1. `WindowManagerState` (subset: closeOnNavigate, navigationMode, fuzzySearch)
2. `SearchModal` React state (full blob + local mirrors via `useState`)
3. `chrome.storage.local` key `ultraforce_search_settings` (source of truth)

Both WM and SearchModal independently load from storage and listen to `onChanged`. This creates drift risk and makes testing harder.

### How State Reaches React

- WM builds React tree via `React.createElement(SearchModal, { ...props })`
- Props include: visibility, results, loading, errors, sfHost, hasSession, callbacks
- Update pattern: mutate `this.state` -> call `this.renderComponent()` -> full root re-render
- No React Context or external store subscriptions

## chrome.storage.local Usage Map

| File | Key | R/W | Purpose |
|------|-----|-----|---------|
| `window-manager.ts` | `ultraforce_search_settings` | R + onChanged | Settings subset |
| `SearchModal.tsx` | `ultraforce_search_settings` | R/W | Full settings blob |
| `salesforce-search.tsx` | `ultraforce_search_settings` | R + onChanged | Shortcut key |
| `setup-enhancer.ts` | `ultraforce_search_settings` | R | autoLoadFields toggle |
| `metadata-cache.ts` | `metadata_${orgId}_${type}` | R/W/remove | Metadata cache with TTL |
| `unsupported-types.ts` | `ultraforce_unsupported_types` | R/W/remove | Per-host unsupported types |
| `api-stats.ts` | `ultraforce_api_stats` | R/W/remove | Request counts |
| `version-check.ts` | `ultraforce_version_check` | R/W | Version/notification state |
| `ErrorBoundary.tsx` | `ultraforce_error_logs` | R/W | Last ~10 error log objects |
| `background/index.ts` | `settings` | W (install only) | Legacy initial settings |

**Total: 6 distinct storage keys + dynamic metadata keys**

## Zustand + Plasmo Compatibility

- **Zustand not installed** - no `zustand` in package.json, no `src/stores/` directory
- **Shadow DOM compatible** - Zustand is a JS module store; React under Shadow DOM subscribes normally
- **chrome.storage persistence** - Zustand's `persist` middleware supports custom async storage adapters
- **Isolation model** - Each content script instance gets its own store (same as current WM singleton)
- **No known issues** with Zustand in Chrome MV3 content scripts

## Recommended Store Decomposition

### Store 1: Settings Store
- All fields from `ultraforce_search_settings` (single source of truth)
- Replaces: WM settings fields + SearchModal local state mirrors + direct storage reads
- Persisted via Zustand `persist` middleware with chrome.storage adapter

### Store 2: Session Store
- `sfHost`, `hasSession`, `userLightningPreference`
- Populated during init / `show()` / refresh
- Session key stays in auth module (not exposed in store)

### Store 3: Search Store
- `isVisible`, `searchResults`, `isLoading`, `searchError`, `recordContext`
- Replaces: WM UI state + `renderComponent()` pattern
- Components subscribe with selectors (no full re-render)

### Centralized Storage Service
- Wraps `chrome.storage.local` with typed get/set/remove/onChanged
- Used by Zustand persist middleware and by non-store modules (metadata-cache, api-stats, etc.)
- Eliminates raw `chrome.storage.local` calls from all other files

## Migration Order (dependency-aware)

1. **Storage service** - Create `src/lib/storage-service.ts`, migrate easy call sites first (api-stats, version-check, error-logs, unsupported-types)
2. **Settings store** - Create `src/stores/settings-store.ts` with persist middleware; update SearchModal to use store; update WM to read from store
3. **Session store** - Create `src/stores/session-store.ts`; update WM init/show to populate store
4. **Search store** - Create `src/stores/search-store.ts`; refactor WM to update store instead of `this.state` + `renderComponent()`

Each step is independently verifiable with existing tests.

## Key Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Circular imports (stores <-> WM) | Stores import nothing from WM; WM imports from stores |
| Settings drift during migration | Migrate one consumer at a time; keep storage as fallback |
| TypedEventEmitter obsolescence | Replace with Zustand subscriptions gradually; keep emitter until all subscribers migrated |
| Performance: full re-render pattern | Zustand selectors naturally scope re-renders; Phase 03 should improve perf |
| MetadataCache independence | Keep MetadataCache as its own singleton; only route its storage calls through the service |

## STAT-03 Status

**Already complete.** `sfRest<T = unknown>()` is generic in `auth.ts:56` since Phase 02-03. Call sites use typed parameters. No work needed in Phase 03.

## Estimated Plans

- **Plan 1**: Storage service + migrate non-settings call sites (api-stats, version-check, unsupported-types, error-boundary, metadata-cache)
- **Plan 2**: Settings store + session store + update SearchModal/WM consumers

---
*Researched: 2026-04-04*
