# Phase 2: Module Extraction & Type Safety - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Decompose window-manager.ts (1716 lines) and salesforce-api.ts (1206 lines) into focused, tested modules. Replace all `any` types in profile-search.ts and salesforce-api modules with explicit interfaces. Make sfRest generic. Add unit tests for every extracted module and SearchModal component tests. All existing E2E tests must pass after extraction.

Requirements: MODL-01, MODL-02, MODL-03, MODL-04, TEST-02, TEST-03, TEST-04, TEST-05, TYPE-01, TYPE-02, TYPE-03

</domain>

<decisions>
## Implementation Decisions

### Extraction Strategy
- **D-01:** Use facade re-export pattern. Old files (window-manager.ts, salesforce-api.ts) become thin re-export facades after extraction. All external importers keep working unchanged. Gradually update importers in later commits. Characterization tests pass without import changes.
- **D-02:** Follow pure-functions-first extraction order: url-builder -> setup-shortcuts -> record-context -> navigation -> core orchestration. Stateless modules first for independently testable extractions with no mock complexity.
- **D-03:** Separate plans for each god class. Plan 1: window-manager.ts extraction + tests. Plan 2: salesforce-api.ts extraction + tests. Plan 3: type safety (any replacement, sfRest generic) + SearchModal component tests. Smaller commits, easier to review and rollback.

### Module Boundaries
- **D-04:** Accept the 5-module split for window-manager.ts as proposed in CONCERNS.md: url-builder (~150 lines), setup-shortcuts (~100 lines), record-context (~200 lines), navigation (~300 lines), core orchestration (~600 lines). Each under 400-line limit.
- **D-05:** Accept the 3-module split for salesforce-api.ts: metadata-types (SOQL queries + type definitions), metadata-fetcher (fetchAllPages, fetchMetadataFromAPI), and orchestration facade.
- **D-06:** Direct imports between extracted modules. Modules import each other directly (e.g., navigation imports url-builder). The orchestration core coordinates high-level flow but doesn't mediate every call.
- **D-07:** Leave profile-search.ts as-is structurally. It's already a separate file with its own tests. TYPE-01 (replace any types) can be done without restructuring it.

### Type Definitions
- **D-08:** Co-locate types with modules. Each extracted module defines its own Salesforce record interfaces (e.g., metadata-types.ts has SfApexClass, SfCustomObject). src/types/index.ts stays for shared/cross-cutting types only.
- **D-09:** Make sfRest generic in Phase 2: `sfRest<T = unknown>()` instead of `Promise<any>`. Add type parameters at each call site during extraction.
- **D-10:** Interface granularity follows SOQL query shape. Define interfaces based on actual fields returned by each SOQL query, not full Salesforce object schemas. Only cover fields actually used in the codebase.

### Event Emitter (MODL-03)
- **D-11:** Custom lightweight typed implementation (~50 lines). No external library. Replace `Set<Function>` with typed event map interface + generic `on/off/emit` methods. Not worth adding a dependency for this.

### Claude's Discretion
- Exact file placement within src/lib/ for extracted modules
- Internal function signatures within extracted modules (as long as public API matches characterization tests)
- SearchModal component test approach (how to handle Shadow DOM dependency in tests)
- metadata-cache.ts test strategy (TEST-05) — mocking chrome.storage vs in-memory adapter

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Module Split Proposals
- `.planning/codebase/CONCERNS.md` §Tech Debt — Detailed split proposals for both god classes with line estimates and function groupings

### Architecture Context
- `.planning/codebase/ARCHITECTURE.md` — Layer diagram, data flow, entry points
- `.planning/codebase/STRUCTURE.md` — Directory layout and file purposes
- `.planning/codebase/CONVENTIONS.md` — Naming patterns, import organization, module design rules

### Testing Infrastructure
- `.planning/codebase/TESTING.md` — Test framework setup, established patterns
- `src/lib/window-manager.test.ts` — Characterization tests (66 tests) — safety net for extraction
- `src/lib/salesforce-api.test.ts` — Characterization tests (54 tests) — safety net for extraction

### Phase 1 Context
- `.planning/phases/01-foundation-safety-net/01-CONTEXT.md` — Prior decisions on test infrastructure, vitest-chrome, coverage tooling

### Requirements
- `.planning/REQUIREMENTS.md` — MODL-01 through MODL-04, TEST-02 through TEST-05, TYPE-01 through TYPE-03

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/window-manager.test.ts`: 66 characterization tests covering all public methods — serves as regression safety net during extraction
- `src/lib/salesforce-api.test.ts`: 54 characterization tests — regression safety net for salesforce-api extraction
- `src/lib/keyboard-interceptor.test.ts`: Example of well-structured unit test with factory functions — pattern to follow for new module tests
- `src/types/index.ts`: Existing shared types barrel — cross-cutting types stay here
- `src/lib/auth.ts`: sfRest() function to be made generic (TYPE-03)

### Established Patterns
- Tests use `describe/it` with "should" descriptions, `beforeEach` for isolation
- `vi.fn()`, `vi.spyOn()`, `vi.stubGlobal()` for mocking
- Inline factory functions in test files (not shared test utils)
- kebab-case for lib files, PascalCase for components
- Named exports for utilities, default export for React components only

### Integration Points
- `src/contents/salesforce-search.tsx`: Primary consumer of WindowManager — imports will work via facade
- `src/components/search/SearchModal.tsx`: Consumer of salesforce-api functions — imports via facade
- `src/lib/profile-search.ts`: Imports from salesforce-api.ts — will use facade re-exports
- `src/lib/metadata-cache.ts`: Used by salesforce-api.ts — no change needed, just imported by new metadata-fetcher

</code_context>

<specifics>
## Specific Ideas

- Characterization tests from Phase 1 are the primary regression safety net — every extraction step must keep them green
- Pure-functions-first order means url-builder and setup-shortcuts can be extracted and tested with zero mocking
- The facade re-export pattern means extraction is incremental and reversible at each step
- sfRest<T> generics should be added at call sites during extraction (natural moment to add types)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-module-extraction-type-safety*
*Context gathered: 2026-04-04*
