# Phase 03: Smart ID Navigator - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 03-smart-id-navigator
**Areas discussed:** ID Detection, Record Preview, Preview UI, Performance
**Mode:** Auto (all recommended defaults selected)

---

## ID Detection & Extraction

| Option | Description | Selected |
|--------|-------------|----------|
| Extract from IDs + URLs + mixed text | Comprehensive detection handles all paste scenarios | x |
| Plain IDs only | Only detect raw 15/18-char strings | |

**User's choice:** [auto] Extract from IDs + URLs + mixed text (recommended — handles real-world paste scenarios)

---

## Record Preview Fetch

| Option | Description | Selected |
|--------|-------------|----------|
| REST API with in-memory cache | Use sobjects describe for prefix, sobjects/{type}/{id} for name | x |
| Tooling API | Use Tooling API queries instead | |
| SOQL query | Use generic SOQL to resolve records | |

**User's choice:** [auto] REST API with in-memory cache (recommended — fastest, most standard approach)

---

## Preview UI

| Option | Description | Selected |
|--------|-------------|----------|
| Inline preview replacing EmptyState | Show object type + name in the results area | x |
| Floating tooltip preview | Show preview as a tooltip near the input | |

**User's choice:** [auto] Inline preview replacing EmptyState (recommended — consistent with existing UI patterns)

---

## Performance

| Option | Description | Selected |
|--------|-------------|----------|
| AbortController + dual cache | Cancel in-flight on input change, cache prefixes + records separately | x |
| Debounced fetch only | Simple debounce without AbortController | |

**User's choice:** [auto] AbortController + dual cache (recommended — responsive UI, efficient network use)

---

## Claude's Discretion

- Object icon mapping reuse from HomeScreen TYPE_ICONS
- ID display format in preview
- Loading spinner style

## Deferred Ideas

- Clipboard monitoring outside modal
- Batch ID resolution
- Record preview card (Quick Data Peek)
