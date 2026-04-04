# Phase 2: Module Extraction & Type Safety - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-04
**Phase:** 02-module-extraction-type-safety
**Areas discussed:** Extraction strategy, Module boundaries, Type definitions, Event emitter

---

## Extraction Strategy

### Import handling

| Option | Description | Selected |
|--------|-------------|----------|
| Facade re-export | Old file becomes thin re-export facade. External importers unchanged. Lowest risk. | ✓ |
| Clean break | Update all import sites in one go. Old file deleted. Cleaner but higher risk. | |

**User's choice:** Facade re-export
**Notes:** Characterization tests pass without import changes.

### Extraction order

| Option | Description | Selected |
|--------|-------------|----------|
| Pure functions first | url-builder -> setup-shortcuts -> record-context -> navigation -> core. Stateless first. | ✓ |
| Biggest impact first | Extract whatever reduces line count most first. Faster visible progress. | |

**User's choice:** Pure functions first
**Notes:** Aligns with Phase 1 research recommendation.

### Plan sequencing

| Option | Description | Selected |
|--------|-------------|----------|
| Separate plans | Plan 1: window-manager extraction. Plan 2: salesforce-api extraction. Plan 3: type safety + tests. | ✓ |
| Combined plans | Fewer but larger plans. Harder to isolate regressions. | |

**User's choice:** Separate plans

---

## Module Boundaries

### window-manager.ts split

| Option | Description | Selected |
|--------|-------------|----------|
| Accept 5-module split | url-builder, setup-shortcuts, record-context, navigation, core orchestration | ✓ |
| Merge record-context into navigation | Reduces to 4 modules but larger navigation (~500 lines) | |

**User's choice:** Accept proposed 5-module split

### Cross-module communication

| Option | Description | Selected |
|--------|-------------|----------|
| Direct imports | Modules import each other directly. Simple, explicit, tree-shakeable. | ✓ |
| All through orchestrator | Extracted modules never import each other. More indirection. | |

**User's choice:** Direct imports

### profile-search.ts scope

| Option | Description | Selected |
|--------|-------------|----------|
| Leave as-is | Already separate file with tests. TYPE-01 without restructuring. | ✓ |
| Refactor too | Tightly coupled to salesforce-api. Consistent patterns but adds scope. | |

**User's choice:** Leave profile-search as-is

---

## Type Definitions

**User's choice:** Delegated to Claude ("you decide")
**Notes:** Claude decided: co-located types with modules, sfRest<T> in Phase 2, interface granularity follows SOQL query shape.

---

## Event Emitter (MODL-03)

**User's choice:** Delegated to Claude ("you decide")
**Notes:** Claude decided: custom lightweight typed implementation (~50 lines), no external library.

---

## Claude's Discretion

- Type definition location (co-located with modules)
- sfRest generic timing (Phase 2)
- Interface granularity (SOQL query shape)
- Event emitter approach (custom typed, no library)
- SearchModal component test approach
- metadata-cache.ts test strategy

## Deferred Ideas

None — discussion stayed within phase scope
