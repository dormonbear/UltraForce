# Requirements: UltraForce Architecture & Quality

**Defined:** 2026-04-04
**Core Value:** Fast, reliable metadata search and navigation that works across all Salesforce domains

## v1 Requirements

Requirements for Milestone 1. Each maps to roadmap phases.

### Foundation

- [x] **FOUN-01**: All 6 TypeScript compilation errors are resolved and `tsc --noEmit` passes cleanly
- [x] **FOUN-02**: @vitest/coverage-v8 is installed and configured to report coverage (threshold enforcement deferred per D-07 decision)
- [x] **FOUN-03**: ESLint `no-explicit-any` rule is enabled as warning across the codebase
- [x] **FOUN-04**: vitest-chrome is installed and replaces hand-rolled Chrome API mocks in test-setup.ts

### Module Decomposition

- [x] **MODL-01**: window-manager.ts is split into url-builder, navigation, record-context, setup-shortcuts, and core orchestration modules (each under 400 lines)
- [ ] **MODL-02**: salesforce-api.ts is split into metadata-types, metadata-fetcher, and orchestration facade modules (each under 400 lines)
- [x] **MODL-03**: Event emitter uses typed event map interface instead of `Set<Function>`
- [x] **MODL-04**: All existing E2E tests pass after each module extraction (no regressions)

### Testing

- [x] **TEST-01**: Characterization tests capture current behavior of window-manager.ts and salesforce-api.ts before refactoring
- [x] **TEST-02**: Unit tests exist for all extracted modules from window-manager.ts (url-builder, navigation, record-context, setup-shortcuts)
- [ ] **TEST-03**: Unit tests exist for all extracted modules from salesforce-api.ts (metadata-types, metadata-fetcher)
- [ ] **TEST-04**: Component tests exist for SearchModal.tsx covering keyboard navigation, settings persistence, fuzzy toggle, and error states
- [ ] **TEST-05**: Unit tests exist for metadata-cache.ts covering TTL expiry, quota-exceeded retry, cleanup eviction, and background refresh deduplication
- [ ] **TEST-06**: E2E tests cover all core user flows: search, navigation, command system, field search, profile sub-menu
- [ ] **TEST-07**: Overall unit test coverage reaches 80%+ as reported by @vitest/coverage-v8

### State Management

- [ ] **STAT-01**: Zustand stores replace WindowManager singleton state (search store, settings store, session store)
- [ ] **STAT-02**: Centralized storage service replaces scattered chrome.storage.local calls across all modules
- [ ] **STAT-03**: sfRest is generic typed: `sfRest<T = unknown>()` instead of `Promise<any>`

### Type Safety

- [ ] **TYPE-01**: All `any` types in profile-search.ts are replaced with explicit Salesforce API record interfaces
- [ ] **TYPE-02**: All `any` types in salesforce-api.ts are replaced with explicit interfaces
- [ ] **TYPE-03**: All inline fetch calls are routed through sfRest (no duplicate auth logic)

### Cleanup

- [ ] **CLEN-01**: styles.ts is migrated to proper CSS files injected via Shadow DOM (Plasmo getStyle pattern)
- [ ] **CLEN-02**: Google Fonts are bundled locally as woff2 (no external font dependency)
- [ ] **CLEN-03**: Legacy AngularJS code (js/, view/, reference/) is removed after verifying no manifest.json references
- [ ] **CLEN-04**: Anonymous Apex user ID hack is replaced with standard REST endpoint (/services/data/vXX/chatter/users/me)
- [ ] **CLEN-05**: DEBUG_FORCE_SHOW flag is removed from version-check.ts

## v2 Requirements

### Performance

- **PERF-01**: generateDataHash uses sampling instead of full array serialization
- **PERF-02**: Chrome storage compression for large metadata caches
- **PERF-03**: Report/Dashboard fetch pagination (currently hard-capped at 100)

### Advanced Testing

- **ADVT-01**: Mutation testing to validate test quality
- **ADVT-02**: Contract tests for Salesforce API response shapes
- **ADVT-03**: Visual regression tests for SearchModal

## Out of Scope

| Feature | Reason |
|---------|--------|
| New feature development | This milestone is quality-only |
| Firefox/Safari support | Chrome-only extension |
| UI redesign | Visual appearance stays the same |
| Salesforce API version upgrades | Current versions are sufficient |
| Search algorithm optimization | MiniSearch is working well |
| Tailwind CSS migration | High cost for zero visual change in Shadow DOM context |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUN-01 | Phase 1 | Complete |
| FOUN-02 | Phase 1 | Complete |
| FOUN-03 | Phase 1 | Complete |
| FOUN-04 | Phase 1 | Complete |
| MODL-01 | Phase 2 | Complete |
| MODL-02 | Phase 2 | Pending |
| MODL-03 | Phase 2 | Complete |
| MODL-04 | Phase 2 | Complete |
| TEST-01 | Phase 1 | Complete |
| TEST-02 | Phase 2 | Complete |
| TEST-03 | Phase 2 | Pending |
| TEST-04 | Phase 2 | Pending |
| TEST-05 | Phase 2 | Pending |
| TEST-06 | Phase 4 | Pending |
| TEST-07 | Phase 4 | Pending |
| STAT-01 | Phase 3 | Pending |
| STAT-02 | Phase 3 | Pending |
| STAT-03 | Phase 3 | Pending |
| TYPE-01 | Phase 2 | Pending |
| TYPE-02 | Phase 2 | Pending |
| TYPE-03 | Phase 2 | Pending |
| CLEN-01 | Phase 4 | Pending |
| CLEN-02 | Phase 4 | Pending |
| CLEN-03 | Phase 4 | Pending |
| CLEN-04 | Phase 4 | Pending |
| CLEN-05 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0

---
*Requirements defined: 2026-04-04*
*Last updated: 2026-04-04 after roadmap creation*
