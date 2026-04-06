# Phase 01: Data Infrastructure - Context

**Gathered:** 2026-04-06
**Status:** Already implemented (pre-existing code discovered)

<domain>
## Phase Boundary

Persistent data stores for history and favorites with navigation tracking hooks.
All code was already implemented prior to formal planning — this context documents what exists.

</domain>

<decisions>
## Implementation Decisions

### History Store
- **D-01:** Zustand store with frecency scoring (frequency * recency decay, 7-day half-life)
- **D-02:** Max 200 history items, trimmed by frecency score
- **D-03:** Persisted to chrome.storage.local via `STORAGE_KEYS.HISTORY`
- **D-04:** `recordVisit()` creates or updates entries (matched by id + type)

### Favorites Store
- **D-05:** Zustand store with add/remove/toggle/isFavorite/clear actions
- **D-06:** Max 20 favorites, newest prepended
- **D-07:** Persisted to chrome.storage.local via `STORAGE_KEYS.FAVORITES`
- **D-08:** `pinnedAt` timestamp tracks when item was pinned

### Navigation Tracking
- **D-09:** `handleResultClick` → `trackNavigation` → `recordVisit` (all result clicks)
- **D-10:** `handleIdNavigate` → `recordVisit` (direct ID navigation)
- **D-11:** `handleActionClick` → `trackNavigation` → `recordVisit` (action clicks)

### Claude's Discretion
None — all decisions were made during implementation.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Stores
- `src/stores/history-store.ts` — History store with frecency scoring
- `src/stores/favorites-store.ts` — Favorites store with pin/unpin
- `src/stores/history-store.test.ts` — 10 tests covering recordVisit, frecency, sorting
- `src/stores/favorites-store.test.ts` — 9 tests covering add/remove/toggle/clear

### Integration
- `src/lib/window-manager.ts` — Lines 665-725: handleResultClick, handleIdNavigate, handleActionClick, trackNavigation
- `src/lib/storage-service.ts` — STORAGE_KEYS.HISTORY, STORAGE_KEYS.FAVORITES

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `calculateFrecency()` and `sortByFrecency()` exported from history-store for use in UI
- `PersistStorage` adapter pattern established for chrome.storage integration

### Established Patterns
- Zustand persist middleware with custom `PersistStorage<Partial<State>>` adapter
- Named exports for store hooks, types, and utility functions

### Integration Points
- WindowManager's `trackNavigation()` private method is the single entry point for history recording
- SearchModal imports both stores for HomeScreen rendering

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard patterns followed from Milestone 1 Phase 3 state migration.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-data-infrastructure*
*Context gathered: 2026-04-06*
