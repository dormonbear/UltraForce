# Milestone 2: Feature Expansion -- Smart Navigation & Productivity

## Overview

Evolve UltraForce from a metadata search tool into a Salesforce productivity launcher. Four interconnected features transform the modal's empty state into a smart home screen, add intelligent ID navigation, track user history with frecency scoring, and expand contextual actions based on the current page.

## Features

1. **Smart ID Navigator** -- Auto-detect Salesforce IDs from clipboard/paste, show record preview before navigation
2. **Recent History + Frecency** -- Track recently visited records and setup pages, ranked by frequency + recency
3. **Contextual Suggestions** -- Expand Record Actions with page-aware suggestions beyond Layout/RecordType/Fields
4. **Setup Page Favorites** -- Pin frequently-used setup pages and show them on the modal home screen

## Phases

- [x] **Phase 1: Data Infrastructure** -- New Zustand stores for history and favorites with chrome.storage persistence
- [ ] **Phase 2: Modal Home Screen** -- Redesign empty state into a rich home screen with favorites + recent history
- [ ] **Phase 3: Smart ID Navigator** -- Clipboard ID detection, record preview, enhanced ID navigation
- [ ] **Phase 4: Contextual Suggestions** -- Expand record actions with page-aware contextual suggestions

## Phase Details

### Phase 1: Data Infrastructure
**Goal**: Persistent data stores for history and favorites are in place, with navigation tracking hooks
**Depends on**: Milestone 1 complete (stores, storage-service patterns established)
**Deliverables**:
  1. `src/stores/history-store.ts` -- Zustand store with frecency scoring, persisted to chrome.storage
  2. `src/stores/favorites-store.ts` -- Zustand store for pinned items, persisted to chrome.storage
  3. Navigation tracking in `window-manager.ts` -- record visits after successful navigation
  4. Unit tests for both stores and frecency algorithm
**Success Criteria**:
  1. History store records items with `{ id, name, type, url, visitCount, lastVisitedAt }` and scores by frecency
  2. Favorites store supports add/remove/reorder with `{ id, name, type, url, icon }` shape
  3. Both stores persist to chrome.storage.local and survive extension restarts
  4. Navigation hooks fire on result click, ID navigate, setup shortcut click, and action click

### Phase 2: Modal Home Screen
**Goal**: The modal's empty state (no query) shows a rich home screen with pinned favorites and recent history
**Depends on**: Phase 1
**Deliverables**:
  1. `src/components/search/HomeScreen.tsx` -- New component replacing `EmptyState type="start"`
  2. Favorites section pinned at top of home screen
  3. Recent history section below favorites with frecency-ranked items
  4. Pin/unpin affordance on search results and setup shortcuts (star icon or pin action)
  5. Remove item from history (swipe or X button)
**Success Criteria**:
  1. When modal opens with empty query, favorites and recent items are visible
  2. Clicking a favorite or recent item navigates directly (same as clicking a search result)
  3. Users can pin/unpin from search results via a small icon
  4. Home screen renders within 50ms (no blocking API calls)

### Phase 3: Smart ID Navigator
**Goal**: When users paste or type a Salesforce ID, UltraForce previews the record before navigation
**Depends on**: Phase 1 (history tracking for recently navigated IDs)
**Deliverables**:
  1. Enhanced ID detection -- detect IDs from pasted text, URLs, and mixed content
  2. Record preview fetch -- resolve object type and record name from ID via REST API
  3. Preview UI in the modal -- show "Account: Acme Corp (001xxx)" instead of just the raw ID
  4. One-keystroke navigation with preview confidence
**Success Criteria**:
  1. Pasting "001xxxxxxxxxxxx" or "https://org.salesforce.com/001xxxxxxxxxxxx" into the search input shows the record name and object type
  2. Preview loads within 500ms for cached objects, 1500ms for uncached
  3. Navigation still works immediately on Enter even if preview hasn't loaded
  4. Invalid IDs show a clear "ID not found" message

### Phase 4: Contextual Suggestions
**Goal**: Record actions expand with page-aware suggestions that go beyond Layout/RecordType/Fields
**Depends on**: Phase 2 (home screen renders suggestions area)
**Deliverables**:
  1. Expanded record page actions -- add View Sharing, Audit History, Related Lists, Clone
  2. Object-aware suggestions -- on an Account page, suggest "View Contacts", "View Opportunities"
  3. Setup page suggestions -- on a Setup page, suggest related setup pages
  4. Suggestion engine module `src/lib/contextual-suggestions.ts`
**Success Criteria**:
  1. On a record page, at least 5-6 contextual actions are available (up from current 3)
  2. On a Setup page, related setup pages are suggested
  3. Suggestions render instantly from URL parsing (no API calls needed for basic suggestions)
  4. Actions open correct URLs in both Lightning and Classic modes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Data Infrastructure | 1/1 | Complete | 2026-04-06 |
| 2. Modal Home Screen | 0/1 | Not Started | -- |
| 3. Smart ID Navigator | 0/1 | Not Started | -- |
| 4. Contextual Suggestions | 0/1 | Not Started | -- |
