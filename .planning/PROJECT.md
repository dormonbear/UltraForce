# UltraForce for Salesforce - Architecture & Quality Milestone

## What This Is

UltraForce is a Chrome extension that provides fast metadata search and navigation for Salesforce orgs. Users press a keyboard shortcut to open a search modal overlay (injected via Shadow DOM), type queries with fuzzy matching, and navigate directly to Salesforce Setup pages, Apex classes, custom objects, flows, and more. Built with React 18 + TypeScript on the Plasmo framework.

## Core Value

Fast, reliable metadata search and navigation that works across all Salesforce domains -- the extension must never break the host Salesforce page or lose the user's session context.

## Current Milestone: v2.0 Feature Expansion -- Smart Navigation & Productivity

**Goal:** Evolve UltraForce from a metadata search tool into a Salesforce productivity launcher with smart navigation, history tracking, contextual suggestions, and favorites.

**Target features:**
- Smart ID Navigator -- auto-detect Salesforce IDs, record preview, one-keystroke navigation
- Recent History + Frecency -- track visited records/setup pages, frecency ranking, modal home screen
- Contextual Suggestions -- page-aware record actions, related lists, related setup pages
- Setup Page Favorites -- pin setup pages, show on modal home screen

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
- :white_check_mark: TypeScript errors fixed, characterization tests added -- Milestone 1 Phase 1
- :white_check_mark: Module extraction (window-manager, salesforce-api decomposed) -- Milestone 1 Phase 2
- :white_check_mark: Type safety (sfRest generic, typed event emitter) -- Milestone 1 Phase 2
- :white_check_mark: Zustand stores + centralized storage service -- Milestone 1 Phase 3
- :white_check_mark: CSS migration to proper CSS files, Inter font bundled -- Milestone 1 Phase 4

### Active

- [ ] Smart ID Navigator with record preview and one-keystroke navigation
- [ ] Recent history tracking with frecency scoring across sessions
- [ ] Modal home screen with favorites and recent history
- [ ] Contextual page-aware suggestions and expanded record actions
- [ ] Setup page favorites with pin/unpin support

### Out of Scope

- Firefox or Safari extension support -- Chrome only
- Salesforce API version upgrades -- current API versions are sufficient
- Performance optimization of search algorithms -- MiniSearch is working well
- Clipboard monitoring outside the extension modal -- privacy concern, only detect within modal input
- Cross-tab record tracking -- complexity too high for v2.0, defer to future
- Quick Data Peek (hover preview cards) -- deferred, requires significant UI work

## Context

Milestone 1 (Architecture & Quality) shipped: module extraction, Zustand stores, CSS migration, type safety improvements. The codebase is now well-structured with focused modules, proper state management patterns, and 72.64% test coverage.

Milestone 2 builds on this foundation to add user-facing productivity features that transform UltraForce from a search tool into a Salesforce operating system.

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
*Last updated: 2026-04-06 after Milestone v2.0 started*
