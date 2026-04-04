# Codebase Concerns

**Analysis Date:** 2026-04-04

## Tech Debt

**window-manager.ts God Class:**
- Issue: Single class handles DOM mounting, React rendering, state management, URL building, navigation routing, keyboard setup, record context resolution, layout lookup, user profile resolution, and a custom event emitter. Mixed responsibilities make testing impossible and safe modification extremely hard.
- Files: `src/lib/window-manager.ts` (1715 lines)
- Impact: Any change anywhere in the file risks regressions across unrelated features. The file exceeds the 800-line project maximum by 2x.
- Fix approach: Split into at minimum 5 modules — `url-builder.ts` (setup URL construction, `getSetupHost`, `buildSetupUrl`, `resolveSetupShortcutPath`), `navigation.ts` (handleResultClick, handlePageLayoutNavigation, handleRecordTypeNavigation), `record-context.ts` (getCurrentRecordLayoutInfo, resolveObjectApiNameFromRecord, getCurrentUserId, getCurrentUserProfileId), `setup-shortcuts.ts` (SETUP_SHORTCUTS constant + handleSetupShortcutSearch), and a slimmed-down `window-manager.ts` for DOM/React orchestration only.

**salesforce-api.ts Mixed Concerns:**
- Issue: One file combines metadata type definitions (SOQL queries), fetch orchestration (pagination, caching), field search, custom command execution, profile search delegation, and error formatting.
- Files: `src/lib/salesforce-api.ts` (1206 lines)
- Impact: Difficult to test individual concerns in isolation; any change risks breaking unrelated paths.
- Fix approach: Extract `metadata-types.ts` (METADATA_TYPES constant and fetch helpers per type), `metadata-fetcher.ts` (fetchAllPages, fetchMetadataFromAPI), keeping `salesforce-api.ts` as a thin orchestration facade.

**styles.ts CSS-in-JS String:**
- Issue: 1374-line JS string containing all component CSS, loaded with an external Google Fonts fetch. No CSS modules, no scoping guarantees beyond Shadow DOM.
- Files: `src/components/search/styles.ts` (1374 lines)
- Impact: No IDE autocomplete or lint for CSS values; external font fetch adds latency and fails in air-gapped orgs; large string increases bundle size.
- Fix approach: Migrate to proper CSS or Tailwind; bundle fonts locally or via `@font-face` with a data URI fallback.

**Function Type on Event Emitter:**
- Issue: Event handlers stored as `Set<Function>` and `Map<string, Set<Function>>`, bypassing TypeScript's type system.
- Files: `src/lib/window-manager.ts` lines 266, 1619, 1626
- Impact: No type safety for emitted event payloads; callers cannot discover valid events at compile time.
- Fix approach: Define a typed event map interface and use `(data: EventMap[K]) => void` generic handlers.

**Pervasive `any` Types in Profile and API Code:**
- Issue: `profile-search.ts` uses `any[]` for all return types and record mappings. `salesforce-api.ts` similarly uses `any[]` throughout fetch functions.
- Files: `src/lib/profile-search.ts` (lines 153, 204, 227, 255, 261, 287, 319, 357, 395, 427, 484, 488, 532), `src/lib/salesforce-api.ts` (lines 447, 456, 504, 514, 581, 608, 617, 627, 707)
- Impact: Runtime shape errors are invisible to TypeScript; refactoring without breaking callers is unreliable.
- Fix approach: Define explicit interfaces for Salesforce API record shapes (e.g., `SfApexClass`, `SfFieldDefinition`, `SfProfileRecord`) and replace `any` incrementally.

**`auth.ts` sfRest Uses `any` Return:**
- Issue: `sfRest()` returns `Promise<any>`, meaning every call site is untyped.
- Files: `src/lib/auth.ts` lines 61, 64
- Impact: Type errors in callers are silently suppressed.
- Fix approach: Make `sfRest` generic: `sfRest<T = unknown>(...): Promise<T>`.

## Known TypeScript Errors (6 active, strict mode on)

**ErrorBoundary Missing `children` Prop:**
- Symptoms: TS2769 error at the `React.createElement(ErrorBoundary, ...)` call in `renderComponent`.
- Files: `src/lib/window-manager.ts` line 576
- Trigger: Always present at compile time; does not affect runtime because `children` is passed as the third argument to `createElement`.
- Workaround: None currently; fix by updating `ErrorBoundary`'s props type to mark `children` as optional or use the JSX syntax instead of `React.createElement`.

**`recordContext` Missing in destroy() State Reset:**
- Symptoms: TS2741 in `destroy()` — the reset object literal omits `recordContext`.
- Files: `src/lib/window-manager.ts` line 1675
- Trigger: Always present; the field defaults to `null` and the missing key simply leaves it `undefined` at runtime, which can cause subtle state leaks after destroy/reinit cycles.
- Fix: Add `recordContext: null` to the reset literal.

**`cookieStoreId` Not on Chrome `Tab` Type:**
- Symptoms: TS2339 on `sender.tab?.cookieStoreId` in the background service worker.
- Files: `src/background/index.ts` lines 63, 214
- Trigger: Always present; `cookieStoreId` is a Firefox container tab API, not in the Chrome `@types/chrome` Tab definition.
- Impact: The code works in Chrome at runtime (the field just resolves to `undefined`), but the intent to support Firefox container tabs is incomplete.
- Fix: Add `// @ts-expect-error Firefox container tab API` or extend the type declaration; also document Firefox support status.

**`isBuiltin` Missing in SettingsPanel Custom Command Creation:**
- Symptoms: TS2741 at line 265 of `SettingsPanel.tsx`.
- Files: `src/components/search/SettingsPanel.tsx` line 265
- Fix: Add `isBuiltin: false` to the object literal at creation time.

**`UnsupportedTypesState | null` Assignment:**
- Symptoms: TS2322 — a nullable value assigned to a non-nullable type.
- Files: `src/lib/unsupported-types.ts` line 26
- Fix: Initialize with a default value instead of `null`, or narrow the type before assignment.

## Security Considerations

**Session Token in `fetchAllPages` Authorization Header:**
- Risk: `fetchAllPages` builds fetch requests inline with `Authorization: Bearer ${sessionId}`, duplicating the auth logic already in `sfRest`. If the inline path diverges (e.g., skips host normalization), it could send tokens to unexpected hosts.
- Files: `src/lib/salesforce-api.ts` lines 633-641
- Current mitigation: `normalizeHost()` is called before constructing the URL; the session key is sourced from `getSession()` upstream.
- Recommendation: Route all HTTP calls through `sfRest` to centralize auth handling and host normalization, eliminating the inline fetch.

**Anonymous Apex Execution to Obtain User ID:**
- Risk: `getCurrentUserId()` executes `throw new System.TypeException(UserInfo.getUserId())` via the Tooling API and extracts the user ID from the exception message. This is an unconventional side-channel approach.
- Files: `src/lib/window-manager.ts` lines 1051-1053
- Current mitigation: Wrapped in try/catch; silently fails if the user lacks Author Apex permission.
- Recommendation: Replace with a direct REST call to `/services/data/v{version}/chatter/users/me` or `/services/data/v{version}/query/?q=SELECT+Id+FROM+User+WHERE+Id+=+UserInfo.getUserId()` which are standard and do not require Apex execution.

**Debug Flag Left in Production Code:**
- Risk: `version-check.ts` contains a `DEBUG_FORCE_SHOW = false` flag that, if set to `true` and committed, forces the update notification UI to appear for all users.
- Files: `src/lib/version-check.ts` line 28
- Current mitigation: Value is `false` and the comment is in Chinese.
- Recommendation: Remove the flag and implement forced-show behavior via a build-time environment variable if needed for testing.

## Performance Bottlenecks

**Full Re-render on Every State Mutation:**
- Problem: `window-manager.ts` mutates `this.state` properties directly (e.g., `this.state.isLoading = true`) then calls `await this.renderComponent()` to force a re-render. React's reconciler works correctly, but the pattern bypasses React's own state batching.
- Files: `src/lib/window-manager.ts` lines 621, 636, 665 (and many others throughout `handleSearch`, `handleCustomSearch`, `handleSetupShortcutSearch`)
- Cause: State lives in a plain object on the class instance rather than in React state.
- Improvement path: Move search state into React state within `SearchModal` or adopt a Zustand store; `WindowManager` becomes a thin orchestration layer.

**`generateDataHash` in metadata-cache.ts:**
- Problem: Hash is computed by stringifying `{ id, name }` of every cached record on every `set()` call. For large types like `ApexClass` (up to 50,000 records), this serializes the full array twice (once for hash, once for storage).
- Files: `src/lib/metadata-cache.ts` lines 23-31
- Cause: No incremental or sampling-based approach.
- Improvement path: Sample a subset of records (e.g., first/last 100 + total count) for the hash instead of serializing the full array.

**chrome.storage Scatter Pattern:**
- Problem: Multiple modules each make separate `chrome.storage.local.get` / `set` calls on initialization: `metadata-cache.ts`, `version-check.ts`, `api-stats.ts`, `unsupported-types.ts`, `SearchModal.tsx`, `ErrorBoundary.tsx`, `background/index.ts`. There is no central storage service.
- Files: All files matching `chrome.storage.local.set` across `src/`
- Impact: Race conditions possible when multiple modules write on startup; difficult to audit total storage use.
- Improvement path: Introduce a thin `storage-service.ts` with namespaced keys and batched reads/writes.

## Fragile Areas

**Singleton with Async Initialization Race:**
- Files: `src/lib/window-manager.ts` lines 283-307
- Why fragile: `getInstance()` uses a static `initializationPromise` to prevent double-init, but if `createInstance` fails mid-way, `initializationPromise` is nulled and `instance` remains null — leaving the extension in a broken state until page reload. No error recovery path.
- Safe modification: Always test with rapid repeated keyboard shortcut presses; add a `lastError` static field and expose it in `getDebugInfo()`.

**`getSetupHost` String Replacement Chain:**
- Files: `src/lib/window-manager.ts` lines 157-168
- Why fragile: Multiple chained `.replace()` calls transform the host string. If an org domain matches more than one pattern (unlikely but possible with future Salesforce domain formats), the first replace fires and subsequent ones silently no-op.
- Safe modification: Use early returns per pattern match rather than a chain. Add a test for each known domain variant.

**KEY_PREFIX_MAP Static List:**
- Files: `src/lib/window-manager.ts` lines 47-67
- Why fragile: Hardcoded 3-character key prefixes for standard objects. New Salesforce standard objects or custom prefixes not in this list fall through to a dynamic REST lookup. If the REST call fails, Classic mode navigation silently returns `null`.
- Safe modification: Do not add to this list; rely on the dynamic lookup as the authoritative source.

**Background Refresh Without Deduplication Guard for Concurrent Initiators:**
- Files: `src/lib/metadata-cache.ts` lines 67-69, `triggerBackgroundRefresh`
- Why fragile: `triggerBackgroundRefresh` is called every time a stale cache hit occurs. If multiple searches fire simultaneously after the 2-hour threshold, multiple background refreshes can run concurrently for the same type. The `refreshPromises` map deduplicates per key, but the key includes `orgId + metadataType` — verify this map is being checked before starting a new refresh.

## Test Coverage Gaps

**window-manager.ts: Zero Unit Test Coverage:**
- What's not tested: Navigation routing, record context detection, URL building, setup shortcut search, page layout resolution, record type navigation, user ID / profile ID fetching via Apex.
- Files: `src/lib/window-manager.ts` — no corresponding `.test.ts` file exists
- Risk: Any refactoring of the largest file in the codebase has no automated safety net.
- Priority: High

**salesforce-api.ts: No Unit Tests:**
- What's not tested: `fetchAllPages` pagination, cache hit/miss paths in `getMetadataWithCache`, custom command execution, `formatCustomCommandError`, `buildCustomResultDescription`.
- Files: `src/lib/salesforce-api.ts` — no corresponding `.test.ts` file exists
- Risk: Silent regressions in search result mapping or pagination are undetectable without E2E tests.
- Priority: High

**metadata-cache.ts: No Unit Tests:**
- What's not tested: TTL expiry, quota-exceeded retry, cleanup-for-quota eviction, background refresh deduplication.
- Files: `src/lib/metadata-cache.ts`
- Risk: Cache corruption or quota errors only surface in production environments.
- Priority: Medium

**SearchModal.tsx: No Component Tests:**
- What's not tested: Settings persistence, keyboard navigation within results, fuzzy toggle behavior, error state rendering.
- Files: `src/components/search/SearchModal.tsx` (724 lines)
- Risk: UI regressions only caught by manual or E2E testing.
- Priority: Medium

## Scaling Limits

**Chrome Storage Quota:**
- Current capacity: `chrome.storage.local` limit is 10 MB; `CACHE_CONFIG.MAX_CACHE_SIZE` is set to 10 MB matching the limit.
- Limit: Orgs with many metadata types cached simultaneously (e.g., 50,000 Apex classes + 10,000 flows + labels + users) can exceed 10 MB. The cleanup logic evicts the oldest 50% when quota is exceeded, which means a large org will permanently fail to cache all types.
- Scaling path: Compress cached data (e.g., JSON minification or LZ-string compression); or store only the MiniSearch index rather than raw records.

**Report/Dashboard Fetch Hard-Capped at 100:**
- Current capacity: `METADATA_TYPES.Report.query` has `LIMIT 100`; `METADATA_TYPES.Dashboard` likewise.
- Limit: Orgs with more than 100 reports silently return incomplete results.
- Scaling path: Increase limit or implement pagination for these types; add a user-facing indicator when results may be truncated.

---

*Concerns audit: 2026-04-04*
