# Domain Pitfalls

**Domain:** Chrome Extension Refactoring & Quality
**Researched:** 2026-04-04

## Critical Pitfalls

Mistakes that cause rewrites or major regressions.

### Pitfall 1: Big Bang God Class Decomposition

**What goes wrong:** Attempting to split window-manager.ts (1715 lines) in a single PR/phase. One incorrect extraction breaks the entire extension with no safe rollback.
**Why it happens:** Desire to "get it done" quickly. The class has deep internal coupling -- methods reference `this.state`, `this.renderComponent()`, and other methods freely.
**Consequences:** Broken extension for users; lost confidence in refactoring; revert to god class.
**Prevention:** Extract one module per commit. Order by dependency depth: pure functions first (url-builder), then constants (setup-shortcuts), then stateless logic (navigation), then stateful (record-context). Each commit must pass all existing E2E tests.
**Detection:** If a single PR touches more than 3 files in the split, it is too large.

### Pitfall 2: Breaking the Shadow DOM Style Contract

**What goes wrong:** When migrating styles.ts to CSS files, the CSS is loaded outside the Shadow DOM (in the page head instead of inside the shadow root). All styles stop working or leak into the host page.
**Why it happens:** Plasmo's CSUI style injection requires the `getStyle` export pattern with `data-text` imports. Normal CSS imports go to the page head, not the Shadow DOM.
**Consequences:** Extension UI becomes invisible or corrupts the Salesforce page layout.
**Prevention:** Use Plasmo's documented pattern: `import cssText from 'data-text:./styles.css'` and export `getStyle()` that creates a `<style>` element with `cssText`. Test visually after migration.
**Detection:** If `document.querySelector('plasmo-csui').shadowRoot.querySelector('style')` returns null, styles are not in the Shadow DOM.

### Pitfall 3: Zustand Store Losing Sync with Chrome Storage

**What goes wrong:** Zustand's in-memory state and chrome.storage.local diverge. User changes settings in one tab, other tabs show stale values. Or: extension restarts and Zustand hydrates with outdated data.
**Why it happens:** Zustand's persist middleware writes asynchronously. If the extension unloads before the write completes, data is lost. Chrome storage has no change notification to other tabs by default.
**Consequences:** Inconsistent settings across tabs; user frustration.
**Prevention:** Use `chrome.storage.onChanged` listener to sync stores across tabs. Keep the persist middleware's `partialize` option to only persist what needs persisting. For critical writes, await the storage set before proceeding.
**Detection:** Open extension in two Salesforce tabs, change a setting in one, check the other.

### Pitfall 4: Removing WindowManager Methods Before All Callers Migrate

**What goes wrong:** A method is moved to a new module but `SearchModal.tsx` or other callers still reference `windowManager.oldMethod()`. Runtime crash.
**Why it happens:** TypeScript does not catch missing methods on class instances when the class still exists. The method just becomes `undefined` at runtime.
**Consequences:** Extension crashes when user performs the action that calls the removed method.
**Prevention:** Use the Facade pattern during migration: keep old methods on WindowManager that delegate to new modules. Only remove old methods after ALL callers are updated and tests pass. Search for method name across entire codebase before removal.
**Detection:** `grep -r 'windowManager\.' src/` should show zero references to migrated methods.

## Moderate Pitfalls

### Pitfall 5: Chrome API Mock Gaps Breaking Tests

**What goes wrong:** Unit tests pass with mocked Chrome APIs but the mocks are incomplete. Real Chrome APIs behave differently (e.g., `chrome.storage.local.get` returns an object, not the value directly). Tests give false confidence.
**Prevention:** Use vitest-chrome (typed mocks based on @types/chrome) instead of hand-rolled mocks. For critical paths, also verify with E2E tests in a real Chrome instance.

### Pitfall 6: Coverage Number Without Coverage Quality

**What goes wrong:** 80% line coverage is achieved by testing happy paths only. Edge cases (error handling, quota exceeded, network timeouts) remain untested. A production bug hits an untested path.
**Prevention:** Enforce branch coverage threshold (70% minimum) in addition to line coverage. Explicitly test: error paths, empty results, quota exceeded, network failures, malformed API responses.

### Pitfall 7: `any` Removal Introduces Runtime Crashes

**What goes wrong:** Replacing `any` with a specific interface, but the actual Salesforce API response has a different shape (extra fields, missing fields, different casing). TypeScript compiles fine but runtime crashes.
**Prevention:** Log actual API responses for each Salesforce metadata type before defining interfaces. Use `Partial<>` for optional fields. Never use `as` without a `// SAFETY:` comment explaining why the cast is correct. Add runtime shape validation at the API boundary (optional but recommended for critical types).

### Pitfall 8: Circular Dependencies After Module Split

**What goes wrong:** After splitting window-manager.ts, module A imports from module B which imports from module A. Build fails or results in `undefined` at runtime.
**Why it happens:** The god class naturally has circular references within itself. When split, these become cross-module cycles.
**Prevention:** Draw the dependency graph before splitting. If A and B need each other, extract the shared concern into module C. Common pattern: both navigation and record-context need URL building -- url-builder becomes the shared dependency.

## Minor Pitfalls

### Pitfall 9: Forgetting to Update Path Aliases

**What goes wrong:** New modules are created in `src/lib/` but path aliases in `tsconfig.json` and `vitest.config.ts` are not updated. Imports break in tests or at build time.
**Prevention:** Existing `~lib/*` alias already covers `src/lib/*`. Only add new aliases if creating new top-level directories.

### Pitfall 10: Google Fonts External Dependency

**What goes wrong:** When extracting styles.ts to CSS, the `@import url('https://fonts.googleapis.com/...')` is preserved. Air-gapped Salesforce orgs (government, military) cannot load the font, causing layout shifts.
**Prevention:** Bundle the font file locally as a woff2 asset. Use `@font-face` with a data URI or a bundled file reference. Plasmo supports static assets in the `assets/` directory.

### Pitfall 11: Test Setup File Ordering

**What goes wrong:** vitest-chrome mocks Chrome APIs globally, but a specific test file also mocks `chrome.storage` locally. The local mock overrides the global one inconsistently.
**Prevention:** Use `vi.mocked()` to access the global mock's implementation. For test-specific behavior, use `chrome.storage.local.get.mockResolvedValueOnce()` instead of reassigning the mock.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Module extraction | Circular dependencies (#8) | Map dependency graph first |
| Module extraction | Callers still reference old methods (#4) | Facade pattern during migration |
| CSS migration | Shadow DOM style contract (#2) | Use Plasmo getStyle pattern |
| CSS migration | Google Fonts dependency (#10) | Bundle font locally |
| Zustand migration | Storage sync across tabs (#3) | chrome.storage.onChanged listener |
| Type safety | Runtime crashes from wrong interfaces (#7) | Log actual API shapes first |
| Test coverage | Coverage without quality (#6) | Branch coverage threshold |
| Test infrastructure | Mock gaps (#5) | Use vitest-chrome |

## Sources

- [Chrome Extension Unit Testing](https://developer.chrome.com/docs/extensions/how-to/test/unit-testing) -- Official guidance on mocking Chrome APIs
- [Plasmo CSUI Styling](https://docs.plasmo.com/framework/content-scripts-ui/styling) -- Shadow DOM CSS injection
- [TypeScript strict migration lessons](https://dev.to/alexrogovjs/how-we-migrated-200k-lines-from-js-to-strict-typescript-3odd) -- Real-world `any` removal pitfalls
- [Zustand persist middleware](https://github.com/pmndrs/zustand) -- Chrome storage adapter caveats
