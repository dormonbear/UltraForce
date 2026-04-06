# Phase 02: Modal Home Screen - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Redesign the modal's empty state (no query) into a rich home screen showing pinned favorites and frecency-ranked recent history. Add pin/unpin affordance to search results.

**Pre-existing code discovered:**
- `HomeScreen.tsx` (222 lines) — complete component with favorites + recent sections
- `styles.css` — comprehensive HomeScreen styles (lines 1376-1578)
- Both stores fully integrated in window-manager.ts

**Remaining work:**
- Wire HomeScreen into SearchModal (currently `EmptyState type="start"` is rendered instead)
- Add pin/unpin star icon affordance on search result items (ResultItem.tsx)
- Wire HomeScreen callbacks through SearchModal to WindowManager
- Add keyboard navigation for HomeScreen items
- Unit tests for HomeScreen component + integration

</domain>

<decisions>
## Implementation Decisions

### HomeScreen Integration
- **D-01:** Replace `<EmptyState type="start" selectedTypes={selectedTypes} />` (SearchModal line 542) with `<HomeScreen />` when query is empty and session is valid
- **D-02:** Keep `EmptyState` for other states (no-session, loading, command, id-navigation, empty results) — HomeScreen is only for the "start" empty state
- **D-03:** HomeScreen `onNavigate` callback should go through WindowManager's existing navigation (open URL in new tab, track in history, respect closeOnNavigate setting)

### Pin/Unpin Affordance
- **D-04:** Add a small star icon to each search result row in ResultItem.tsx (right side, visible on hover)
- **D-05:** Filled star = pinned, outline star = unpinned — click toggles favorite status
- **D-06:** Pin action uses the existing `useFavoritesStore.toggleFavorite()` — no new store logic needed
- **D-07:** Pin icon appears on all result types (metadata, setup shortcuts, records)

### Keyboard Navigation
- **D-08:** HomeScreen items should NOT have separate keyboard navigation — the existing up/down arrow keys in SearchModal only apply to search results. HomeScreen items are mouse/click-only for v1.
- **D-09:** Typing any character immediately switches from HomeScreen to search mode (existing behavior)

### Performance
- **D-10:** HomeScreen renders from Zustand store state — no API calls, no blocking. Expect < 50ms render.
- **D-11:** `sortByFrecency` is memoized in HomeScreen via useMemo (already implemented)

### Claude's Discretion
- Star icon size and positioning within ResultItem — follow existing action button patterns
- Whether to show a subtle "pin to favorites" tooltip on first use

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### UI Components
- `src/components/search/HomeScreen.tsx` — Pre-existing component to integrate (222 lines)
- `src/components/search/SearchModal.tsx` — Line 542: `EmptyState type="start"` to replace
- `src/components/search/ResultItem.tsx` — Add pin/star icon here
- `src/components/search/EmptyState.tsx` — Keep for non-start states

### Styles
- `src/components/search/styles.css` — Lines 1376-1578: HomeScreen styles already exist

### Stores
- `src/stores/favorites-store.ts` — `toggleFavorite()`, `isFavorite()` for pin affordance
- `src/stores/history-store.ts` — `removeItem()` for history management

### Design Guide
- `docs/ui-design-guide.md` — Raycast-style design spec for UI consistency

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `HomeScreen.tsx` — Already complete with favorites section, recent section, pin/unpin buttons, remove buttons, type badges, relative time formatting
- `styles.css` HomeScreen styles — Glassmorphism cards, hover effects, badge colors per type
- `sortByFrecency()` exported from history-store for ranking

### Established Patterns
- SearchModal passes callbacks as props (onResultClick, onActionClick)
- WindowManager's `trackNavigation()` handles history recording
- Settings store `closeOnNavigate` controls auto-hide after click

### Integration Points
- SearchModal line 542: `<EmptyState type="start" />` → replace with `<HomeScreen />`
- ResultItem: needs new `onToggleFavorite` prop and star icon
- WindowManager: HomeScreen's `onNavigate` needs to open URL + record visit

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard integration of pre-existing components.

</specifics>

<deferred>
## Deferred Ideas

- Keyboard navigation for HomeScreen items (arrow key selection) — defer to later if users request it
- Drag-to-reorder favorites — defer to Phase 4 or later
- HomeScreen search tips section with animated examples — nice-to-have, not in scope

</deferred>

---

*Phase: 02-modal-home-screen*
*Context gathered: 2026-04-06*
