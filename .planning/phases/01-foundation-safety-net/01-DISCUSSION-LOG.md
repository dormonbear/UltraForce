# Phase 1: Foundation & Safety Net - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-04
**Phase:** 01-foundation-safety-net
**Areas discussed:** TS Error Fix Strategy, Characterization Test Scope, Coverage Threshold Strategy, Chrome API Mock Strategy

---

## TS Error Fix Strategy

### Q1: cookieStoreId handling

| Option | Description | Selected |
|--------|-------------|----------|
| @ts-expect-error + keep code | Preserve Firefox intent, suppress TS error | :white_check_mark: |
| Delete code | Chrome-only extension, remove Firefox-specific code | |
| Claude decides | | |

**User's choice:** @ts-expect-error + keep code
**Notes:** User wants to preserve potential future Firefox support path

### Q2: ErrorBoundary children prop fix

| Option | Description | Selected |
|--------|-------------|----------|
| Update props interface | Add `children?: React.ReactNode` | |
| Switch to JSX syntax | Replace `React.createElement` | |
| Claude decides | | :white_check_mark: |

**User's choice:** Claude decides

### Q3: Remaining 4 TS errors

| Option | Description | Selected |
|--------|-------------|----------|
| Direct fix by Claude | Straightforward fixes, no design decisions | :white_check_mark: |
| Review each individually | | |

**User's choice:** Direct fix by Claude

---

## Characterization Test Scope

### Q4: window-manager.ts test strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Key paths only (~15-20 tests) | URL building, navigation, record context | |
| Comprehensive all public methods (~40+ tests) | Full coverage of all behaviors | :white_check_mark: |
| Phase 2 split boundary focus | Test behaviors that will be extracted | |

**User's choice:** Comprehensive — all public methods

### Q5: salesforce-api.ts test strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Fetch + search orchestration only | Core paths | |
| All behaviors including field search, profile, errors | Complete coverage | :white_check_mark: |
| Phase 2 split boundary focus | | |

**User's choice:** All behaviors — comprehensive

### Q6: Test fixture approach

| Option | Description | Selected |
|--------|-------------|----------|
| Record real API responses | Capture from ultraforce test org | :white_check_mark: |
| Mock data only | Lighter weight, less realistic | |

**User's choice:** Record real API responses as fixtures

---

## Coverage Threshold Strategy

### Q7: Initial coverage threshold

| Option | Description | Selected |
|--------|-------------|----------|
| Framework only, no threshold | Install tooling, generate reports, no gate | :white_check_mark: |
| Low threshold (20-30%) | Gradual ramp-up | |
| 80% on new/modified files only | Strict on changes, lenient on legacy | |

**User's choice:** Framework only — no threshold in Phase 1

---

## Chrome API Mock Strategy

### Q8: vitest-chrome migration scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full replacement | Replace all hand-rolled mocks | :white_check_mark: |
| Incremental | New tests only | |
| Claude decides | | |

**User's choice:** Full replacement

### Q9: Custom mock behavior compatibility

| Option | Description | Selected |
|--------|-------------|----------|
| Prioritize test pass + custom config | Supplement vitest-chrome as needed | |
| Strict vitest-chrome defaults | Adjust tests to match | |
| Claude decides | | :white_check_mark: |

**User's choice:** Claude decides

---

## Claude's Discretion

- ErrorBoundary children prop fix approach
- vitest-chrome compatibility strategy for custom mock behaviors
- ESLint no-explicit-any configuration details
- Test file organization for characterization tests

## Deferred Ideas

None — all discussion stayed within Phase 1 scope
