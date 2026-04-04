---
phase: 02-module-extraction-type-safety
plan: 01
subsystem: window-manager
tags: [module-extraction, refactoring, tdd, typed-events]
dependency_graph:
  requires: [01-02-SUMMARY.md]
  provides: [url-builder, setup-shortcuts, navigation, record-context, typed-event-emitter]
  affects: [window-manager.ts, src/types/index.ts]
tech_stack:
  added: [typed-event-emitter]
  patterns: [facade-re-export, pure-function-extraction, module-level-cache]
key_files:
  created:
    - src/lib/url-builder.ts
    - src/lib/url-builder.test.ts
    - src/lib/setup-shortcuts.ts
    - src/lib/setup-shortcuts.test.ts
    - src/lib/typed-event-emitter.ts
    - src/lib/typed-event-emitter.test.ts
    - src/lib/record-context.ts
    - src/lib/record-context.test.ts
    - src/lib/navigation.ts
    - src/lib/navigation.test.ts
  modified:
    - src/lib/window-manager.ts
    - src/lib/window-manager.test.ts
key_decisions:
  - Used composition (eventEmitter field) instead of inheritance for TypedEventEmitter in WindowManager to maintain backward-compatible string-based on/off API
  - Duplicated KEY_PREFIX_MAP in both navigation.ts and record-context.ts since both modules need it independently
  - Kept window-manager.ts at 918 lines (above 800 target) because profile sub-menu types added in Phase 1 were not accounted for in the plan
metrics:
  duration: 22min
  completed: 2026-04-04
  tasks_completed: 2
  tasks_total: 2
  tests_added: 91
  total_tests: 249
---

# Phase 02 Plan 01: Window-Manager Module Extraction Summary

Extracted window-manager.ts (1716 lines) into 5 focused modules with TDD-driven unit tests, plus a typed event emitter replacing Set<Function>. Window-manager reduced to 918 lines of pure orchestration with facade re-exports maintaining backward compatibility.

## Task Results

| Task | Commit | Description | Tests Added |
|------|--------|-------------|-------------|
| 1 | 1b18bcb | Extract url-builder, setup-shortcuts, typed-event-emitter | 38 |
| 2 | 6a3937e | Extract record-context, navigation; slim window-manager | 53 |

## Extracted Modules

| Module | Lines | Purpose |
|--------|-------|---------|
| url-builder.ts | 88 | getSetupHost, buildSetupUrl, shouldUseLightning, getCurrentRecordFromUrl, resolveSetupShortcutPath |
| setup-shortcuts.ts | 87 | SetupShortcut type and SETUP_SHORTCUTS constant (54 shortcuts) |
| typed-event-emitter.ts | 36 | Generic TypedEventEmitter<EventMap> with typed on/off/emit and error isolation |
| record-context.ts | 322 | fetchRecordTypeId, resolveObjectApiNameFromRecord, getCurrentUserId, getCurrentUserProfileId, getUserLightningPreference, getLayoutAssignment, handleFieldsNavigation, handleRecordTypeNavigation, getCurrentRecordLayoutInfo |
| navigation.ts | 336 | buildNavigationUrl, buildIdNavigationUrl, buildActionUrl, KEY_PREFIX_MAP with full Lightning/Classic URL logic for 25+ metadata types |
| window-manager.ts | 918 | Slimmed orchestration: React lifecycle, DOM management, search dispatch, event delegation |

## Deviations from Plan

### Deviation 1: Window-manager at 918 lines (above 800 target)

**Found during:** Task 2
**Issue:** The plan was written based on line references from the original codebase, but Phase 1 added profile sub-menu types (ProfileSubMenu, ObjectPermission, FieldPermission, CustomPermissionAccess, ApexClassAccess, VFPageAccess, ConnectedAppAccess, AssignedAppAccess, ProfileSetupLink) which added ~80 lines to the navigation switch statements. These were extracted to navigation.ts but the remaining orchestration code (React rendering, keyboard handling, search dispatch, settings management) is irreducible.
**Impact:** Window-manager is 918 lines instead of target 800. All extracted modules are well under 400 lines.
**Recommendation:** Further splitting would require separating React rendering, keyboard interception, or search dispatch into their own modules -- which is Phase 3 territory (state migration to Zustand).

### Deviation 2: KEY_PREFIX_MAP duplicated in navigation.ts and record-context.ts

**Found during:** Task 2
**Issue:** Both modules need KEY_PREFIX_MAP independently. Navigation uses it for Classic URL generation, record-context uses it for object resolution.
**Fix:** Accepted duplication to avoid circular dependency. Could be moved to a shared constants module in a future plan.

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated 3 characterization tests for eventHandlers -> eventEmitter rename**
- Tests referenced `eventHandlers` property which was renamed to `eventEmitter` in getDebugInfo
- Commit: 1b18bcb

## Decisions Made

1. TypedEventEmitter uses composition (private field) not inheritance, preserving the string-based public on/off API for backward compatibility
2. Module-level caches (Record objects) replace instance-level caches for record-context functions, with _resetCaches() exported for testing
3. Profile sub-menu types fully extracted to navigation.ts to keep window-manager focused on orchestration

## Known Stubs

None - all extracted functions are fully implemented with production logic.

## Self-Check: PASSED

- All 10 created files exist
- Both task commits (1b18bcb, 6a3937e) verified in git log
- 249 tests pass, zero TypeScript errors
