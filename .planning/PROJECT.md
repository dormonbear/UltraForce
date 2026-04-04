# UltraForce for Salesforce - Architecture & Quality Milestone

## What This Is

UltraForce is a Chrome extension that provides fast metadata search and navigation for Salesforce orgs. Users press a keyboard shortcut to open a search modal overlay (injected via Shadow DOM), type queries with fuzzy matching, and navigate directly to Salesforce Setup pages, Apex classes, custom objects, flows, and more. Built with React 18 + TypeScript on the Plasmo framework.

## Core Value

Fast, reliable metadata search and navigation that works across all Salesforce domains -- the extension must never break the host Salesforce page or lose the user's session context.

## Requirements

### Validated

- :white_check_mark: Keyboard-triggered search modal with Shadow DOM isolation -- existing
- :white_check_mark: Fuzzy search across 15+ Salesforce metadata types via MiniSearch -- existing
- :white_check_mark: Cookie-based session authentication via background service worker -- existing
- :white_check_mark: Lightning and Classic navigation mode support -- existing
- :white_check_mark: Dot-notation field search (Object.Field) -- existing
- :white_check_mark: Command system (:cmd shortcuts) with custom user commands -- existing
- :white_check_mark: Metadata caching with 24h TTL and background refresh -- existing
- :white_check_mark: Profile sub-menu search (permissions, users, object access) -- existing
- :white_check_mark: Setup page shortcuts -- existing
- :white_check_mark: Keyboard shield to suppress Salesforce shortcuts when modal is open -- existing

### Active

- [ ] Split window-manager.ts (1715 lines) into focused modules: url-builder, navigation, record-context, setup-shortcuts, core orchestration
- [ ] Split salesforce-api.ts (1206 lines) into metadata-types, metadata-fetcher, and orchestration facade
- [ ] Migrate styles.ts (1374-line CSS-in-JS string) to proper CSS with bundled fonts
- [ ] Introduce centralized storage service to replace scattered chrome.storage calls
- [ ] Replace pervasive `any` types with explicit Salesforce API record interfaces
- [ ] Make sfRest generic: `sfRest<T = unknown>()` instead of `Promise<any>`
- :white_check_mark: Fix all 6 known TypeScript errors (ErrorBoundary children, recordContext, cookieStoreId, isBuiltin, null assignment) — Validated in Phase 1: Foundation & Safety Net
- [ ] Add typed event emitter to replace `Set<Function>` pattern
- [ ] Route all HTTP calls through sfRest (eliminate inline fetch in fetchAllPages)
- [ ] Replace anonymous Apex user ID hack with standard REST endpoint
- [ ] Remove DEBUG_FORCE_SHOW flag; use build-time env var if needed
- :white_check_mark: Add characterization tests for window-manager.ts (66 tests) — Validated in Phase 1: Foundation & Safety Net
- :white_check_mark: Add characterization tests for salesforce-api.ts (54 tests) — Validated in Phase 1: Foundation & Safety Net
- [ ] Add unit tests for metadata-cache.ts (TTL, quota, refresh dedup)
- [ ] Add component tests for SearchModal.tsx (keyboard nav, settings, error states)
- [ ] Achieve 80%+ overall unit test coverage
- [ ] Expand E2E tests to cover all core user flows
- [ ] Remove legacy AngularJS code (js/, view/, reference/ directories) if replaced by modern code
- [ ] Migrate state from WindowManager plain object to React state or Zustand
- [ ] Introduce state management library (Zustand) for centralized state

### Out of Scope

- New feature development -- this milestone focuses on quality and architecture only
- Firefox or Safari extension support -- Chrome only
- UI redesign -- visual appearance stays the same
- Salesforce API version upgrades -- current API versions are sufficient
- Performance optimization of search algorithms -- MiniSearch is working well

## Context

This is Milestone 1 of the UltraForce project. The extension is functional and published, but the codebase has accumulated significant technical debt:

- **God class problem**: `window-manager.ts` (1715 lines) handles DOM, React, state, navigation, URL building, and more
- **Mixed concerns**: `salesforce-api.ts` (1206 lines) mixes type definitions, fetching, caching, and formatting
- **CSS-in-JS debt**: `styles.ts` is a 1374-line string with external Google Fonts dependency
- **Type safety gaps**: Pervasive `any` types, especially in profile and API code
- **Test coverage gaps**: The two largest files have zero unit tests
- **6 active TypeScript errors**: Various type issues that need fixing
- **Legacy code**: AngularJS files in js/, view/, reference/ may be dead code

The codebase map is available at `.planning/codebase/` with detailed analysis of architecture, stack, conventions, testing, integrations, structure, and concerns.

## Constraints

- **Chrome Extension**: Must remain Manifest V3 compatible; Shadow DOM isolation is required
- **No breaking changes**: All existing features must continue working after refactoring
- **Plasmo framework**: Build system is Plasmo; any CSS migration must work within Plasmo's build pipeline
- **Test infrastructure**: Unit tests via Vitest, E2E via Playwright (headed mode, single worker)
- **Code style**: No semicolons, single quotes, no trailing commas (Prettier enforced)
- **File size**: 200-400 lines typical, 800 max per file

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Full refactor, not just review | Code has clear structural issues that need fixing, not just documenting | -- Pending |
| Remove legacy AngularJS code | Modern React code has replaced legacy functionality | -- Pending |
| Tests and refactoring in parallel | Both are needed; refactoring creates testable modules, tests protect refactoring | -- Pending |
| Zustand for state management | WindowManager singleton pattern is untestable; Zustand enables React-native state | -- Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check -- still the right priority?
3. Audit Out of Scope -- reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-04 after Phase 1 completion*
