# Phase 01: Foundation & Safety Net - Research

**Researched:** 2026-04-04
**Domain:** TypeScript compilation, Vitest testing infrastructure, ESLint configuration, Chrome extension mocking
**Confidence:** HIGH

## Summary

Phase 1 establishes the safety net before any refactoring begins. The work divides into four streams: (1) fixing 6 known TypeScript compilation errors with minimal changes, (2) installing and configuring @vitest/coverage-v8 for coverage reporting without thresholds, (3) migrating Chrome API mocks from hand-rolled to vitest-chrome, and (4) writing comprehensive characterization tests for the two god classes (window-manager.ts at 1715 lines and salesforce-api.ts at 1206 lines).

The TypeScript fixes are straightforward -- each error has a known location and prescribed fix from the CONTEXT.md decisions. The vitest-chrome migration requires care because the current hand-rolled mock in test-setup.ts has specific default behaviors (e.g., `storage.local.get` returns `{}`, `cookies.get` returns `null`) that existing tests depend on. The characterization tests are the largest effort: window-manager.ts has ~25 private methods covering URL building, navigation, record context, setup shortcuts, and state management, while salesforce-api.ts has ~15 internal functions covering metadata fetching, caching, pagination, field search, and custom commands.

**Primary recommendation:** Execute in dependency order -- TS fixes first (unblocks `tsc --noEmit` gate), then coverage tooling + ESLint config (infrastructure), then vitest-chrome migration (unblocks easier mocking), then characterization tests (largest effort, benefits from all prior work).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: `cookieStoreId` errors -- add `// @ts-expect-error Firefox container tab API` comments, do NOT delete the code
- D-04: window-manager.ts characterization tests -- comprehensive coverage of ALL public methods (~40+ tests)
- D-05: salesforce-api.ts characterization tests -- comprehensive coverage of ALL behaviors
- D-06: Use recorded real Salesforce API responses as test fixtures (JSON fixtures from ultraforce test org)
- D-07: Install @vitest/coverage-v8 but do NOT set any threshold in Phase 1
- D-08: Fully replace hand-rolled Chrome API mocks with vitest-chrome (complete migration, not incremental)

### Claude's Discretion
- ErrorBoundary children prop fix approach (D-02)
- vitest-chrome compatibility strategy for custom mock behaviors (D-09)
- ESLint no-explicit-any warning configuration details
- Test file organization for characterization tests

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUN-01 | All 6 TypeScript errors resolved, `tsc --noEmit` passes | All 6 errors documented with exact locations and fixes in CONCERNS.md; verified current state shows exactly 6 errors in 4 files |
| FOUN-02 | @vitest/coverage-v8 installed and configured (no threshold in Phase 1 per D-07) | @vitest/coverage-v8@4.0.18 matches installed vitest@4.0.18; configuration pattern documented below |
| FOUN-03 | ESLint `no-explicit-any` enabled as warning | Current eslint.config.js has rule set to 'off' at line 42; change to 'warn' |
| FOUN-04 | vitest-chrome replaces hand-rolled Chrome API mocks | vitest-chrome@0.1.0 available on npm; setup pattern documented below |
| TEST-01 | Characterization tests for window-manager.ts and salesforce-api.ts | Public/private method inventory complete; test strategy documented below |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- No semicolons, single quotes, no trailing commas (Prettier enforced)
- Use `logger` module, never `console.*` in production code
- `interface` for object shapes, `type` for unions
- File names: kebab-case for lib, PascalCase for components
- 200-400 lines typical, 800 max per file
- Run `npm run lint` and `npm run type-check` before committing
- Tests use `describe/it` with "should" descriptions, `beforeEach` for isolation
- No emoji in code, logs, UI text, or documentation
- `--run` flag required for Vitest commands
- pnpm is the package manager

## Standard Stack

### Core (to install)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @vitest/coverage-v8 | 4.0.18 | Code coverage via V8 engine | Must match vitest@4.0.18; official Vitest coverage provider |
| vitest-chrome | 0.1.0 | Chrome API mocking for Vitest | Complete mock of Chrome API based on @types/chrome; TypeScript-native |

### Already Installed
| Library | Version | Purpose |
|---------|---------|---------|
| vitest | 4.0.18 | Test runner |
| @testing-library/react | 16.3.2 | Component testing |
| @testing-library/jest-dom | (via setup) | DOM matchers |
| @types/chrome | 0.1.4 | Chrome API types |

**Installation:**
```bash
pnpm add -D @vitest/coverage-v8@4.0.18 vitest-chrome@0.1.0
```

**Version verification:** @vitest/coverage-v8 MUST match the installed vitest version (4.0.18). Confirmed via `pnpm view @vitest/coverage-v8@4.0.18 version` returning `4.0.18`.

## Architecture Patterns

### TypeScript Error Fix Patterns

**Error 1 & 2: `cookieStoreId` (background/index.ts lines 63, 214)**
```typescript
// @ts-expect-error Firefox container tab API
const storeId = sender.tab?.cookieStoreId
```
Decision D-01 is locked: use `@ts-expect-error`, preserve the code.

**Error 3: ErrorBoundary children prop (window-manager.ts line 576)**
The `React.createElement(ErrorBoundary, { onError: ... }, React.createElement(SearchModal, ...))` call passes `children` as the third arg to `createElement`, but TypeScript checks the second arg (props) against `ErrorBoundaryProps` which requires `children: React.ReactNode`. Two options:
- Option A (recommended): Make `children` optional in `ErrorBoundaryProps` -- it is always passed via `createElement`'s third argument, not as a prop. Change `children: React.ReactNode` to `children?: React.ReactNode`.
- Option B: Switch to JSX syntax. Not practical since this is in a non-JSX .ts file.

**Error 4: recordContext missing (window-manager.ts line 1675)**
Add `recordContext: null` to the state reset object in `destroy()`.

**Error 5: isBuiltin missing (SettingsPanel.tsx line 265)**
Add `isBuiltin: false` to the `validCommands[key]` object literal.

**Error 6: null assignment (unsupported-types.ts line 26)**
Line 25-26: `cache = result[STORAGE_KEY] || {}` -- the variable `cache` is typed `UnsupportedTypesState | null` but `loadState()` returns `UnsupportedTypesState`. Fix: add a non-null assertion or change the return to handle the null case. Simplest: `cache = result[STORAGE_KEY] ?? {}` ensures the assignment is always `UnsupportedTypesState`.

### Coverage Configuration Pattern

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test-setup.ts',
        'src/types/**'
      ]
    }
  }
})
```

Per D-07: NO `thresholds` block in Phase 1. Coverage reports generate but do not gate.

### vitest-chrome Migration Pattern

**Current (hand-rolled in test-setup.ts):**
```typescript
const chromeMock = {
  storage: { local: { get: vi.fn().mockResolvedValue({}), ... } },
  cookies: { get: vi.fn().mockResolvedValue(null) },
  runtime: { sendMessage: vi.fn(), onMessage: { addListener: vi.fn() }, getManifest: vi.fn().mockReturnValue({ version: '0.1.0' }) },
  tabs: { query: vi.fn().mockResolvedValue([]), create: vi.fn(), sendMessage: vi.fn() }
}
vi.stubGlobal('chrome', chromeMock)
```

**Target (vitest-chrome):**
```typescript
import * as chrome from 'vitest-chrome'

// vitest-chrome provides typed mocks for all Chrome APIs
// but functions have NO default implementation -- we must add defaults
// to match existing test expectations
Object.assign(global, chrome)

// Restore default behaviors that existing tests depend on
chrome.storage.local.get.mockResolvedValue({})
chrome.storage.local.set.mockResolvedValue(undefined)
chrome.storage.local.remove.mockResolvedValue(undefined)
chrome.cookies.get.mockResolvedValue(null)
chrome.runtime.getManifest.mockReturnValue({ version: '0.1.0' } as chrome.runtime.Manifest)
chrome.tabs.query.mockResolvedValue([])
```

**Key insight:** vitest-chrome mocks have no default return values. Existing tests rely on `storage.local.get` returning `{}` and `cookies.get` returning `null`. These defaults MUST be configured in setup or tests will break.

### ESLint Configuration

In `eslint.config.js`, change line 42:
```javascript
// From:
'@typescript-eslint/no-explicit-any': 'off',
// To:
'@typescript-eslint/no-explicit-any': 'warn',
```

This will produce warnings across the codebase (especially in profile-search.ts, salesforce-api.ts, auth.ts) but will NOT break the build.

### Characterization Test Organization

Recommended: one test file per god class, with nested `describe` blocks for each method group.

```
src/lib/
  window-manager.test.ts      # ~40+ tests covering all public + key private methods
  salesforce-api.test.ts       # ~30+ tests covering all exported functions + internal helpers
  __fixtures__/
    salesforce-responses/      # Real API response JSON fixtures
      apex-classes.json
      custom-objects.json
      entity-definition.json
      field-definitions.json
      ...
```

**Fixture capture:** Use `sf data query` against the `ultraforce` test org to capture real response shapes. Store as JSON in a `__fixtures__` directory co-located with tests.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chrome API mocking | Custom `chromeMock` object | vitest-chrome@0.1.0 | Covers all Chrome APIs, typed, event simulation with `callListeners` |
| Code coverage | Manual tracking | @vitest/coverage-v8 | V8-native instrumentation, accurate line/branch/function coverage |
| Test runner globals | Manual global setup | Vitest `globals: true` | Already configured, provides `vi`, `describe`, `it`, `expect` |

## Common Pitfalls

### Pitfall 1: vitest-chrome Default Return Values
**What goes wrong:** Tests fail because vitest-chrome functions return `undefined` by default, while hand-rolled mocks returned specific values (`{}`, `null`, `[]`).
**Why it happens:** vitest-chrome creates typed `vi.fn()` stubs with no implementation.
**How to avoid:** Configure all default return values in `test-setup.ts` after importing vitest-chrome. Run ALL existing tests after migration to catch regressions.
**Warning signs:** Tests that previously passed now fail with "Cannot read property of undefined."

### Pitfall 2: @vitest/coverage-v8 Version Mismatch
**What goes wrong:** Coverage provider fails to load with cryptic errors.
**Why it happens:** @vitest/coverage-v8 version must exactly match vitest version.
**How to avoid:** Install `@vitest/coverage-v8@4.0.18` to match `vitest@4.0.18`.
**Warning signs:** "Failed to load coverage provider" error.

### Pitfall 3: Characterization Tests That Assert Too Much
**What goes wrong:** Tests become brittle and fail on every minor change.
**Why it happens:** Testing implementation details rather than observable behavior.
**How to avoid:** Focus on input/output contracts: given these inputs, what does the function return? What side effects occur? Do NOT assert on internal state or call ordering.
**Warning signs:** Tests that break when you rename a private variable.

### Pitfall 4: Testing Private Methods Directly
**What goes wrong:** Cannot access private methods in TypeScript.
**Why it happens:** window-manager.ts has most logic in private methods.
**How to avoid:** Test private methods indirectly through public API (`getInstance()`, `toggle()`, `show()`, `hide()`, `getState()`, `getDebugInfo()`). For pure-function private methods (URL building, path resolution), extract into separate module-level functions that can be exported for testing, OR use bracket notation `(instance as any)['methodName']()` sparingly.
**Warning signs:** Needing `// @ts-expect-error` to call methods.

### Pitfall 5: Window Manager Singleton in Tests
**What goes wrong:** Tests contaminate each other through shared singleton state.
**Why it happens:** `UltraForceWindowManager` is a singleton with static `instance` and `initializationPromise`.
**How to avoid:** Call `destroy()` in `afterEach`, or reset static properties. Consider testing extracted pure functions (URL builders, path resolvers) independently.
**Warning signs:** Tests pass individually but fail when run together.

## Code Examples

### Characterization Test Pattern for window-manager.ts

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Since most logic is in private methods, test through public API
// or extract pure functions for direct testing

describe('UltraForceWindowManager', () => {
  describe('URL Building', () => {
    // Test getSetupHost, buildSetupUrl through public navigation paths
    it('should build correct Lightning setup URL for standard domain', () => {
      // Arrange: set up window.location and mock dependencies
      // Act: trigger navigation through handleResultClick
      // Assert: check chrome.tabs.create was called with correct URL
    })
  })

  describe('Setup Shortcuts', () => {
    it('should match shortcut by partial name', () => {
      // Test SETUP_SHORTCUTS search filtering
    })
  })
})
```

### Characterization Test Pattern for salesforce-api.ts

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchSalesforceMetadata, executeCustomCommand } from './salesforce-api'

// Mock dependencies
vi.mock('./auth', () => ({
  getSession: vi.fn(),
  API_VERSION: '62.0'
}))
vi.mock('./metadata-cache')
vi.mock('./fuzzy-search')

describe('searchSalesforceMetadata', () => {
  it('should return empty object when no session', async () => {
    // auth.getSession returns null
    const result = await searchSalesforceMetadata('test', [], 'host.salesforce.com')
    expect(result).toEqual({})
  })

  it('should use cached results on cache hit', async () => {
    // MetadataCache.get returns data, fuzzy-search.hasSearchIndex returns true
  })
})
```

### Fixture Capture Commands

```bash
# Capture Apex class response shape
sf data query --query "SELECT Id, Name, NamespacePrefix, LastModifiedDate, LastModifiedBy.Name FROM ApexClass ORDER BY Name ASC LIMIT 5" --target-org ultraforce --use-tooling-api --json > src/lib/__fixtures__/salesforce-responses/apex-classes.json

# Capture custom object response shape
sf data query --query "SELECT QualifiedApiName, Label, DurableId, KeyPrefix FROM EntityDefinition WHERE IsCustomizable = true LIMIT 5" --target-org ultraforce --use-tooling-api --json > src/lib/__fixtures__/salesforce-responses/entity-definitions.json

# Capture field definition response shape
sf data query --query "SELECT Id, QualifiedApiName, Label, DataType, EntityDefinition.QualifiedApiName FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName = 'Account' LIMIT 5" --target-org ultraforce --use-tooling-api --json > src/lib/__fixtures__/salesforce-responses/field-definitions.json
```

## Window Manager Method Inventory (for TEST-01)

### Public Methods (12)
| Method | Lines | Testable Via |
|--------|-------|-------------|
| `getInstance()` | 283 | Direct call |
| `toggle()` | 467 | Direct call |
| `show()` | 475 | Direct call |
| `hide()` | 534 | Direct call |
| `updateState()` | 1600 | Direct call |
| `getState()` | 1607 | Direct call |
| `isVisible()` | 1611 | Direct call |
| `isInitialized()` | 1615 | Direct call |
| `on()` / `off()` | 1619/1626 | Direct call |
| `destroy()` | 1646 | Direct call |
| `getDebugInfo()` | 1701 | Direct call |

### Key Private Methods (test indirectly or extract)
| Method | Lines | Domain |
|--------|-------|--------|
| `handleSearch()` | 612 | Search orchestration |
| `handleCustomSearch()` | 654 | Custom command search |
| `handleSetupShortcutSearch()` | 703 | Setup shortcut matching |
| `handleResultClick()` | 1183 | Navigation routing |
| `handlePageLayoutNavigation()` | 901 | Page layout resolution |
| `handleRecordTypeNavigation()` | 847 | Record type navigation |
| `getCurrentRecordLayoutInfo()` | 962 | Record context |
| `resolveObjectApiNameFromRecord()` | 996 | Record context |
| `getCurrentUserId()` | 1035 | User resolution |
| `getCurrentUserProfileId()` | 1064 | Profile resolution |
| `getUserLightningPreference()` | 1093 | Lightning preference |
| `getLayoutAssignment()` | 1129 | Layout assignment |
| `createContainer()` | 356 | DOM/Shadow DOM setup |
| `renderComponent()` | 563 | React rendering |
| `fetchRecordTypeId()` | 778 | Record type fetch |

### salesforce-api.ts Function Inventory (for TEST-01)
| Function | Lines | Domain |
|----------|-------|--------|
| `searchSalesforceMetadata()` | 114 | Main search entry point |
| `executeCustomCommand()` | 1085 | Custom SOQL execution |
| `isApiAvailable()` | 847 | API availability check |
| `warmupMetadataCache()` | 888 | Cache preloading |
| `getFieldsForObject()` | 955 | Field search |
| `getUnsupportedTypes()` (re-export) | 1062 | Type filtering |
| `getProfileSubMenuItems()` | 1066 | Profile sub-menu |
| `filterProfileSubMenuData()` | 1070 | Profile filtering |
| Internal: `fetchMetadataFromAPI()` | 424 | API fetch per type |
| Internal: `fetchAllPages()` | 491 | Pagination |
| Internal: `checkPermissionAndFetchMetadata()` | 434 | Permission checking |
| Internal: `formatCustomCommandError()` | 1152 | Error formatting |
| Internal: `getNestedValue()` | 1169 | Object path access |
| Internal: `buildCustomResultDescription()` | 1180 | Result description |
| Internal: `buildResultName()` | 1192 | Result name |
| Internal: `clearAllCacheAndIndexes()` | 1023 | Cache clearing |
| Internal: `clearCacheAndIndexes()` | 1056 | Per-type clearing |

## Open Questions

1. **vitest-chrome Event Simulation**
   - What we know: vitest-chrome provides `callListeners` on event objects for simulating Chrome events
   - What's unclear: Whether `chrome.runtime.onMessage.callListeners()` correctly simulates async message handlers (needed for testing background script interactions)
   - Recommendation: Test this during vitest-chrome migration; if inadequate, add thin wrapper around problematic events

2. **Window Manager Testability Without DOM**
   - What we know: Many private methods (URL building, path resolution) are pure functions buried inside the class
   - What's unclear: How far we can test without actual Shadow DOM creation in jsdom
   - Recommendation: Focus characterization tests on methods that don't require full DOM. For DOM-dependent methods (createContainer, renderComponent), test through public show()/hide() with minimal DOM assertions

3. **Fixture Data Sensitivity**
   - What we know: D-06 specifies capturing real Salesforce API responses from the ultraforce test org
   - What's unclear: Whether response data contains any sensitive info (user emails, internal IDs)
   - Recommendation: Sanitize fixtures before committing -- replace real user names with generic ones, keep structural shape intact

## Sources

### Primary (HIGH confidence)
- Project source code: direct reading of all 6 error locations, eslint.config.js, vitest.config.ts, test-setup.ts
- `tsc --noEmit` output: confirmed exactly 6 errors matching documented locations
- `pnpm view @vitest/coverage-v8@4.0.18`: confirmed version exists and matches vitest
- `pnpm view vitest-chrome version`: confirmed 0.1.0 is latest

### Secondary (MEDIUM confidence)
- [vitest-chrome GitHub](https://github.com/probil/vitest-chrome) - setup pattern, API surface, event simulation
- [Vitest discussion on Chrome extension testing](https://github.com/vitest-dev/vitest/discussions/3090) - community patterns

### Tertiary (LOW confidence)
- vitest-chrome `chrome.storage` mock behavior -- inferred from "no default implementation" pattern; needs validation during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - versions verified against npm registry, compatibility confirmed
- Architecture (TS fixes): HIGH - all 6 errors reproduced and fixes documented
- Architecture (coverage): HIGH - standard vitest configuration pattern
- Architecture (vitest-chrome): MEDIUM - setup pattern verified from README, but default behavior handling needs runtime validation
- Characterization tests: MEDIUM - method inventory complete, but testability of private methods through public API needs proof-of-concept
- Pitfalls: HIGH - based on direct code analysis of singleton patterns, mock defaults, and test isolation concerns

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (stable domain, 30-day validity)
