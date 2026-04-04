# Roadmap: UltraForce Architecture & Quality

## Overview

This milestone transforms UltraForce from a working-but-brittle Chrome extension into a well-structured, tested, and maintainable codebase. The journey starts by establishing a safety net (TS fixes, test infrastructure, characterization tests), then decomposes the two god classes into focused modules with full test coverage and type safety, migrates state management to Zustand, and finishes with CSS migration, legacy code removal, and coverage targets.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation & Safety Net** - Fix TS errors, set up test infrastructure, capture current behavior
- [ ] **Phase 2: Module Extraction & Type Safety** - Decompose god classes, add unit tests, eliminate any types
- [ ] **Phase 3: State Migration** - Replace WindowManager singleton with Zustand stores and centralized storage
- [ ] **Phase 4: Cleanup & Coverage** - Migrate CSS, remove legacy code, achieve 80% coverage target

## Phase Details

### Phase 1: Foundation & Safety Net
**Goal**: Developers have a clean TypeScript baseline and test infrastructure that captures current behavior before any refactoring begins
**Depends on**: Nothing (first phase)
**Requirements**: FOUN-01, FOUN-02, FOUN-03, FOUN-04, TEST-01
**Success Criteria** (what must be TRUE):
  1. `tsc --noEmit` passes with zero errors
  2. `vitest run --coverage` reports coverage percentages and enforces 80% threshold (current code may be below, but the gate exists)
  3. ESLint warns on `any` usage across the codebase (no build failures, just warnings)
  4. Characterization tests exist for window-manager.ts and salesforce-api.ts that document current behavior
**Plans**: TBD

Plans:
- [ ] 01-01: TBD
- [ ] 01-02: TBD

### Phase 2: Module Extraction & Type Safety
**Goal**: The two god classes are decomposed into focused, tested modules with explicit types replacing all any usage
**Depends on**: Phase 1
**Requirements**: MODL-01, MODL-02, MODL-03, MODL-04, TEST-02, TEST-03, TEST-04, TEST-05, TYPE-01, TYPE-02, TYPE-03
**Success Criteria** (what must be TRUE):
  1. window-manager.ts is replaced by url-builder, navigation, record-context, setup-shortcuts, and core orchestration modules (each under 400 lines)
  2. salesforce-api.ts is replaced by metadata-types, metadata-fetcher, and orchestration facade modules (each under 400 lines)
  3. Unit tests exist for every extracted module and SearchModal component, covering key behaviors
  4. All existing E2E tests pass after extraction (no regressions)
  5. Zero `any` types remain in profile-search.ts, salesforce-api modules, and all fetch calls route through typed sfRest
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD
- [ ] 02-03: TBD

### Phase 3: State Migration
**Goal**: Application state is managed through React-friendly Zustand stores and a centralized storage service, making state testable and predictable
**Depends on**: Phase 2
**Requirements**: STAT-01, STAT-02, STAT-03
**Success Criteria** (what must be TRUE):
  1. Search state, settings, and session data are managed by Zustand stores (not WindowManager singleton)
  2. All chrome.storage.local calls go through a single storage service module
  3. sfRest returns typed responses (`sfRest<T>()`) instead of `Promise<any>`
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD

### Phase 4: Cleanup & Coverage
**Goal**: Technical debt artifacts are removed and the codebase meets the 80% coverage target with comprehensive E2E test coverage
**Depends on**: Phase 3
**Requirements**: CLEN-01, CLEN-02, CLEN-03, CLEN-04, CLEN-05, TEST-06, TEST-07
**Success Criteria** (what must be TRUE):
  1. Styles are loaded from .css files via Plasmo getStyle pattern (styles.ts CSS-in-JS string is gone)
  2. Google Fonts are bundled as local woff2 files (no external network requests for fonts)
  3. Legacy AngularJS directories (js/, view/, reference/) are removed and manifest.json has no references to them
  4. E2E tests cover all core user flows: search, navigation, command system, field search, profile sub-menu
  5. Overall unit test coverage is 80%+ as reported by @vitest/coverage-v8
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Safety Net | 0/2 | Not started | - |
| 2. Module Extraction & Type Safety | 0/3 | Not started | - |
| 3. State Migration | 0/2 | Not started | - |
| 4. Cleanup & Coverage | 0/2 | Not started | - |
