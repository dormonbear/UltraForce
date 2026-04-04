# Feature Landscape: Refactoring & Quality Milestone

**Domain:** Chrome Extension Architecture Refactoring
**Researched:** 2026-04-04

## Table Stakes

Features that must be delivered for this milestone to succeed. Missing any = milestone incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Split window-manager.ts into 5+ modules | God class (1715 lines) is untestable and fragile | High | url-builder, navigation, record-context, setup-shortcuts, core orchestration |
| Split salesforce-api.ts into 3+ modules | Mixed concerns (1206 lines) block isolated testing | Medium | metadata-types, metadata-fetcher, orchestration facade |
| 80%+ unit test coverage | Project requirement; two largest files have zero tests | High | Requires refactoring first to make code testable |
| Fix all 6 TypeScript errors | Active type errors undermine strict mode value | Low | ErrorBoundary, recordContext, cookieStoreId x2, isBuiltin, null assignment |
| Migrate state to Zustand | WindowManager singleton bypasses React batching; untestable | Medium | Enables proper React state management and testability |
| Extract styles.ts to plain CSS | 1374-line CSS-in-JS string with external font dependency | Medium | Use Plasmo getStyle pattern; bundle fonts locally |
| Centralized storage service | Scattered chrome.storage calls create race conditions | Medium | Thin wrapper with namespaced keys and batched reads |
| Replace pervasive `any` types | Type safety gaps hide runtime bugs during refactoring | Medium | Define Salesforce API record interfaces; make sfRest generic |

## Differentiators

Not required for milestone success, but significantly improve codebase quality.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Typed event emitter | Compile-time event safety; discoverable events | Low | Replace `Set<Function>` with generic typed emitter |
| Route all HTTP through sfRest | Single auth path eliminates token-to-wrong-host risk | Low | Eliminate inline fetch in fetchAllPages |
| Replace Apex user ID hack | Standard REST endpoint is more reliable and secure | Low | Use `/chatter/users/me` instead of thrown exception parsing |
| Remove DEBUG_FORCE_SHOW flag | Eliminate production risk of accidental activation | Low | Use build-time env var if testing needed |
| Remove legacy AngularJS code | Reduce confusion and bundle size | Low | Verify no remaining references first |
| Enable no-explicit-any lint rule | Prevent regression of type safety improvements | Low | Start as `warn`, escalate to `error` |

## Anti-Features

Things to explicitly NOT build during this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| New user-facing features | Scope creep; milestone is quality-only | Defer to next milestone |
| Tailwind CSS migration | High effort for zero visual change; Shadow DOM caveats | Extract to plain CSS files |
| React 19 upgrade | Plasmo 0.90.x does not support React 19 yet | Stay on React 18.3.x |
| Full Zustand migration in one phase | Too risky; WindowManager touches everything | Incremental: settings first, then search state |
| Vitest Browser Mode for unit tests | Overkill for mocked Chrome API tests | Keep jsdom + vitest-chrome for units; Playwright for E2E |
| Performance optimization | Search/cache performance is not a problem right now | Defer unless refactoring reveals easy wins |

## Feature Dependencies

```
Fix TS errors ──────────────────────────────────────> Enable no-explicit-any lint
Split window-manager.ts ──> Add window-manager tests ──> 80% coverage
Split salesforce-api.ts ──> Add salesforce-api tests ──> 80% coverage
                                                    ──> Add metadata-cache tests
Extract styles.ts to CSS ──> (independent, can parallel)
Centralized storage service ──> Zustand with persist middleware
                           ──> metadata-cache refactor
Replace `any` types ──> Make sfRest generic ──> Type-safe fetch layer
```

## MVP Recommendation (Minimum Viable Milestone)

**Must complete (milestone fails without these):**
1. Split window-manager.ts (enables all testing)
2. Split salesforce-api.ts (enables all testing)
3. Add unit tests for extracted modules (achieves 80%)
4. Fix all 6 TypeScript errors (baseline quality)
5. Zustand for state management (core architecture fix)

**Should complete (high value, low risk):**
6. Extract styles.ts to plain CSS
7. Centralized storage service
8. Replace `any` types with interfaces

**Defer if time-constrained:**
9. Typed event emitter
10. Legacy AngularJS removal
11. Enable no-explicit-any as `error`
