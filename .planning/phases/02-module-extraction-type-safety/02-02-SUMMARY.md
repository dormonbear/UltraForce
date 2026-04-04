---
phase: 02-module-extraction-type-safety
plan: 02
subsystem: api
tags: [salesforce-api, module-extraction, metadata-types, metadata-fetcher, sfRest]

requires:
  - phase: 01-foundation-safety-net
    provides: characterization tests for salesforce-api.ts (54 tests)
provides:
  - metadata-types.ts with METADATA_TYPES constant and Salesforce record interfaces
  - metadata-fetcher.ts with pagination, fetch, and cache logic
  - salesforce-api.ts converted to thin orchestration facade
  - fetchAllPages routed through sfRest (no inline fetch with Authorization header)
affects: [02-03, 03-type-safety]

tech-stack:
  added: []
  patterns: [module-extraction-with-facade, sfRest-centralized-auth]

key-files:
  created:
    - src/lib/metadata-types.ts
    - src/lib/metadata-types.test.ts
    - src/lib/metadata-fetcher.ts
    - src/lib/metadata-fetcher.test.ts
  modified:
    - src/lib/salesforce-api.ts
    - src/lib/salesforce-api.test.ts

key-decisions:
  - "Kept fetchAllPages using sfRest instead of raw fetch, losing Sforce-Query-Options batch size header but gaining centralized auth"
  - "salesforce-api.ts retained 732 lines (above 500 target) due to substantial orchestration logic that doesn't belong in fetcher or types"
  - "Updated formatCustomCommandError regex to handle sfRest error format (API Error N:) vs old fetch format (API N:)"
  - "METADATA_TYPES has 18 entries (plan incorrectly stated 17, Dashboard was miscounted)"

patterns-established:
  - "Facade re-export pattern: salesforce-api.ts re-exports from metadata-types and metadata-fetcher"
  - "sfRest-based pagination: fetchAllPages uses sfRest for each page instead of inline fetch"

requirements-completed: [MODL-02, MODL-04, TEST-03]

duration: 16min
completed: 2026-04-04
---

# Phase 02 Plan 02: Salesforce API Module Extraction Summary

**Decomposed salesforce-api.ts (1158 lines) into metadata-types (187 lines), metadata-fetcher (311 lines), and orchestration facade (732 lines) with fetchAllPages routed through sfRest**

## Performance

- **Duration:** 16 min
- **Started:** 2026-04-04T12:36:39Z
- **Completed:** 2026-04-04T12:52:39Z
- **Tasks:** 2/2
- **Files modified:** 6

## Accomplishments

### Task 1: Extract metadata-types.ts (eac3844)
- Extracted `METADATA_TYPES` constant (18 SOQL query definitions) from salesforce-api.ts
- Added `SearchOptions` interface
- Added 15 typed Salesforce record interfaces (SfApexRecord, SfEntityDefinition, SfFieldDefinition, SfFlow, SfUser, SfPermissionSet, SfProfile, SfBundleRecord, SfCustomLabel, SfCustomMetadataType, SfCustomSetting, SfQueue, SfGroup, SfReport, SfDashboard)
- 55 tests covering type count, query structure, and interface shapes

### Task 2: Extract metadata-fetcher.ts and convert facade (d401188)
- Extracted `fetchAllPages`, `fetchMetadataFromAPI`, `fetchFieldsForObject`, `getMetadataWithCache`, and 6 other functions to metadata-fetcher.ts
- Replaced inline `fetch()` with `sfRest()` in fetchAllPages -- eliminates `Authorization: Bearer` header pattern
- Converted salesforce-api.ts to facade with re-exports from metadata-types and metadata-fetcher
- Updated all 54 characterization tests to mock sfRest instead of global.fetch
- Fixed `formatCustomCommandError` regex to handle sfRest error format
- 14 new tests for metadata-fetcher; all 242 project tests pass

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed formatCustomCommandError regex**
- **Found during:** Task 2
- **Issue:** sfRest throws `API Error 400: ...` but regex expected `API 400: ...`
- **Fix:** Updated regex to `API(?: Error)? \d+: (.+)` to handle both formats
- **Files modified:** src/lib/salesforce-api.ts
- **Commit:** d401188

### Plan Discrepancies

**2. METADATA_TYPES count: 18 not 17**
- Plan stated 17 entries, but actual source has 18 (Dashboard was miscounted in the plan)
- Test updated to expect 18

**3. salesforce-api.ts at 732 lines (above 500 target)**
- The file retains substantial orchestration: searchSalesforceMetadata, executeCustomCommand, warmupMetadataCache, permission checking, domain detection, real-time search functions
- All orchestration is correctly NOT fetch/type logic, so it belongs here
- 732 lines is within project's 800-line max constraint

## Verification

- `vitest run --run` -- 242 tests pass (54 characterization + 55 metadata-types + 14 metadata-fetcher + 119 others)
- `tsc --noEmit` -- clean compilation
- `metadata-fetcher.ts` contains no `Authorization: Bearer` pattern
- `salesforce-api.ts` has re-exports from both metadata-types and metadata-fetcher

## Known Stubs

None -- all extracted functions are fully implemented with real logic.

## Self-Check: PASSED

All 6 files found. Both commit hashes verified.
