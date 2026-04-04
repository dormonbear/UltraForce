# Phase 1: Foundation & Safety Net - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix all TypeScript compilation errors, set up test infrastructure (coverage tooling, Chrome API mocks), configure ESLint any-type warnings, and write comprehensive characterization tests for the two god classes (window-manager.ts and salesforce-api.ts) before any refactoring begins.

Requirements: FOUN-01, FOUN-02, FOUN-03, FOUN-04, TEST-01

</domain>

<decisions>
## Implementation Decisions

### TypeScript Error Fixes
- **D-01:** `cookieStoreId` errors (background/index.ts lines 63, 214) — add `// @ts-expect-error Firefox container tab API` comments, preserving the code for potential future Firefox support. Do NOT delete the code.
- **D-02:** ErrorBoundary `children` prop fix — Claude's discretion on best approach (update props interface or switch to JSX syntax)
- **D-03:** Remaining 4 TS errors (isBuiltin, recordContext, null assignment, second cookieStoreId) — Claude fixes directly with minimal changes, no design decisions needed

### Characterization Test Scope
- **D-04:** window-manager.ts — comprehensive coverage of ALL public methods (~40+ tests). Cover URL building, navigation routing, record context detection, setup shortcuts, page layout resolution, record type navigation, user ID/profile ID fetching, event emitter behavior, and state management.
- **D-05:** salesforce-api.ts — comprehensive coverage of ALL behaviors including fetchAllPages pagination, cache hit/miss paths, field search, profile search delegation, custom command execution, error formatting, and result description building.
- **D-06:** Use recorded real Salesforce API responses as test fixtures. Capture actual API response shapes from the `ultraforce` test org and store as JSON fixtures for deterministic testing.

### Coverage Infrastructure
- **D-07:** Install @vitest/coverage-v8 and configure the coverage tooling, but do NOT set any threshold in Phase 1. The goal is to have the framework ready; the 80% target is a Phase 4 deliverable. Coverage reports should be generated but not gate CI.

### Chrome API Mocking
- **D-08:** Fully replace all hand-rolled Chrome API mocks in test-setup.ts with vitest-chrome. This is a complete migration, not incremental.
- **D-09:** Handling custom mock behaviors (e.g., storage.local.get returning empty object) — Claude's discretion on whether to configure vitest-chrome defaults or add thin wrappers to maintain existing test behavior. Priority: all existing tests must continue to pass.

### Claude's Discretion
- ErrorBoundary children prop fix approach (D-02)
- vitest-chrome compatibility strategy for custom mock behaviors (D-09)
- ESLint no-explicit-any warning configuration details (rule severity, file scope)
- Test file organization for characterization tests (single file vs multiple files per god class)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### TypeScript Errors
- `.planning/codebase/CONCERNS.md` §Known TypeScript Errors — All 6 errors with file locations, symptoms, and fix approaches

### Testing Infrastructure
- `.planning/codebase/TESTING.md` — Current test framework setup, mocking patterns, fixture patterns, and run commands
- `src/test-setup.ts` — Current hand-rolled Chrome API mocks that will be replaced by vitest-chrome
- `vitest.config.ts` — Current Vitest configuration
- `tests/E2E_TEST_GUIDE.md` — Test data reference for the ultraforce Salesforce org

### Codebase Structure
- `.planning/codebase/CONCERNS.md` §Tech Debt — God class analysis with proposed split boundaries
- `.planning/codebase/CONCERNS.md` §Test Coverage Gaps — Details on what's untested in each file

### Project Constraints
- `.planning/REQUIREMENTS.md` — FOUN-01 through FOUN-04 and TEST-01 acceptance criteria
- `CLAUDE.md` §Development Commands — Build and test commands

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/test-setup.ts`: Current Chrome API mock structure — reference for vitest-chrome migration (need to match existing mock behavior)
- `src/lib/keyboard-interceptor.test.ts`: Example of well-structured unit test with factory functions (`createKeyEvent`, `createMockInput`) — pattern to follow
- `src/lib/domain-utils.test.ts`, `src/lib/command-parser.test.ts`, `src/lib/profile-search.test.ts`: Existing test files showing project conventions
- `tests/e2e/fixtures/extension.ts`: E2E fixture with Salesforce org auth — use for capturing real API responses

### Established Patterns
- Tests use `describe/it` with "should" descriptions
- `beforeEach` for isolation
- `it.each` for parameterized tests
- `vi.fn()`, `vi.spyOn()`, `vi.stubGlobal()` for mocking
- Inline factory functions in test files (not shared test utils)

### Integration Points
- `vitest.config.ts` — needs coverage plugin configuration
- `eslint.config.js` — needs `@typescript-eslint/no-explicit-any` warning rule
- `src/test-setup.ts` — migration point from hand-rolled mocks to vitest-chrome
- `package.json` — needs @vitest/coverage-v8 and vitest-chrome as devDependencies

</code_context>

<specifics>
## Specific Ideas

- Real Salesforce API fixtures should be captured from the `ultraforce` test org (orgfarm instance) using sf CLI or direct API calls
- Characterization tests serve as a safety net for Phase 2 module extraction — they document CURRENT behavior, not ideal behavior
- The 6 TS errors should be fixed with minimal changes; no refactoring during this phase

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-safety-net*
*Context gathered: 2026-04-04*
