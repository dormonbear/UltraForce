# Phase 2: Module Extraction & Type Safety - Research

**Researched:** 2026-04-04
**Domain:** TypeScript module decomposition, facade pattern, typed event emitter, Salesforce API typing
**Confidence:** HIGH

## Summary

Phase 2 decomposes two god classes (`window-manager.ts` at 1716 lines, `salesforce-api.ts` at 1206 lines) into focused modules, adds unit tests for each extracted module and SearchModal component, replaces all `any` types in profile-search.ts and salesforce-api modules, and makes `sfRest` generic. The codebase has 231 passing unit tests and characterization tests (66 for window-manager, 54 for salesforce-api) that serve as the regression safety net.

The extraction is low-risk because: (1) characterization tests already cover the public API surface, (2) the facade re-export pattern means external importers never change, and (3) pure-functions-first order allows stateless modules to be extracted and tested without mocking complexity.

**Primary recommendation:** Follow the three-plan structure from D-03: Plan 1 extracts window-manager.ts (5 modules + tests), Plan 2 extracts salesforce-api.ts (3 modules + tests), Plan 3 handles type safety (`any` replacement, `sfRest<T>` generic, SearchModal component tests, metadata-cache tests).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Facade re-export pattern. Old files become thin re-export facades. All external importers keep working unchanged.
- **D-02:** Pure-functions-first extraction order: url-builder -> setup-shortcuts -> record-context -> navigation -> core orchestration.
- **D-03:** Three separate plans: Plan 1 (window-manager extraction + tests), Plan 2 (salesforce-api extraction + tests), Plan 3 (type safety + SearchModal + metadata-cache tests).
- **D-04:** 5-module split for window-manager.ts: url-builder (~150 lines), setup-shortcuts (~100 lines), record-context (~200 lines), navigation (~300 lines), core orchestration (~600 lines).
- **D-05:** 3-module split for salesforce-api.ts: metadata-types, metadata-fetcher, orchestration facade.
- **D-06:** Direct imports between extracted modules (not mediated through orchestration).
- **D-07:** Leave profile-search.ts structurally as-is; only replace `any` types.
- **D-08:** Co-locate types with modules. src/types/index.ts for shared/cross-cutting types only.
- **D-09:** Make sfRest generic: `sfRest<T = unknown>()`.
- **D-10:** Interface granularity follows SOQL query shape (only fields actually used).
- **D-11:** Custom lightweight typed event emitter (~50 lines), no external library.

### Claude's Discretion
- Exact file placement within src/lib/ for extracted modules
- Internal function signatures within extracted modules (as long as public API matches characterization tests)
- SearchModal component test approach (how to handle Shadow DOM dependency in tests)
- metadata-cache.ts test strategy (mocking chrome.storage vs in-memory adapter)

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MODL-01 | window-manager.ts split into 5 modules (each under 400 lines) | Extraction plan with function groupings, dependency analysis, facade pattern |
| MODL-02 | salesforce-api.ts split into 3 modules (each under 400 lines) | METADATA_TYPES constant, fetchAllPages, and search orchestration identified as clear split points |
| MODL-03 | Typed event emitter replaces Set<Function> | Typed event map interface pattern documented |
| MODL-04 | All existing E2E tests pass after extraction | Facade re-export ensures zero import changes; characterization tests as safety net |
| TEST-02 | Unit tests for window-manager extracted modules | Pure functions (url-builder, setup-shortcuts) testable with zero mocks; stateful modules need auth/API mocks |
| TEST-03 | Unit tests for salesforce-api extracted modules | metadata-types is data-only; metadata-fetcher needs fetch/auth mocks |
| TEST-04 | SearchModal component tests | Props-driven component; @testing-library/react with vi.fn() callbacks |
| TEST-05 | metadata-cache.ts unit tests | chrome.storage mock from test-setup.ts; timer mocks for TTL testing |
| TYPE-01 | Replace all `any` in profile-search.ts | 10 `any` usages identified at specific lines; needs Salesforce record interfaces |
| TYPE-02 | Replace all `any` in salesforce-api modules | 17+ `any` usages identified; needs record interfaces per SOQL query shape |
| TYPE-03 | sfRest generic typed, all inline fetch routed through it | auth.ts sfRest returns `Promise<any>` -> `Promise<T>`; fetchAllPages inline fetch must route through sfRest |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **No semicolons, single quotes, no trailing commas** (Prettier enforced)
- **File size: 200-400 lines typical, 800 max** per file
- **Use `logger` module**, never `console.*` in production code
- **Use `interface` for object shapes**, `type` for unions/primitives
- **Named exports for utilities**, default export for React components only
- **kebab-case for lib files**, PascalCase for components
- **Co-located tests**: `<module-name>.test.ts` next to source
- **Test pattern**: `describe/it` with "should" descriptions, `beforeEach` for isolation
- **Run `npm run lint` and `npm run type-check` before committing**
- **No emoji** in code, logs, UI text, or documentation
- **RTK prefix** for all CLI commands

## Architecture Patterns

### Recommended Module Structure After Extraction

```
src/lib/
  url-builder.ts          # ~150 lines: getSetupHost, buildSetupUrl, resolveSetupShortcutPath, shouldUseLightning, getCurrentRecordFromUrl
  setup-shortcuts.ts      # ~100 lines: SETUP_SHORTCUTS constant, SetupShortcut interface, handleSetupShortcutSearch logic
  record-context.ts       # ~200 lines: getCurrentRecordLayoutInfo, resolveObjectApiNameFromRecord, getCurrentUserId, getCurrentUserProfileId, fetchRecordTypeId, getLayoutAssignment, getUserLightningPreference
  navigation.ts           # ~300 lines: handleResultClick URL building (Lightning + Classic switch), handleIdNavigate, handleActionClick, KEY_PREFIX_MAP
  window-manager.ts       # ~600 lines: Slimmed-down orchestration class (DOM, React, state, event forwarding)
  metadata-types.ts       # ~200 lines: METADATA_TYPES constant, SOQL queries, type-specific record interfaces
  metadata-fetcher.ts     # ~250 lines: fetchAllPages, fetchMetadataFromAPI, fetchFieldDefinitions, ensureCMDTRecordIndex, ensureCustomSettingRecordIndex, FetchOptions
  salesforce-api.ts       # ~400 lines: Thin facade re-exporting + searchSalesforceMetadata, executeCustomCommand, warmupMetadataCache orchestration
  typed-event-emitter.ts  # ~50 lines: Generic typed emitter
```

### Pattern 1: Facade Re-Export

**What:** After extracting modules, the original file becomes a re-export facade so external importers are unaffected.

**When to use:** Every extraction step.

**Example:**
```typescript
// src/lib/window-manager.ts (after extraction)
// Re-export everything that was previously imported from here
export { getSetupHost, buildSetupUrl, shouldUseLightning } from './url-builder'
export { SETUP_SHORTCUTS } from './setup-shortcuts'
// ... class UltraForceWindowManager stays here as slimmed-down orchestration
```

### Pattern 2: Pure Function Extraction

**What:** Extract stateless functions that depend only on parameters (no `this`, no globals beyond `window.location`).

**When to use:** url-builder and setup-shortcuts modules.

**Example:**
```typescript
// src/lib/url-builder.ts
export function getSetupHost(sfHost: string | null): string | null {
  if (!sfHost) return null
  return sfHost
    .replace('.my.salesforce.com', '.my.salesforce-setup.com')
    .replace('.lightning.force.com', '.my.salesforce-setup.com')
    // ... remaining replacements
}

export function buildSetupUrl(sfHost: string | null, path: string): string | null {
  const setupHost = getSetupHost(sfHost)
  if (!setupHost) return null
  return `https://${setupHost}${path}`
}
```

### Pattern 3: Typed Event Emitter

**What:** Replace `Map<string, Set<Function>>` with typed generic emitter.

**When to use:** MODL-03, inside window-manager.ts core orchestration.

**Example:**
```typescript
// src/lib/typed-event-emitter.ts
import { logger } from './logger'

interface WindowManagerEvents {
  stateChange: { oldState: WindowManagerState; newState: WindowManagerState; updates: Partial<WindowManagerState> }
  resultClick: SearchResult
  actionClick: { result: SearchResult; action: ObjectAction }
  visibilityChange: boolean
}

type EventHandler<T> = (data: T) => void

export class TypedEventEmitter<EventMap extends Record<string, unknown>> {
  private handlers = new Map<keyof EventMap, Set<EventHandler<any>>>()

  on<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set())
    }
    this.handlers.get(event)!.add(handler)
  }

  off<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): void {
    this.handlers.get(event)?.delete(handler)
  }

  protected emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    this.handlers.get(event)?.forEach((handler) => {
      try {
        handler(data)
      } catch (error) {
        logger.error(`Event handler error for ${String(event)}:`, error)
      }
    })
  }

  clearAll(): void {
    this.handlers.clear()
  }
}
```

### Pattern 4: Navigation URL Builder (extracted from handleResultClick)

**What:** Extract the massive 300-line switch statement into a pure function that takes `(result, sfHost, navigationMode, userLightningPreference)` and returns a URL string.

**When to use:** navigation.ts module.

**Example:**
```typescript
// src/lib/navigation.ts
import { getSetupHost, shouldUseLightning } from './url-builder'
import type { SearchResult, NavigationMode } from '~types'

interface NavigationContext {
  sfHost: string
  navigationMode: NavigationMode
  userLightningPreference: boolean | null
}

export function buildNavigationUrl(
  result: SearchResult,
  context: NavigationContext
): string | null {
  if (result.type === 'SetupShortcut' && result.url) {
    return result.url
  }
  if (!context.sfHost || !result.id) return null

  const baseUrl = `https://${context.sfHost}`
  const useLightning = shouldUseLightning(context.navigationMode, context.userLightningPreference)

  if (useLightning) {
    return buildLightningUrl(result, baseUrl, context.sfHost)
  }
  return buildClassicUrl(result, baseUrl)
}
```

### Pattern 5: sfRest Generic

**What:** Make sfRest return typed responses.

**Example:**
```typescript
// src/lib/auth.ts (modified)
export async function sfRest<T = unknown>(
  sfHost: string,
  path: string,
  options: {
    method?: string
    body?: unknown
    api?: 'normal' | 'bulk'
  } = {}
): Promise<T> {
  // ... existing implementation
  return response.json() as Promise<T>
}
```

### Anti-Patterns to Avoid

- **Extracting methods that still need `this`:** The record-context and navigation functions currently access `this.state.sfHost` etc. Extract them as pure functions that receive state as parameters. Do NOT create classes just to share state.
- **Over-abstracting:** Keep the same function names where possible. The characterization tests call the public API. Internal function names can change but the WindowManager class methods that tests exercise must keep the same signatures.
- **Circular imports:** url-builder must NOT import from navigation. navigation imports url-builder. window-manager orchestration imports all. The dependency graph must be a DAG.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Event emitter | Full EventEmitter with wildcards, once, priority | Simple typed ~50 line emitter (D-11) | Only needs on/off/emit; keep it minimal |
| URL building test data | Manual URL strings | Parameterized `it.each` with test cases from characterization tests | Characterization tests already define expected behavior |
| Chrome storage mocking | Custom mock objects | `vitest-chrome` + test-setup.ts existing mocks | Already established in Phase 1 |
| Component test rendering | Custom render wrapper | @testing-library/react `render()` | Already a project dependency |

## Common Pitfalls

### Pitfall 1: Breaking Characterization Tests During Extraction

**What goes wrong:** Extracting a function changes its import path, but characterization tests mock the old path. Tests pass but mock the wrong thing.
**Why it happens:** `vi.mock('./salesforce-api')` in window-manager.test.ts mocks the original module. If window-manager.ts now imports from `./navigation` instead, the mock no longer intercepts.
**How to avoid:** The facade re-export pattern (D-01) means window-manager.ts still re-exports from the facade. Characterization tests import from the facade path. Internal modules import directly. Verify characterization tests stay green after every extraction step.
**Warning signs:** Tests pass but coverage drops on the newly extracted module.

### Pitfall 2: `this` Context Loss During Method Extraction

**What goes wrong:** A method like `handleResultClick` references `this.state.sfHost`. When extracted to a standalone function, `this` is undefined.
**Why it happens:** Class methods implicitly depend on instance state.
**How to avoid:** Convert extracted methods to pure functions that receive all needed state as parameters. The orchestration class calls `buildNavigationUrl(result, { sfHost: this.state.sfHost, ... })`.
**Warning signs:** `TypeError: Cannot read property 'sfHost' of undefined` at runtime.

### Pitfall 3: fetchAllPages Inline Fetch vs sfRest

**What goes wrong:** `fetchAllPages` at line 632 uses inline `fetch()` with `Authorization: Bearer ${sessionId}`. This duplicates auth logic from `sfRest`. After making sfRest generic, this inline fetch is still untyped and bypasses the centralized auth.
**Why it happens:** fetchAllPages was written before sfRest was established as the canonical HTTP layer.
**How to avoid:** Route fetchAllPages through sfRest (TYPE-03). sfRest already handles host normalization, session retrieval, and error formatting. The pagination loop can still exist in metadata-fetcher but each HTTP call should go through sfRest.
**Warning signs:** Session expired errors not handled consistently; host normalization skipped.

### Pitfall 4: window.location Dependency in Pure Functions

**What goes wrong:** `shouldUseLightning` and `getCurrentRecordFromUrl` access `window.location` directly. Extracting them as "pure functions" still leaves a global dependency.
**Why it happens:** These functions read browser state to determine Lightning vs Classic mode.
**How to avoid:** Accept the `window.location` dependency for now (it's available in jsdom). In tests, set `window.location` using `vi.stubGlobal` or assign `window.location.href`/`window.location.pathname` before calling the function. Don't over-abstract by passing location as a parameter unless tests demand it.
**Warning signs:** Tests fail with "window is not defined" (shouldn't happen in jsdom).

### Pitfall 5: SearchModal Tests and Shadow DOM

**What goes wrong:** SearchModal in production is rendered inside Shadow DOM. Tests using @testing-library/react render into `document.body`. Style isolation and event bubbling may differ.
**Why it happens:** Shadow DOM is created by WindowManager, not SearchModal itself. SearchModal is a pure props-driven component.
**How to avoid:** SearchModal is fully testable via @testing-library/react without Shadow DOM. All state comes via props, all actions via callback props. Don't try to test Shadow DOM rendering in component tests; that's E2E territory.
**Warning signs:** Tests work but don't match production behavior (acceptable -- E2E tests cover the gap).

### Pitfall 6: Metadata-Cache TTL Tests with Timers

**What goes wrong:** Tests for TTL expiry and background refresh need to simulate time passing. Using real timers makes tests slow and flaky.
**Why it happens:** MetadataCache checks `Date.now()` against timestamps.
**How to avoid:** Use `vi.useFakeTimers()` and `vi.advanceTimersByTime()`. Mock `Date.now()` to control time. Reset with `vi.useRealTimers()` in afterEach.
**Warning signs:** Tests pass locally but fail in CI due to timing differences.

## Code Examples

### Extraction Step: url-builder.ts

Functions to extract from window-manager.ts (lines 149-233):
- `resolveSetupShortcutPath` (line 149)
- `getSetupHost` (line 157)
- `buildSetupUrl` (line 170)
- `getCurrentRecordFromUrl` (line 176)
- `shouldUseLightning` (line 192)

These are all standalone functions with no class dependency. Copy-paste extraction with zero refactoring needed.

### Extraction Step: setup-shortcuts.ts

Data to extract from window-manager.ts (lines 38-147):
- `SetupShortcut` interface (line 38)
- `SETUP_SHORTCUTS` constant array (line 69)

### Extraction Step: navigation.ts

Data and logic from window-manager.ts:
- `KEY_PREFIX_MAP` constant (lines 47-67)
- `handleResultClick` URL building logic (lines 1183-1492) -- refactored from method to pure function
- `handleIdNavigate` logic (lines 1494-1503)
- `handleActionClick` logic (lines 1505-1597)

### Extraction Step: record-context.ts

Methods from UltraForceWindowManager class (lines 778-1165):
- `fetchRecordTypeId` (line 778) -- needs sfRest, state access
- `handleFieldsNavigation` (line 794)
- `handleRecordTypeNavigation` (line 847)
- `handlePageLayoutNavigation` (line 901)
- `getCurrentRecordLayoutUrl` (line 941)
- `getCurrentRecordLayoutInfo` (line 962)
- `resolveObjectApiNameFromRecord` (line 996)
- `getCurrentUserId` (line 1035)
- `getCurrentUserProfileId` (line 1064)
- `getUserLightningPreference` (line 1093)
- `getLayoutAssignment` (line 1129)

These methods all access `this.state.sfHost` and call `sfRest`. Extract as functions that take `sfHost` as a parameter.

### Extraction Step: metadata-types.ts

From salesforce-api.ts (lines 30-85):
- `METADATA_TYPES` constant
- Type-specific interfaces for each SOQL query shape

### Extraction Step: metadata-fetcher.ts

From salesforce-api.ts:
- `fetchAllPages` (line 612) -- the pagination engine
- `fetchMetadataFromAPI` (line ~560) -- fetches and maps records
- `fetchFieldDefinitions` (line ~400) -- field search support
- `fetchRecordsForCMDT` (line 443) -- CMDT record fetching
- `fetchRecordsForCustomSetting` (line 500) -- Custom Setting record fetching
- `ensureCMDTRecordIndex` (line 434)
- `ensureCustomSettingRecordIndex` (line 491)
- `ensureFieldIndex` (line ~410)
- `FetchOptions` interface (line 605)
- `getMetadataWithCache` (line ~575) -- cache-aware fetch orchestration

### Salesforce Record Interfaces (TYPE-01, TYPE-02)

Interfaces derived from actual SOQL query shapes in METADATA_TYPES:

```typescript
// src/lib/metadata-types.ts
interface SfApexClass {
  Id: string
  Name: string
  NamespacePrefix: string | null
  LastModifiedDate: string
  LastModifiedBy: { Name: string }
}

interface SfEntityDefinition {
  QualifiedApiName: string
  Label: string
  DurableId: string
  KeyPrefix: string | null
}

interface SfFieldDefinition {
  DurableId: string
  QualifiedApiName: string
  Label: string
  DataType: string
  EntityDefinition: { QualifiedApiName: string }
  NamespacePrefix: string | null
}

interface SfFlow {
  Id: string
  MasterLabel: string
  VersionNumber: number
  Status: string
}

interface SfUser {
  Id: string
  Name: string
  Username: string
  Email: string
  FederationIdentifier: string | null
  IsActive: boolean
  Profile: { Name: string }
  UserRole: { Name: string } | null
}

// ... one interface per METADATA_TYPES entry
```

For profile-search.ts, define interfaces for the Tooling API query results:

```typescript
// In profile-search.ts (co-located per D-08)
interface SfObjectPermission {
  Id: string
  SobjectType: string
  PermissionsRead: boolean
  PermissionsCreate: boolean
  PermissionsEdit: boolean
  PermissionsDelete: boolean
  PermissionsViewAllRecords: boolean
  PermissionsModifyAllRecords: boolean
}

interface SfFieldPermission {
  Id: string
  SobjectType: string
  Field: string
  PermissionsRead: boolean
  PermissionsEdit: boolean
}
// ... etc for each query function
```

## Dependency Graph (Post-Extraction)

```
url-builder.ts          (zero imports from src/lib)
setup-shortcuts.ts      (imports: url-builder)
record-context.ts       (imports: url-builder, auth)
navigation.ts           (imports: url-builder, types)
typed-event-emitter.ts  (imports: logger)
window-manager.ts       (imports: navigation, record-context, setup-shortcuts, url-builder, typed-event-emitter, salesforce-api, auth, logger, keyboard-interceptor, React)

metadata-types.ts       (zero imports from src/lib)
metadata-fetcher.ts     (imports: metadata-types, auth, domain-utils, metadata-cache, fuzzy-search, api-stats, logger)
salesforce-api.ts       (imports: metadata-types, metadata-fetcher, auth, domain-utils, fuzzy-search, profile-search, unsupported-types, metadata-cache, logger)
```

No circular dependencies. DAG structure verified.

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `Set<Function>` event handlers | Typed event map with generic emitter | Compile-time safety for event payloads |
| `sfRest(): Promise<any>` | `sfRest<T>(): Promise<T>` | Type inference at every call site |
| 1716-line god class | 5 focused modules + orchestration | Each module independently testable |
| Inline `fetch()` in fetchAllPages | Route through `sfRest` | Centralized auth, consistent error handling |

## Open Questions

1. **record-context.ts caching strategy**
   - What we know: Several functions (`resolveObjectApiNameFromRecord`, `getCurrentUserProfileId`) use instance caches (`sobjectPrefixCache`, `currentUserProfileId`) that live on the WindowManager class.
   - What's unclear: Should these caches live in the extracted module as module-level state, or be passed in?
   - Recommendation: Use module-level Maps (same lifetime as the content script). These caches are keyed by sfHost and don't need class instance scope.

2. **handleResultClick refactor scope**
   - What we know: The 300-line switch statement in handleResultClick has massive duplication (getSetupHost is called ~15 times identically).
   - What's unclear: Should we DRY this up during extraction, or preserve the structure exactly?
   - Recommendation: Extract the `getSetupHost` calls into a shared local variable at the top of the Lightning branch. This is safe because it doesn't change behavior, and characterization tests verify the URLs.

## Sources

### Primary (HIGH confidence)
- Direct code analysis of `src/lib/window-manager.ts` (1716 lines), `src/lib/salesforce-api.ts` (1206 lines), `src/lib/auth.ts` (108 lines), `src/lib/profile-search.ts`
- `.planning/codebase/CONCERNS.md` - Tech debt analysis with line-level detail
- `.planning/codebase/CONVENTIONS.md` - Project coding conventions
- `.planning/codebase/TESTING.md` - Test infrastructure and patterns
- Existing characterization tests: `window-manager.test.ts` (974 lines, 66 tests), `salesforce-api.test.ts` (969 lines, 54 tests)
- Current test suite: 231 tests, all passing

### Secondary (MEDIUM confidence)
- Module split estimates from CONCERNS.md (line counts are approximate)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies needed; all tools already in project
- Architecture: HIGH - Extraction targets and boundaries clearly defined by code analysis
- Pitfalls: HIGH - Based on direct code reading of actual dependencies and mock structures
- Type safety: HIGH - `any` usage locations identified by grep; SOQL query shapes visible in source

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (stable codebase, no external dependency changes expected)
