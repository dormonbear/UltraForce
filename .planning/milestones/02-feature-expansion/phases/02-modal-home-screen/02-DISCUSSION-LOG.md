# Phase 02: Modal Home Screen - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 02-modal-home-screen
**Areas discussed:** HomeScreen Integration, Pin/Unpin Affordance, Keyboard Navigation, Performance
**Mode:** Auto (all recommended defaults selected)

---

## HomeScreen Integration

| Option | Description | Selected |
|--------|-------------|----------|
| Replace EmptyState type="start" only | Keep EmptyState for all other states | ✓ |
| Replace all EmptyState | Use HomeScreen everywhere | |

**User's choice:** [auto] Replace EmptyState type="start" only (recommended default)
**Notes:** HomeScreen should only appear when query is empty and session is valid.

---

## Pin/Unpin Affordance

| Option | Description | Selected |
|--------|-------------|----------|
| Star icon on hover | Small star in ResultItem, visible on hover | ✓ |
| Pin button in action menu | Add pin to the record actions dropdown | |
| Context menu | Right-click to pin | |

**User's choice:** [auto] Star icon on hover (recommended — matches existing action button pattern)
**Notes:** Filled star = pinned, outline = unpinned. All result types.

---

## Keyboard Navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Mouse-only for HomeScreen | HomeScreen items are click-only; typing starts search | ✓ |
| Full keyboard nav | Arrow keys navigate HomeScreen items | |

**User's choice:** [auto] Mouse-only for HomeScreen (recommended — simpler, typing starts search naturally)
**Notes:** Can add keyboard nav later if users request it.

---

## Performance

| Option | Description | Selected |
|--------|-------------|----------|
| Memoized store reads | useMemo for frecency sort, direct store subscription | ✓ |

**User's choice:** [auto] Memoized store reads (already implemented in HomeScreen.tsx)
**Notes:** No API calls needed — all data from Zustand stores.

---

## Claude's Discretion

- Star icon styling details within ResultItem
- Optional tooltip on first pin interaction

## Deferred Ideas

- Keyboard navigation for HomeScreen items
- Drag-to-reorder favorites
- Animated search tips
