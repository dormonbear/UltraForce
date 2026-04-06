# Phase 04: Contextual Suggestions - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning
**Mode:** Auto (recommended defaults selected)

<domain>
## Phase Boundary

Expand the record actions and add page-aware contextual suggestions. Current state: 3 record actions (Page Layout, Record Type, Fields). Target: 5-6+ contextual actions on record pages, related setup page suggestions on setup pages. All URL-based, no API calls needed.

**Existing code:**
- `SearchModal.tsx` lines 293-306: `recordActions` useMemo builds 3 actions
- `RecordContext`: `{ objectApiName, recordId, recordTypeId }`
- `record-context.ts`: Functions for fetching record type, layout info, etc.
- `url-builder.ts`: `getSetupHost`, `buildSetupUrl`, Lightning/Classic URL building
- `setup-shortcuts.ts`: Static list of 40+ setup shortcuts with Lightning and Classic paths
- `window-manager.ts`: `handleActionClick`, `handleFieldsNavigation`, `handleRecordTypeNavigation`
- `ObjectAction` type in `ResultItem.tsx`

</domain>

<decisions>
## Implementation Decisions

### Expanded Record Actions
- **D-01:** Add new record actions: View Sharing, Audit History, Related Lists, Clone, View All Fields
- **D-02:** Actions built from URL patterns (no API calls), using objectApiName from RecordContext
- **D-03:** Keep existing 3 actions (Page Layout, Record Type, Fields) as-is; append new ones after
- **D-04:** Actions that require objectApiName gracefully hidden when objectApiName is null

### Setup Page Suggestions
- **D-05:** When on a setup page, suggest related setup pages from same category in SETUP_SHORTCUTS
- **D-06:** Match current URL against setup shortcuts to detect which category user is in
- **D-07:** Show up to 5 related setup pages, excluding the current one

### Suggestion Engine
- **D-08:** Create `src/lib/contextual-suggestions.ts` as a pure function module (no state, no API calls)
- **D-09:** `getRecordSuggestions(recordContext, sfHost)` returns expanded action list
- **D-10:** `getSetupSuggestions(currentUrl, shortcuts)` returns related setup pages

### UI Integration
- **D-11:** Record actions section in SearchModal already exists — just extend the action list
- **D-12:** Setup suggestions shown as a new section in the empty-query state, below HomeScreen

### Claude's Discretion
- Icon selection for new actions
- Exact URL patterns for Lightning/Classic modes
- Whether to show object-aware cross-object suggestions (e.g., Account -> View Contacts)

</decisions>

<canonical_refs>
## Canonical References

### Core Files to Modify
- `src/components/search/SearchModal.tsx` — Lines 293-306: recordActions useMemo
- `src/lib/window-manager.ts` — handleActionClick, handlePageLayout, etc.
- `src/components/search/styles.css` — Setup suggestions section styles

### New Files to Create
- `src/lib/contextual-suggestions.ts` — Suggestion engine (pure functions)
- `src/lib/contextual-suggestions.test.ts` — Tests

### Reference Files
- `src/lib/setup-shortcuts.ts` — Setup shortcut definitions with categories
- `src/lib/url-builder.ts` — URL building utilities
- `src/lib/navigation.ts` — Navigation URL builders
- `src/types/index.ts` — RecordContext interface

</canonical_refs>

---

*Phase: 04-contextual-suggestions*
*Context gathered: 2026-04-06*
