# Research Summary: UltraForce Architecture & Quality Milestone

**Domain:** Chrome Extension Refactoring & Test Coverage
**Researched:** 2026-04-04
**Overall confidence:** HIGH

## Executive Summary

The UltraForce Chrome extension has a clear refactoring path. The existing stack (Plasmo 0.90.5, React 18, TypeScript 5.9, Vitest 4.x, Playwright 1.57) is current and should not change. The only new production dependency needed is Zustand 5.0.12 for state management, replacing the untestable WindowManager singleton pattern. Two dev dependencies are needed: vitest-chrome for complete Chrome API mocking (replacing the hand-rolled partial mock), and @vitest/coverage-v8 for enforcing the 80% coverage threshold.

The two god classes (window-manager.ts at 1715 lines, salesforce-api.ts at 1206 lines) should be decomposed into 8-10 focused modules following a pure-functions-first extraction order. This order is critical: extract pure functions (url-builder, setup-shortcuts) first because they need zero mocking to test, then stateless logic (navigation), then stateful modules (record-context, stores). Each extraction is one commit that must pass all existing E2E tests.

CSS migration from the 1374-line styles.ts should use Plasmo's native `getStyle` + `data-text` import pattern to inject plain CSS into the Shadow DOM. Tailwind CSS was considered and rejected: the migration cost is high for zero visual change, and Shadow DOM requires `:root` to `:host` CSS variable replacement. Google Fonts should be bundled locally as a woff2 file.

The biggest risks are: breaking the Shadow DOM style contract during CSS migration, circular dependencies after module splits, and Zustand/Chrome storage sync issues across tabs. All are preventable with the patterns documented in ARCHITECTURE.md and PITFALLS.md.

## Key Findings

**Stack:** Keep everything. Add zustand, vitest-chrome, @vitest/coverage-v8. No framework changes.
**Architecture:** Split 2 god classes into 8-10 modules. 3 Zustand stores (search, settings, session). Facade pattern during migration.
**Critical pitfall:** Big bang decomposition -- extract one module per commit, pure functions first.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Foundation** - Fix TS errors, add vitest-chrome + coverage, enable no-explicit-any as warn
   - Addresses: 6 TS errors, test infrastructure gaps
   - Avoids: Starting refactoring without safety net

2. **Module Extraction** - Split window-manager.ts and salesforce-api.ts
   - Addresses: God class decomposition, testable modules
   - Avoids: Big bang refactor pitfall (one module per commit)

3. **Test Coverage** - Unit tests for all extracted modules, component tests for SearchModal
   - Addresses: 80% coverage target
   - Avoids: Coverage without quality (enforce branch thresholds)

4. **State Migration** - Introduce Zustand stores, centralized storage service
   - Addresses: Untestable singleton state, scattered chrome.storage
   - Avoids: Full migration in one shot (settings first, then search state)

5. **CSS & Cleanup** - Extract styles.ts, bundle fonts, remove legacy code
   - Addresses: CSS-in-JS debt, external font dependency, dead AngularJS code
   - Avoids: Shadow DOM style breakage (use Plasmo getStyle pattern)

**Phase ordering rationale:**
- Phase 1 first because refactoring without tests is dangerous; TS fixes are quick wins that build momentum
- Phase 2 before Phase 3 because you cannot meaningfully test god classes; extraction creates testable units
- Phase 4 after Phase 3 because Zustand migration benefits from test coverage as a safety net
- Phase 5 last because CSS migration is independent and lowest risk to core functionality

**Research flags for phases:**
- Phase 2: May need deeper research on specific circular dependency patterns in window-manager.ts
- Phase 4: May need deeper research on Zustand + Plasmo content script lifecycle interaction
- Phase 5: Standard patterns, unlikely to need additional research

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified via npm/official releases; Zustand 5.x is stable |
| Features | HIGH | Directly derived from PROJECT.md requirements and CONCERNS.md analysis |
| Architecture | HIGH | Module split plan is well-defined; patterns are standard TypeScript refactoring |
| Pitfalls | HIGH | Based on official Plasmo docs, Chrome extension testing docs, and real-world migration reports |

## Gaps to Address

- Plasmo's exact behavior when content script modules import from each other (need to verify no bundle splitting issues)
- Whether vitest-chrome supports the latest @types/chrome 0.1.4 type definitions (version compatibility)
- Exact Chrome storage quota usage in production orgs with many metadata types (may need compression research later)
