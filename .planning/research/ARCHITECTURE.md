# Architecture Patterns: Chrome Extension Refactoring

**Domain:** Chrome Extension Code Quality
**Researched:** 2026-04-04

## Recommended Architecture

### Current State (God Class Problem)

```
WindowManager (1715 lines)
  ├── DOM mounting / React rendering
  ├── State management (plain object + renderComponent)
  ├── URL building (getSetupHost, buildSetupUrl)
  ├── Navigation routing (handleResultClick, handlePageLayout...)
  ├── Record context (getCurrentRecordLayoutInfo, resolveObjectApiName...)
  ├── Setup shortcuts (SETUP_SHORTCUTS, handleSetupShortcutSearch)
  ├── User identity (getCurrentUserId, getCurrentUserProfileId)
  └── Event emitter (Set<Function>)
```

### Target State (Modular)

```
window-manager.ts (~200 lines) -- DOM/React orchestration only
  ├── getInstance(), createInstance(), destroy()
  ├── mountShadowDOM(), renderComponent()
  └── delegates to modules below

url-builder.ts (~150 lines) -- Pure functions, fully testable
  ├── getSetupHost(host)
  ├── buildSetupUrl(host, path)
  └── resolveSetupShortcutPath(shortcut)

navigation.ts (~200 lines) -- Navigation logic
  ├── handleResultClick(result)
  ├── handlePageLayoutNavigation(objectName)
  └── handleRecordTypeNavigation(objectName)

record-context.ts (~150 lines) -- Record detection
  ├── getCurrentRecordLayoutInfo()
  ├── resolveObjectApiNameFromRecord()
  └── getCurrentUserId() / getCurrentUserProfileId()

setup-shortcuts.ts (~100 lines) -- Constants + search
  ├── SETUP_SHORTCUTS constant
  └── handleSetupShortcutSearch(query)

typed-emitter.ts (~50 lines) -- Typed event system
  └── TypedEmitter<EventMap>

salesforce-api.ts (~200 lines) -- Thin orchestration facade
  ├── search(query, options)
  └── delegates to modules below

metadata-types.ts (~300 lines) -- Type definitions + SOQL
  ├── METADATA_TYPES constant
  ├── SfApexClass, SfFieldDefinition, etc. interfaces
  └── Per-type fetch helpers

metadata-fetcher.ts (~200 lines) -- HTTP + pagination
  ├── fetchMetadataFromAPI(type)
  ├── fetchAllPages(url) -- routes through sfRest
  └── getMetadataWithCache(type)

storage-service.ts (~100 lines) -- Centralized chrome.storage
  ├── get<T>(namespace, key)
  ├── set<T>(namespace, key, value)
  └── batch operations

stores/ -- Zustand stores
  ├── search-store.ts -- search query, results, loading state
  ├── settings-store.ts -- user preferences (persisted)
  └── session-store.ts -- auth session, org info
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| window-manager | DOM mounting, React lifecycle | All modules (orchestrator) |
| url-builder | Pure URL construction | navigation (called by) |
| navigation | Tab opening, URL routing | url-builder, stores |
| record-context | Current page record detection | stores (writes context) |
| setup-shortcuts | Setup page shortcut data | navigation (provides paths) |
| metadata-types | Type definitions, SOQL queries | metadata-fetcher (consumed by) |
| metadata-fetcher | HTTP calls, pagination, caching | auth (sfRest), storage-service |
| storage-service | chrome.storage abstraction | All modules that persist data |
| Zustand stores | Reactive state | React components, window-manager |

### Data Flow

```
User types query
  → SearchModal (React) reads/writes search-store
  → search-store triggers salesforce-api.search()
  → salesforce-api delegates to metadata-fetcher
  → metadata-fetcher checks storage-service cache
  → cache miss: sfRest() → Salesforce API → cache result
  → results flow back through store → React re-renders
  → User clicks result
  → navigation.handleResultClick() → url-builder → chrome.tabs.create()
```

## Patterns to Follow

### Pattern 1: Pure Function Extraction

**What:** Extract logic that takes input and returns output (no side effects) into standalone modules.
**When:** URL building, data formatting, query construction, shortcut matching.
**Why:** Pure functions are trivially testable with no mocking required.

```typescript
// url-builder.ts -- pure, no dependencies
export function getSetupHost(currentHost: string): string {
  if (currentHost.includes('.sandbox.')) {
    return currentHost.replace('.my.salesforce.com', '.sandbox.lightning.force.com')
  }
  // ... early returns per pattern
}

// url-builder.test.ts -- no mocking needed
describe('getSetupHost', () => {
  it('transforms sandbox host', () => {
    expect(getSetupHost('myorg.sandbox.my.salesforce.com'))
      .toBe('myorg.sandbox.lightning.force.com')
  })
})
```

### Pattern 2: Zustand Store with Chrome Storage Persist

**What:** Use Zustand's built-in persist middleware with a custom Chrome storage adapter.
**When:** Any state that needs to survive page reloads or be shared across extension contexts.

```typescript
// stores/settings-store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  useFuzzy: boolean
  theme: 'dark' | 'light'
  setFuzzy: (value: boolean) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      useFuzzy: true,
      theme: 'dark',
      setFuzzy: (value) => set({ useFuzzy: value }),
    }),
    {
      name: 'ultraforce-settings',
      storage: {
        getItem: async (name) => {
          const result = await chrome.storage.local.get(name)
          return result[name] ?? null
        },
        setItem: async (name, value) => {
          await chrome.storage.local.set({ [name]: value })
        },
        removeItem: async (name) => {
          await chrome.storage.local.remove(name)
        },
      },
    }
  )
)
```

### Pattern 3: Dependency Injection for Testability

**What:** Pass dependencies as parameters rather than importing singletons.
**When:** Modules that call Chrome APIs, sfRest, or other side-effectful functions.

```typescript
// metadata-fetcher.ts
interface FetchDeps {
  sfRest: <T>(path: string) => Promise<T>
  cache: StorageService
}

export function createMetadataFetcher(deps: FetchDeps) {
  return {
    async fetch<T>(type: MetadataType): Promise<T[]> {
      const cached = await deps.cache.get('metadata', type.key)
      if (cached && !isStale(cached)) return cached.data
      const fresh = await deps.sfRest<T[]>(type.query)
      await deps.cache.set('metadata', type.key, fresh)
      return fresh
    }
  }
}
```

### Pattern 4: Incremental Migration with Facade

**What:** Keep the old API surface while moving internals to new modules.
**When:** Migrating WindowManager -- callers should not change until all modules are extracted.

```typescript
// window-manager.ts (during migration)
import { getSetupHost, buildSetupUrl } from './url-builder'
import { handleResultClick } from './navigation'

class WindowManager {
  // Delegate to new module, keep old method signature
  getSetupHost(host: string): string {
    return getSetupHost(host)
  }

  // Remove old method body, delegate
  handleResultClick(result: SearchResult): void {
    handleResultClick(result, this.state)
  }
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Big Bang Refactor

**What:** Attempting to refactor window-manager.ts in a single commit.
**Why bad:** One broken extraction breaks everything. No safe rollback point.
**Instead:** Extract one module at a time. Each extraction is a separate commit that passes all tests. Order: pure functions first (url-builder), then stateless logic (setup-shortcuts), then stateful (navigation, record-context).

### Anti-Pattern 2: Testing Through the UI Only

**What:** Writing only E2E tests to cover refactored code.
**Why bad:** E2E tests are slow (180s timeout), flaky, and test too many layers at once. A broken URL builder looks the same as a network error.
**Instead:** Unit test each extracted module independently. E2E tests verify integration.

### Anti-Pattern 3: Zustand Store Per Feature Flag

**What:** Creating a separate Zustand store for every small piece of state.
**Why bad:** Store proliferation makes state flow hard to trace.
**Instead:** 3 stores maximum: search (transient), settings (persisted), session (auth/org).

### Anti-Pattern 4: Wrapping `any` with `as` Instead of Fixing

**What:** Using `as SomeType` to silence the linter when removing `any`.
**Why bad:** `as` casts are unchecked -- they hide bugs instead of fixing them.
**Instead:** Define proper interfaces for Salesforce API responses. Use runtime validation (optional) for external data boundaries. Every `as` cast needs a `// SAFETY:` comment.

## Scalability Considerations

| Concern | Current (5 files) | After Refactor (15+ files) | Future (30+ files) |
|---------|-------------------|---------------------------|-------------------|
| Build time | Fast (~3s) | Same (Plasmo/Parcel handles) | Same |
| Import graph | Tangled (god class) | Tree (clear dependencies) | Tree (maintained by lint) |
| Test time | ~2s (few tests) | ~5s (80% coverage) | ~10s (full coverage) |
| Onboarding | Hard (read 1715 lines) | Easy (read 150-line modules) | Easy (discoverable) |

## Sources

- [Plasmo CSUI Styling](https://docs.plasmo.com/framework/content-scripts-ui/styling) -- Shadow DOM CSS injection pattern
- [Zustand persist middleware](https://github.com/pmndrs/zustand) -- Chrome storage adapter pattern
- [Chrome Extension Unit Testing](https://developer.chrome.com/docs/extensions/how-to/test/unit-testing) -- Official Chrome testing guidance
