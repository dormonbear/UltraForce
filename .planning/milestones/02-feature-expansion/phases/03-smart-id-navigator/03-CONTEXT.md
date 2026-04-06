# Phase 03: Smart ID Navigator - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning
**Mode:** Auto (recommended defaults selected)

<domain>
## Phase Boundary

When users paste or type a Salesforce ID (or URL containing one), UltraForce resolves the record name and object type via REST API and shows a preview before navigation. Current behavior just shows "Press Enter to open record [ID]" — this phase adds intelligence.

**Existing code to enhance:**
- `isSalesforceId()` in SearchModal.tsx — validates 15/18-char IDs
- `EmptyState type="id-navigation"` — current dumb UI showing raw ID
- `handleIdNavigate()` in window-manager.ts — opens `https://{host}/{id}` directly
- `buildIdNavigationUrl()` in navigation.ts — simple URL builder
- `sfRest<T>()` in auth.ts — typed REST client for Salesforce API calls

</domain>

<decisions>
## Implementation Decisions

### ID Detection & Extraction
- **D-01:** Extract Salesforce IDs from plain IDs, full URLs (https://org.salesforce.com/001xxx), and mixed text (pasted content containing an ID)
- **D-02:** Move `isSalesforceId()` from SearchModal.tsx to a new `src/lib/id-utils.ts` module for reuse
- **D-03:** Add `extractSalesforceId(input: string): string | null` that handles URL parsing and mixed content extraction
- **D-04:** Support both 15-char and 18-char IDs; normalize to 18-char when possible using standard checksum algorithm

### Record Preview Fetch
- **D-05:** Use Salesforce REST API `GET /services/data/vXX/sobjects/{keyPrefix}/describe` to resolve object type from ID prefix (first 3 chars)
- **D-06:** Use `GET /services/data/vXX/sobjects/{objectType}/{recordId}` to fetch record Name field
- **D-07:** Cache key prefix -> object type mapping in memory (stable across session, no need for chrome.storage persistence)
- **D-08:** Cache individual record previews for 5 minutes in memory (LRU with max 50 entries)
- **D-09:** On 404/403, show "Record not found" or "No access" message — never throw

### Preview UI
- **D-10:** Replace `EmptyState type="id-navigation"` with a new `IdPreview` component showing: object icon + "Account: Acme Corp" + record ID
- **D-11:** Show loading spinner while preview fetches, with the ID visible immediately
- **D-12:** Navigation (Enter key) works immediately regardless of preview load state — do not block on preview
- **D-13:** If preview fails or times out, fall back to current behavior (show raw ID, navigate on Enter)

### Performance
- **D-14:** Key prefix resolution should be near-instant after first lookup (cached)
- **D-15:** Target: preview visible within 500ms for cached object types, 1500ms for uncached
- **D-16:** Use AbortController to cancel in-flight preview requests when user changes input

### Claude's Discretion
- Object type icon selection (reuse TYPE_ICONS from HomeScreen or similar mapping)
- Whether to show the full 18-char ID or truncated version in preview
- Loading spinner style (consistent with existing modal patterns)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Core Files to Modify
- `src/components/search/SearchModal.tsx` — Lines 29-31: `isSalesforceId()` to extract; Lines 590-591: EmptyState id-navigation to replace
- `src/components/search/EmptyState.tsx` — Lines 84-93: current id-navigation UI
- `src/lib/window-manager.ts` — Lines 683-699: `handleIdNavigate()` to enhance
- `src/lib/navigation.ts` — Lines 244-249: `buildIdNavigationUrl()`
- `src/lib/auth.ts` — Lines 56-100: `sfRest<T>()` REST client

### New Files to Create
- `src/lib/id-utils.ts` — ID detection, extraction, validation, normalization
- `src/lib/record-preview.ts` — Key prefix cache, record name fetch, preview cache
- `src/components/search/IdPreview.tsx` — Preview UI component

### Reference Patterns
- `src/lib/metadata-cache.ts` — Cache pattern with TTL for reference
- `src/stores/history-store.ts` — How navigation tracking integrates
- `docs/ui-design-guide.md` — Raycast-style design spec for UI consistency

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `sfRest<T>()` — Already typed REST client, handles auth automatically
- `TYPE_ICONS` in HomeScreen.tsx — Object type to icon mapping
- `formatRelativeTime()` in HomeScreen.tsx — Time formatting for cache age display
- `useSearchStore` — Could hold preview state alongside search results

### Established Patterns
- Async fetch with try/catch returning null on failure (auth.ts, salesforce-api.ts)
- AbortController pattern not yet established — introduce in this phase
- In-memory caching via module-level Map (see unsupported-types.ts pattern)

### Integration Points
- SearchModal: Replace EmptyState type="id-navigation" with IdPreview component
- WindowManager: Enhance handleIdNavigate to record proper name in history after preview
- Navigation: buildIdNavigationUrl unchanged (preview is additive, not replacing navigation)

</code_context>

<specifics>
## Specific Ideas

- Salesforce key prefixes: 001=Account, 003=Contact, 005=User, 006=Opportunity, 00D=Organization, 01p=ApexClass, 300=Flow, etc.
- The REST API endpoint `/services/data/vXX/sobjects/` returns all object describes including keyPrefix field
- For record name: most objects use "Name" field, but some use "Subject" (Case, Task), "Title" (ContentDocument), or "DeveloperName" (custom metadata)

</specifics>

<deferred>
## Deferred Ideas

- Clipboard monitoring outside the modal (privacy concern, explicitly out of scope per PROJECT.md)
- Batch ID resolution (paste multiple IDs at once) — defer to future
- Record preview card with multiple fields (Quick Data Peek) — explicitly deferred in PROJECT.md

</deferred>

---

*Phase: 03-smart-id-navigator*
*Context gathered: 2026-04-06*
