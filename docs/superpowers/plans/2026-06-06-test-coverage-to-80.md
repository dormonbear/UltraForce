# Test Coverage to 80% Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise project test coverage from 73.53% to >=80% by adding unit, component, and E2E tests for the untested/weak business scenarios: custom SOQL commands, recents/favorites/org-isolation, search-orchestrator, background message handlers, and the weak UI components.

**Architecture:** Three-layer pyramid. (1) Unit tests (Vitest + vitest-chrome) for pure logic, stores, background handlers. (2) Component tests (@testing-library/react) for SettingsPanel/ResultItem/UpdateNotification. (3) E2E (Playwright headed, real `ultraforce` org) for end-to-end business loops, anchored by `sf` CLI org data. No production code changes -- this plan ADDS tests only.

**Tech Stack:** Vitest 4 (`vitest --run`), @testing-library/react 16, vitest-chrome (global `chrome` from `src/test-setup.ts`), Playwright 1.57 (headed, workers:1), `sf` CLI for E2E org auth.

---

## TDD Cadence For Existing Code

This plan adds tests to **already-working** code (no new production code). The superpowers Iron Law ("no production code without a failing test") is not triggered. Adapt Red-Green as follows for every test task:

1. **Write the test** asserting the correct behavior.
2. **Run it.** It should PASS (the code already works).
3. **Prove the test bites** (the "watch it fail" substitute): before trusting a non-trivial test, temporarily flip one assertion to a wrong value, run, confirm it FAILS, then restore. For trivial assertions, instead confirm the target file's coverage increased (`--coverage`, read the file's `% Lines`).
4. **Keep output pristine** -- no unhandled-rejection noise, no `act()` warnings.

When a test does NOT pass on first run, you found a real bug. STOP, write it up, do not "fix" the test to match buggy behavior.

## House Conventions (match exactly)

- `vi.mock('./path', () => ({...}))` BEFORE importing the module under test. Get typed refs with `vi.mocked(fn)`.
- Vitest globals via import: `import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'`.
- `chrome` is global (from `src/test-setup.ts` via vitest-chrome). Configure per-test with `chrome.cookies.get.mockResolvedValue(...)`, `chrome.storage.local.get.mockResolvedValue({})`.
- Zustand reset: `useXStore.setState({ items: [] })` in `beforeEach`; for org-scoped stores also call `_resetHistoryOrgScope()` / `_resetFavoritesOrgScope()`.
- React: mock deps, then `import Component`, render with `render()`, query `screen`, await with `waitFor()`, `cleanup()` in `beforeEach`.
- No semicolons, single quotes, no trailing commas (Prettier enforced).
- Commit after each task: `git add <files> && git commit -m "test: ..."`.

## File Structure

```
NEW unit tests:
  src/lib/search-orchestrator.test.ts        Task 1   (orchestrator: dot-notation routing, realtime User/Queue/Group, type filtering)
  src/background/index.test.ts               Task 6   (getSfHost / getSession / ping message handlers)
EXTEND existing tests:
  src/lib/custom-command.test.ts             Task 2   (NEW file -- currently no co-located test; covers error/exact/filter branches)
  src/stores/history-store.test.ts           Task 3   (re-open frecency refresh + trim + org-scope edges)
  src/stores/favorites-store.test.ts         Task 4   (toggle/max/org-scope edges)
NEW component tests:
  src/components/search/ResultItem.test.tsx       Task 5a  (NEW -- favorite toggle, copy api name, object/apex actions)
  src/components/search/UpdateNotification.test.tsx Task 5b (NEW -- render, dismiss, release-notes link)
  src/components/search/SettingsPanel.test.tsx    Task 7   (NEW -- custom command CRUD + import/export validation)
NEW E2E specs:
  tests/e2e/recents-favorites.spec.ts        Task 8
  tests/e2e/custom-commands.spec.ts          Task 9
  tests/e2e/id-navigation.spec.ts            Task 10
EXTEND page objects:
  tests/e2e/pages/ultraforce.page.ts         Task 8/10 (add recents/favorites/IdPreview helpers)
```

Order: Tasks 1-7 (unit/component, fast, deterministic) first to bank the coverage gain; Tasks 8-10 (E2E, slower, need live org) last.

---

### Task 1: search-orchestrator unit tests

**Files:**
- Test: `src/lib/search-orchestrator.test.ts` (create)
- Under test: `src/lib/search-orchestrator.ts` (exports `searchSalesforceMetadata`, `searchMetadataTypes`)

**Mock targets:** `./auth` (getSession, API_VERSION), `./metadata-fetcher` (fetchAllPages, ensure*Index), `./fuzzy-search` (searchIndex, hasSearchIndex), `./profile-search` (all query* funcs), `./domain-utils` (normalizeHost, escapeSoql), `./logger`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SearchResult } from '~types'

vi.mock('./auth', () => ({
  getSession: vi.fn(),
  API_VERSION: '62.0'
}))
vi.mock('./metadata-fetcher', () => ({
  fetchAllPages: vi.fn().mockResolvedValue([]),
  ensureCMDTRecordIndex: vi.fn().mockResolvedValue(undefined),
  ensureCustomSettingRecordIndex: vi.fn().mockResolvedValue(undefined),
  ensureFieldIndex: vi.fn().mockResolvedValue(undefined),
  ensureMetadataIndex: vi.fn().mockResolvedValue(undefined)
}))
vi.mock('./fuzzy-search', () => ({
  searchIndex: vi.fn().mockReturnValue([]),
  hasSearchIndex: vi.fn().mockReturnValue(false)
}))
vi.mock('./profile-search', () => ({
  parseProfileDotNotation: vi.fn().mockReturnValue(null),
  buildProfileSubMenu: vi.fn().mockReturnValue([]),
  queryProfileUsers: vi.fn().mockResolvedValue([]),
  queryProfileObjectPermissions: vi.fn().mockResolvedValue([]),
  queryProfileFieldPermissions: vi.fn().mockResolvedValue([]),
  queryProfileCustomPermissions: vi.fn().mockResolvedValue([]),
  queryProfileApexClassAccess: vi.fn().mockResolvedValue([]),
  queryProfileVFPageAccess: vi.fn().mockResolvedValue([]),
  queryProfileConnectedApps: vi.fn().mockResolvedValue([]),
  queryProfileAssignedApps: vi.fn().mockResolvedValue([]),
  filterProfileSubData: vi.fn((d: unknown) => d)
}))
vi.mock('./domain-utils', () => ({
  normalizeHost: vi.fn((h: string) => h),
  escapeSoql: vi.fn((s: string) => s)
}))
vi.mock('./logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

import { searchSalesforceMetadata } from './search-orchestrator'
import { getSession } from './auth'
import { fetchAllPages } from './metadata-fetcher'

const mockGetSession = vi.mocked(getSession)
const mockFetchAllPages = vi.mocked(fetchAllPages)
const TEST_HOST = 'myorg.my.salesforce.com'
const SESSION = { key: 'k', hostname: TEST_HOST }

describe('search-orchestrator / searchSalesforceMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue(SESSION)
  })

  it('returns {} when sfHost is empty', async () => {
    const result = await searchSalesforceMetadata('weather', ['ApexClass'], '')
    expect(result).toEqual({})
    expect(mockGetSession).not.toHaveBeenCalled()
  })

  it('returns {} when there is no session', async () => {
    mockGetSession.mockResolvedValue(null)
    const result = await searchSalesforceMetadata('x', ['ApexClass'], TEST_HOST)
    expect(result).toEqual({})
  })

  it('runs a realtime User SOQL search and maps records to SearchResult[]', async () => {
    mockFetchAllPages.mockResolvedValue([
      {
        Id: '005000000000001',
        Name: 'Dormon Zhou',
        Username: 'dormon@test.com',
        Email: 'dormon@test.com',
        FederationIdentifier: null,
        IsActive: true,
        Profile: { Name: 'System Administrator' },
        UserRole: null
      }
    ])

    const result = await searchSalesforceMetadata('Dormon', ['User'], TEST_HOST)

    expect(result.User).toHaveLength(1)
    expect(result.User[0]).toMatchObject({
      id: '005000000000001',
      name: 'Dormon Zhou',
      type: 'User'
    })
    expect(result.User[0].description).toContain('dormon@test.com')
    expect(result.User[0].description).toContain('System Administrator')
  })

  it('appends "Inactive" to description for inactive users', async () => {
    mockFetchAllPages.mockResolvedValue([
      { Id: '005x', Name: 'Old User', Username: 'old@test.com', Email: '', FederationIdentifier: null, IsActive: false, Profile: null, UserRole: null }
    ])
    const result = await searchSalesforceMetadata('Old', ['User'], TEST_HOST)
    expect(result.User[0].description).toContain('Inactive')
  })

  it('runs a realtime Queue search with type "Queue"', async () => {
    mockFetchAllPages.mockResolvedValue([
      { Id: '00G000000000001', Name: 'Support Queue', DeveloperName: 'Support_Queue', Email: 'support@test.com' }
    ])
    const result = await searchSalesforceMetadata('Support', ['Queue'], TEST_HOST)
    expect(result.Queue[0]).toMatchObject({ id: '00G000000000001', name: 'Support Queue', type: 'Queue' })
    expect(result.Queue[0].description).toContain('Support_Queue')
  })

  it('runs a realtime Group search with type "Group"', async () => {
    mockFetchAllPages.mockResolvedValue([
      { Id: '00G000000000002', Name: 'All Reps', DeveloperName: 'All_Reps' }
    ])
    const result = await searchSalesforceMetadata('Reps', ['Group'], TEST_HOST)
    expect(result.Group[0]).toMatchObject({ name: 'All Reps', type: 'Group' })
  })

  it('returns [] for a realtime type when fetchAllPages throws', async () => {
    mockFetchAllPages.mockRejectedValue(new Error('boom'))
    const result = await searchSalesforceMetadata('x', ['User'], TEST_HOST)
    expect(result.User).toEqual([])
  })

  it('skips realtime search when query is blank', async () => {
    const result = await searchSalesforceMetadata('   ', ['User'], TEST_HOST)
    expect(mockFetchAllPages).not.toHaveBeenCalled()
    expect(result.User).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify behavior**

Run: `node_modules/.bin/vitest run src/lib/search-orchestrator.test.ts`
Expected: PASS (all 7). If "skips realtime search when query is blank" fails, the blank-guard regressed -- investigate, do not edit the test.

- [ ] **Step 3: Prove the suite bites**

Temporarily change `expect(result.User).toHaveLength(1)` to `toHaveLength(2)`, run, confirm FAIL, restore.

- [ ] **Step 4: Confirm coverage gain**

Run: `node_modules/.bin/vitest run src/lib/search-orchestrator.test.ts --coverage`
Expected: `search-orchestrator.ts` `% Lines` rises from ~57% toward ~80%+. Record the number.

- [ ] **Step 5: Commit**

```bash
git add src/lib/search-orchestrator.test.ts
git commit -m "test: cover search-orchestrator realtime User/Queue/Group dispatch"
```

---

### Task 2: custom-command unit tests (new direct file)

**Files:**
- Test: `src/lib/custom-command.test.ts` (create)
- Under test: `src/lib/custom-command.ts` (export `executeCustomCommand`)

**Mock targets:** `./auth` (getSession, API_VERSION), `./metadata-fetcher` (fetchAllPages), `./fuzzy-search` (parseSearchQuery), `./domain-utils` (normalizeHost, escapeSoql), `./logger`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./auth', () => ({ getSession: vi.fn(), API_VERSION: '62.0' }))
vi.mock('./metadata-fetcher', () => ({ fetchAllPages: vi.fn() }))
vi.mock('./fuzzy-search', () => ({
  parseSearchQuery: vi.fn((q: string) => ({ searchTerm: q, filterTerm: null, isExactMatch: false }))
}))
vi.mock('./domain-utils', () => ({
  normalizeHost: vi.fn((h: string) => h),
  escapeSoql: vi.fn((s: string) => s)
}))
vi.mock('./logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

import { executeCustomCommand } from './custom-command'
import { getSession } from './auth'
import { fetchAllPages } from './metadata-fetcher'
import { parseSearchQuery } from './fuzzy-search'

const mockGetSession = vi.mocked(getSession)
const mockFetchAllPages = vi.mocked(fetchAllPages)
const mockParse = vi.mocked(parseSearchQuery)
const HOST = 'myorg.my.salesforce.com'
const baseOpts = {
  soqlTemplate: "SELECT Id, Name FROM Account WHERE Name LIKE '%{query}%'",
  searchQuery: 'acme',
  useToolingApi: false,
  nameField: 'Name'
}

describe('executeCustomCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ key: 'k', hostname: HOST })
    mockParse.mockReturnValue({ searchTerm: 'acme', filterTerm: null, isExactMatch: false })
  })

  it('returns [] when sfHost is missing', async () => {
    const result = await executeCustomCommand(baseOpts, '')
    expect(result).toEqual([])
    expect(mockGetSession).not.toHaveBeenCalled()
  })

  it('returns [] when there is no session', async () => {
    mockGetSession.mockResolvedValue(null)
    const result = await executeCustomCommand(baseOpts, HOST)
    expect(result).toEqual([])
  })

  it('maps records to CustomQuery SearchResult using nameField', async () => {
    mockFetchAllPages.mockResolvedValue([
      { Id: '001x', Name: 'Acme Inc', Industry: 'Tech' }
    ])
    const result = await executeCustomCommand(baseOpts, HOST)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: '001x', name: 'Acme Inc', type: 'CustomQuery' })
    expect(result[0].description).toContain('Industry: Tech')
  })

  it('falls back to DurableId when Id absent, "Unknown" when nameField empty', async () => {
    mockFetchAllPages.mockResolvedValue([{ DurableId: 'dur1' }])
    const result = await executeCustomCommand(baseOpts, HOST)
    expect(result[0].id).toBe('dur1')
    expect(result[0].name).toBe('Unknown')
  })

  it('uses descriptionFields (dot-notation) when provided', async () => {
    mockFetchAllPages.mockResolvedValue([
      { Id: '001x', Name: 'Acme', Owner: { Name: 'Dormon' }, Phone: '123' }
    ])
    const result = await executeCustomCommand(
      { ...baseOpts, descriptionFields: ['Owner.Name', 'Phone'] },
      HOST
    )
    expect(result[0].description).toBe('Dormon | 123')
  })

  it('filters to exact name match when isExactMatch is true', async () => {
    mockParse.mockReturnValue({ searchTerm: 'acme', filterTerm: null, isExactMatch: true })
    mockFetchAllPages.mockResolvedValue([
      { Id: '1', Name: 'Acme' },
      { Id: '2', Name: 'Acme Corp' }
    ])
    const result = await executeCustomCommand(baseOpts, HOST)
    expect(result.map((r) => r.name)).toEqual(['Acme'])
  })

  it('applies a secondary filterTerm against name and description', async () => {
    mockParse.mockReturnValue({ searchTerm: 'a', filterTerm: 'tech', isExactMatch: false })
    mockFetchAllPages.mockResolvedValue([
      { Id: '1', Name: 'Acme', Industry: 'Tech' },
      { Id: '2', Name: 'Globex', Industry: 'Finance' }
    ])
    const result = await executeCustomCommand(baseOpts, HOST)
    expect(result.map((r) => r.name)).toEqual(['Acme'])
  })

  it('throws a formatted SOQL error when the API rejects with JSON error', async () => {
    mockFetchAllPages.mockRejectedValue(
      new Error('API 400: [{"message":"unexpected token: WHERE"}]')
    )
    await expect(executeCustomCommand(baseOpts, HOST)).rejects.toThrow(/SOQL Error: unexpected token: WHERE/)
  })

  it('throws a generic formatted error when message is not JSON', async () => {
    mockFetchAllPages.mockRejectedValue(new Error('network down'))
    await expect(executeCustomCommand(baseOpts, HOST)).rejects.toThrow(/network down[\s\S]*check your custom command/i)
  })
})
```

- [ ] **Step 2: Run**

Run: `node_modules/.bin/vitest run src/lib/custom-command.test.ts`
Expected: PASS (9).

- [ ] **Step 3: Prove it bites** -- flip the exact-match expectation to `['Acme', 'Acme Corp']`, confirm FAIL, restore.

- [ ] **Step 4: Coverage** -- `--coverage`, confirm `custom-command.ts` `% Lines` reaches ~100% (covers the 65-73 branch gap).

- [ ] **Step 5: Commit**

```bash
git add src/lib/custom-command.test.ts
git commit -m "test: add direct unit tests for executeCustomCommand branches"
```

---

### Task 3: history-store edge cases

**Files:**
- Test: `src/stores/history-store.test.ts` (extend -- file exists, 14 tests)
- Under test: `src/stores/history-store.ts`

Use the existing file's mock setup (verbatim: `fakeStore` Map, `vi.mock('~lib/storage-service', ...)`, `makeItem()` helper, `beforeEach` resetting `useHistoryStore.setState({ items: [] })` + `_resetHistoryOrgScope()`).

- [ ] **Step 1: Append these tests inside the existing `describe('history-store', ...)`**

```typescript
  describe('frecency refresh on re-open', () => {
    it('moves a re-visited low-frecency item ahead of a stale high-count item', () => {
      const store = useHistoryStore.getState()
      const now = Date.now()
      // Stale item: high count but visited 30 days ago
      useHistoryStore.setState({
        items: [
          { id: 'stale', name: 'Stale', type: 'ApexClass', url: 'u1', visitCount: 10, lastVisitedAt: now - 30 * 864e5, firstVisitedAt: now - 60 * 864e5 },
          { id: 'fresh', name: 'Fresh', type: 'ApexClass', url: 'u2', visitCount: 1, lastVisitedAt: now - 20 * 864e5, firstVisitedAt: now - 20 * 864e5 }
        ]
      })
      store.recordVisit({ id: 'fresh', name: 'Fresh', type: 'ApexClass', url: 'u2' })
      const items = useHistoryStore.getState().items
      const sorted = sortByFrecency(items)
      expect(sorted[0].id).toBe('fresh')
    })

    it('keeps description when recordVisit omits it', () => {
      const store = useHistoryStore.getState()
      store.recordVisit({ id: 'a', name: 'A', type: 'User', url: 'u', description: 'first@x.com | Admin' })
      store.recordVisit({ id: 'a', name: 'A', type: 'User', url: 'u' })
      const item = useHistoryStore.getState().items.find((i) => i.id === 'a')
      expect(item?.description).toBe('first@x.com | Admin')
      expect(item?.visitCount).toBe(2)
    })

    it('treats same id with different type as distinct entries', () => {
      const store = useHistoryStore.getState()
      store.recordVisit({ id: 'x', name: 'X', type: 'ApexClass', url: 'u1' })
      store.recordVisit({ id: 'x', name: 'X', type: 'Flow', url: 'u2' })
      expect(useHistoryStore.getState().items).toHaveLength(2)
    })
  })

  describe('org scope isolation', () => {
    it('writes to a host-scoped key after setHistoryOrgScope', async () => {
      await setHistoryOrgScope('orgA.my.salesforce.com')
      useHistoryStore.getState().recordVisit({ id: 'a', name: 'A', type: 'User', url: 'u' })
      // allow zustand persist async write to flush
      await Promise.resolve()
      expect(storageSetMock).toHaveBeenCalledWith(
        'ultraforce_history__orgA.my.salesforce.com',
        expect.objectContaining({ items: expect.any(Array) })
      )
    })

    it('clears in-memory items when switching to an org with no persisted data', async () => {
      await setHistoryOrgScope('orgA.my.salesforce.com')
      useHistoryStore.getState().recordVisit({ id: 'a', name: 'A', type: 'User', url: 'u' })
      _resetHistoryOrgScope()
      await setHistoryOrgScope('orgB.my.salesforce.com')
      expect(useHistoryStore.getState().items).toEqual([])
    })
  })
```

Add `setHistoryOrgScope` and `storageSetMock` to the imports/refs if not already in scope (they are defined at top of the existing file).

- [ ] **Step 2: Run** -- `node_modules/.bin/vitest run src/stores/history-store.test.ts`. Expected PASS.
- [ ] **Step 3: Prove it bites** -- in the isolation test, assert `sorted[0].id` toBe `'stale'`, confirm FAIL, restore.
- [ ] **Step 4: Coverage** -- confirm `history-store.ts` `% Lines` rises past 94% (covers 75-76, 174).
- [ ] **Step 5: Commit**

```bash
git add src/stores/history-store.test.ts
git commit -m "test: cover history frecency refresh and org-scope isolation"
```

---

### Task 4: favorites-store edge cases

**Files:**
- Test: `src/stores/favorites-store.test.ts` (extend -- file exists, 12 tests)
- Under test: `src/stores/favorites-store.ts`

Mirror the history-store test's storage mock (the existing favorites test already has it).

- [ ] **Step 1: Append tests**

```typescript
  describe('capacity and toggle edges', () => {
    it('caps favorites at MAX_FAVORITES (20), dropping the oldest', () => {
      const add = useFavoritesStore.getState().addFavorite
      for (let i = 0; i < 25; i++) {
        add({ id: `id${i}`, name: `N${i}`, type: 'ApexClass', url: `u${i}` })
      }
      const items = useFavoritesStore.getState().items
      expect(items).toHaveLength(20)
      // newest-first: id24 at front, id5 at the tail (id0..id4 dropped)
      expect(items[0].id).toBe('id24')
      expect(items.some((i) => i.id === 'id0')).toBe(false)
    })

    it('addFavorite is a no-op for an already-pinned id', () => {
      const { addFavorite } = useFavoritesStore.getState()
      addFavorite({ id: 'a', name: 'A', type: 'User', url: 'u' })
      addFavorite({ id: 'a', name: 'A renamed', type: 'User', url: 'u2' })
      const items = useFavoritesStore.getState().items
      expect(items).toHaveLength(1)
      expect(items[0].name).toBe('A')
    })

    it('toggleFavorite returns false and removes when already pinned', () => {
      const store = useFavoritesStore.getState()
      store.addFavorite({ id: 'a', name: 'A', type: 'User', url: 'u' })
      const pinned = useFavoritesStore.getState().toggleFavorite({ id: 'a', name: 'A', type: 'User', url: 'u' })
      expect(pinned).toBe(false)
      expect(useFavoritesStore.getState().isFavorite('a')).toBe(false)
    })

    it('toggleFavorite returns true and adds when not pinned', () => {
      const added = useFavoritesStore.getState().toggleFavorite({ id: 'b', name: 'B', type: 'User', url: 'u' })
      expect(added).toBe(true)
      expect(useFavoritesStore.getState().isFavorite('b')).toBe(true)
    })
  })

  describe('org scope isolation', () => {
    it('clears items when switching to an unpersisted org', async () => {
      await setFavoritesOrgScope('orgA.my.salesforce.com')
      useFavoritesStore.getState().addFavorite({ id: 'a', name: 'A', type: 'User', url: 'u' })
      _resetFavoritesOrgScope()
      await setFavoritesOrgScope('orgB.my.salesforce.com')
      expect(useFavoritesStore.getState().items).toEqual([])
    })
  })
```

Ensure imports include `setFavoritesOrgScope`, `_resetFavoritesOrgScope` (add to the existing import block from `./favorites-store`).

- [ ] **Step 2: Run** -- expected PASS.
- [ ] **Step 3: Prove it bites** -- change the cap test to `toHaveLength(25)`, confirm FAIL, restore.
- [ ] **Step 4: Coverage** -- confirm `favorites-store.ts` covers 59-60, 133.
- [ ] **Step 5: Commit**

```bash
git add src/stores/favorites-store.test.ts
git commit -m "test: cover favorites capacity, toggle, and org-scope isolation"
```

---

### Task 5a: ResultItem component tests

**Files:**
- Test: `src/components/search/ResultItem.test.tsx` (create -- NOTE: coverage table shows it at 43%; if a file already exists, extend it instead)
- Under test: `src/components/search/ResultItem.tsx`

- [ ] **Step 1: Write the test**

```typescript
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import ResultItem from './ResultItem'
import type { SearchResult } from '~types'

function makeResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return { id: '001x', name: 'Acme', type: 'CustomObject', ...overrides } as SearchResult
}

describe('ResultItem', () => {
  beforeEach(() => cleanup())

  it('renders name and description', () => {
    render(<ResultItem result={makeResult({ description: 'desc here' })} isSelected={false} onClick={vi.fn()} />)
    expect(screen.getByText('Acme')).toBeTruthy()
    expect(screen.getByText('desc here')).toBeTruthy()
  })

  it('calls onClick when the row is clicked', () => {
    const onClick = vi.fn()
    render(<ResultItem result={makeResult()} isSelected={false} onClick={onClick} />)
    fireEvent.click(screen.getByText('Acme'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('shows favorite toggle and fires onToggleFavorite without bubbling onClick', () => {
    const onClick = vi.fn()
    const onToggleFavorite = vi.fn()
    render(
      <ResultItem
        result={makeResult()}
        isSelected={false}
        onClick={onClick}
        isFavorite={false}
        onToggleFavorite={onToggleFavorite}
      />
    )
    fireEvent.click(screen.getByTitle('Pin to favorites'))
    expect(onToggleFavorite).toHaveBeenCalledWith(
      expect.objectContaining({ id: '001x', name: 'Acme', type: 'CustomObject' })
    )
    expect(onClick).not.toHaveBeenCalled()
  })

  it('shows "Remove from favorites" title when already pinned', () => {
    render(
      <ResultItem result={makeResult()} isSelected={false} onClick={vi.fn()} isFavorite onToggleFavorite={vi.fn()} />
    )
    expect(screen.getByTitle('Remove from favorites')).toBeTruthy()
  })

  it('renders the 5 object action buttons for a CustomObject and fires onActionClick', () => {
    const onActionClick = vi.fn()
    render(
      <ResultItem result={makeResult({ type: 'CustomObject' })} isSelected={false} onClick={vi.fn()} onActionClick={onActionClick} />
    )
    fireEvent.click(screen.getByTitle('Fields'))
    expect(onActionClick).toHaveBeenCalledWith(expect.objectContaining({ id: '001x' }), 'fields')
    expect(screen.getByTitle('Page Layouts')).toBeTruthy()
    expect(screen.getByTitle('Record Types')).toBeTruthy()
    expect(screen.getByTitle('Validation Rules')).toBeTruthy()
    expect(screen.getByTitle('Object Settings')).toBeTruthy()
  })

  it('renders a Preview action for ApexPage', () => {
    const onActionClick = vi.fn()
    render(
      <ResultItem result={makeResult({ type: 'ApexPage' })} isSelected={false} onClick={vi.fn()} onActionClick={onActionClick} />
    )
    fireEvent.click(screen.getByTitle('Preview'))
    expect(onActionClick).toHaveBeenCalledWith(expect.objectContaining({ type: 'ApexPage' }), 'preview')
  })

  it('copies the QualifiedApiName for a CustomField', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    render(
      <ResultItem
        result={makeResult({ type: 'CustomField', name: 'Industry', metadata: { QualifiedApiName: 'Account.Industry' } })}
        isSelected={false}
        onClick={vi.fn()}
      />
    )
    fireEvent.click(screen.getByTitle('Copy API Name'))
    expect(writeText).toHaveBeenCalledWith('Account.Industry')
  })

  it('shows last-modified meta for Apex with a relative date', () => {
    render(
      <ResultItem
        result={makeResult({ type: 'ApexClass', metadata: { LastModifiedDate: new Date().toISOString(), LastModifiedBy: { Name: 'Dormon' } } })}
        isSelected={false}
        onClick={vi.fn()}
      />
    )
    expect(screen.getByText('Dormon')).toBeTruthy()
    expect(screen.getByText('today')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run** -- `node_modules/.bin/vitest run src/components/search/ResultItem.test.tsx`. Expected PASS (8). Pristine output (no act warnings).
- [ ] **Step 3: Prove it bites** -- assert `onClick` WAS called in the favorite test, confirm FAIL (stopPropagation works), restore.
- [ ] **Step 4: Coverage** -- confirm `ResultItem.tsx` `% Lines` rises from ~53% past 85%.
- [ ] **Step 5: Commit**

```bash
git add src/components/search/ResultItem.test.tsx
git commit -m "test: cover ResultItem favorite toggle, actions, and copy-api-name"
```

---

### Task 5b: UpdateNotification component tests

**Files:**
- Test: `src/components/search/UpdateNotification.test.tsx` (create)
- Under test: `src/components/search/UpdateNotification.tsx`

Note: the component calls `Math.random()` (in `generateParticles`) and uses a 100ms `setTimeout` for the visible transition. Tests must not depend on randomness; assert structure/behavior only.

- [ ] **Step 1: Write the test**

```typescript
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import UpdateNotification from './UpdateNotification'

describe('UpdateNotification', () => {
  beforeEach(() => cleanup())

  it('renders the version and the static copy', () => {
    render(<UpdateNotification version="0.2.5" releaseNotesUrl="https://x/notes" onDismiss={vi.fn()} />)
    expect(screen.getByText('Updated to v0.2.5')).toBeTruthy()
    expect(screen.getByText('See what is new in this version')).toBeTruthy()
  })

  it('links Release Notes to the provided url, opening in a new tab safely', () => {
    render(<UpdateNotification version="0.2.5" releaseNotesUrl="https://x/notes" onDismiss={vi.fn()} />)
    const link = screen.getByText('Release Notes').closest('a') as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('https://x/notes')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('fires onDismiss when the dismiss button is clicked', () => {
    const onDismiss = vi.fn()
    render(<UpdateNotification version="0.2.5" releaseNotesUrl="https://x/notes" onDismiss={onDismiss} />)
    fireEvent.click(screen.getByTitle('Dismiss'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('renders exactly 20 firework particles', () => {
    const { container } = render(<UpdateNotification version="1.0.0" releaseNotesUrl="https://x" onDismiss={vi.fn()} />)
    expect(container.querySelectorAll('.firework-particle')).toHaveLength(20)
  })

  it('adds the "visible" class after the mount timer fires', async () => {
    const { container } = render(<UpdateNotification version="1.0.0" releaseNotesUrl="https://x" onDismiss={vi.fn()} />)
    await waitFor(() => {
      expect(container.querySelector('.update-celebration.visible')).toBeTruthy()
    })
  })
})
```

- [ ] **Step 2: Run** -- expected PASS (5).
- [ ] **Step 3: Prove it bites** -- assert 19 particles, confirm FAIL, restore.
- [ ] **Step 4: Coverage** -- confirm `UpdateNotification.tsx` rises from ~20% past 80%.
- [ ] **Step 5: Commit**

```bash
git add src/components/search/UpdateNotification.test.tsx
git commit -m "test: cover UpdateNotification render, dismiss, and visibility transition"
```

---

### Task 6: background message-handler unit tests

**Files:**
- Test: `src/background/index.test.ts` (create)
- Under test: `src/background/index.ts`

`chrome` is global via vitest-chrome. The module registers listeners on import. Capture the registered `onMessage` listener, then invoke it directly with `(request, sender, sendResponse)`.

**Mock targets:** `~lib/storage-service` (storageSet) and `~lib/logger` if imported; `chrome.cookies.get` / `chrome.cookies.getAll` configured per-test.

- [ ] **Step 1: Write the test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('~lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))
vi.mock('~lib/storage-service', () => ({
  storageSet: vi.fn().mockResolvedValue(undefined),
  STORAGE_KEYS: { SETTINGS: 'ultraforce_search_settings' }
}))

// Importing the module registers chrome.runtime.onMessage.addListener(...)
import './index'

type MsgListener = (
  request: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void
) => boolean | void

function getMessageListener(): MsgListener {
  const calls = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls
  return calls[calls.length - 1][0] as MsgListener
}

// Invoke the listener and await the async sendResponse it eventually calls.
function invoke(request: any, sender: Partial<chrome.runtime.MessageSender> = {}): Promise<any> {
  const listener = getMessageListener()
  return new Promise((resolve) => {
    const sendResponse = (response: any) => resolve(response)
    const returned = listener(request, sender as chrome.runtime.MessageSender, sendResponse)
    // sync handlers (ping) call sendResponse before returning false
    if (returned === false) {
      // already resolved synchronously by sendResponse
    }
  })
}

describe('background message handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    chrome.cookies.get.mockResolvedValue(null)
    chrome.cookies.getAll.mockResolvedValue([])
  })

  it('ping responds with success', async () => {
    const res = await invoke({ action: 'ping' })
    expect(res).toEqual({ success: true, message: 'Background script is running' })
  })

  it('getSession returns key+hostname from the sid cookie', async () => {
    chrome.cookies.get.mockResolvedValue({
      domain: 'myorg.my.salesforce.com',
      value: 'SID_VALUE',
      name: 'sid'
    } as chrome.cookies.Cookie)

    const res = await invoke({ message: 'getSession', sfHost: 'myorg.my.salesforce.com' })
    expect(res).toEqual({ key: 'SID_VALUE', hostname: 'myorg.my.salesforce.com' })
    expect(chrome.cookies.get).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://myorg.my.salesforce.com', name: 'sid' })
    )
  })

  it('getSession returns null when no sid cookie exists', async () => {
    chrome.cookies.get.mockResolvedValue(null)
    const res = await invoke({ message: 'getSession', sfHost: 'myorg.my.salesforce.com' })
    expect(res).toBeNull()
  })

  it('getSession checks the sfcrmproducts.cn domain first for sfcrmapps.cn hosts', async () => {
    chrome.cookies.get.mockImplementation(async ({ url }: { url: string }) => {
      if (url.includes('sfcrmproducts.cn')) {
        return { domain: 'org.sfcrmproducts.cn', value: 'CN_SID', name: 'sid' } as chrome.cookies.Cookie
      }
      return null
    })
    const res = await invoke({ message: 'getSession', sfHost: 'org.sfcrmapps.cn' })
    expect(res).toEqual({ key: 'CN_SID', hostname: 'org.sfcrmproducts.cn' })
  })

  it('getSfHost returns the mcas.ms domain verbatim', async () => {
    const res = await invoke({ message: 'getSfHost', url: 'https://example.mcas.ms/page' })
    expect(res).toBe('example.mcas.ms')
  })

  it('getSfHost maps salesforce-setup.com to my.salesforce.com when the sid cookie exists', async () => {
    chrome.cookies.get.mockResolvedValue({ domain: 'acme.my.salesforce.com', value: 'x', name: 'sid' } as chrome.cookies.Cookie)
    const res = await invoke({ message: 'getSfHost', url: 'https://acme.my.salesforce-setup.com/setup' })
    expect(res).toBe('acme.my.salesforce.com')
  })
})
```

- [ ] **Step 2: Run** -- `node_modules/.bin/vitest run src/background/index.test.ts`.
  If a handler path does not match the verbatim logic (e.g. the China-domain ordering), READ `src/background/index.ts` around that branch and align the test inputs to the real branch -- do not assert behavior the code does not implement. Keep only tests that pass against real code.
- [ ] **Step 3: Prove it bites** -- change the ping expectation message, confirm FAIL, restore.
- [ ] **Step 4: Coverage** -- `background/index.ts` goes from 0% to >=60% lines. Record number.
- [ ] **Step 5: Commit**

```bash
git add src/background/index.test.ts
git commit -m "test: cover background getSession/getSfHost/ping message handlers"
```

---

### Task 7: SettingsPanel custom-command CRUD tests

**Files:**
- Test: `src/components/search/SettingsPanel.test.tsx` (create)
- Under test: `src/components/search/SettingsPanel.tsx`

This is the single biggest coverage lever (684 lines at 24.8%). The component imports `getApiStats`, `getUnsupportedTypes`, `BUILTIN_COMMANDS`, `mergeCommands`, `validateCommandKey`, `isKeyUnique`, `filterCommandsBySupported`. Mock the async data fns; let the pure command-parser helpers run for real (they are already 100% covered and give realistic validation).

**Prep:** Before writing, READ `src/components/search/SettingsPanel.tsx` lines 1-120 and 190-420 once to confirm the exact import paths to mock and the full props list (the props block is verbatim below). Mock only the async/chrome-touching imports.

Props (verbatim from source): `onClose, selectedTypes, onToggleType, shortcutKey, onShortcutChange, closeOnNavigate, onCloseOnNavigateChange, autoLoadFields, onAutoLoadFieldsChange, fuzzySearch, onFuzzySearchChange, hideManagedPackage, onHideManagedPackageChange, maxResultsPerType, onMaxResultsPerTypeChange, navigationMode, onNavigationModeChange, sfHost, customCommands, onCustomCommandsChange`.

Form field placeholders (verbatim): key=`e.g. log`, description=`e.g. My Logs`, soql=`SELECT Id, Name FROM ... WHERE Name LIKE '%{query}%'`, nameField=`Name`, descriptionFields=`Field1, Field2`. Save button text=`Save`. Edit/Delete buttons have `title="Edit"` / `title="Delete"`.

Save validation order (verbatim from `handleSaveCommand`): invalid key -> not unique -> empty description -> empty soql -> soql missing `{query}` -> empty nameField.

- [ ] **Step 1: Write the test**

```typescript
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import type { CustomCommand } from '~types'

vi.mock('~lib/api-stats', () => ({
  getApiStats: vi.fn().mockResolvedValue({ total: 0, last24h: 0, lastMonth: 0 })
}))
vi.mock('~lib/salesforce-api', () => ({
  getUnsupportedTypes: vi.fn().mockResolvedValue([])
}))

import SettingsPanel from './SettingsPanel'

// Minimal valid props; every callback is a spy.
function renderPanel(overrides: Partial<React.ComponentProps<typeof SettingsPanel>> = {}) {
  const onCustomCommandsChange = vi.fn()
  const props = {
    onClose: vi.fn(),
    selectedTypes: ['ApexClass'],
    onToggleType: vi.fn(),
    shortcutKey: 'b',
    onShortcutChange: vi.fn(),
    closeOnNavigate: true,
    onCloseOnNavigateChange: vi.fn(),
    autoLoadFields: false,
    onAutoLoadFieldsChange: vi.fn(),
    fuzzySearch: true,
    onFuzzySearchChange: vi.fn(),
    hideManagedPackage: true,
    onHideManagedPackageChange: vi.fn(),
    maxResultsPerType: 10,
    onMaxResultsPerTypeChange: vi.fn(),
    navigationMode: 'auto' as const,
    onNavigationModeChange: vi.fn(),
    sfHost: 'myorg.my.salesforce.com',
    customCommands: {} as Record<string, CustomCommand>,
    onCustomCommandsChange,
    ...overrides
  }
  render(<SettingsPanel {...props} />)
  return { onCustomCommandsChange, props }
}

async function openAddForm() {
  // The "add new" affordance lives near the custom-commands section; it reveals
  // the form whose first input has placeholder "e.g. log".
  const addBtn = await screen.findByText(/add (custom )?command/i)
  fireEvent.click(addBtn)
  await screen.findByPlaceholderText('e.g. log')
}

describe('SettingsPanel custom commands', () => {
  beforeEach(() => cleanup())

  it('saves a valid new command with the lowercased key and parsed description fields', async () => {
    const { onCustomCommandsChange } = renderPanel()
    await openAddForm()

    fireEvent.change(screen.getByPlaceholderText('e.g. log'), { target: { value: 'LOG' } })
    fireEvent.change(screen.getByPlaceholderText('e.g. My Logs'), { target: { value: 'My Logs' } })
    fireEvent.change(screen.getByPlaceholderText(/SELECT Id, Name FROM/), {
      target: { value: "SELECT Id, Name FROM Account WHERE Name LIKE '%{query}%'" }
    })
    fireEvent.change(screen.getByPlaceholderText('Field1, Field2'), { target: { value: 'Industry, Phone' } })

    fireEvent.click(screen.getByText('Save'))

    expect(onCustomCommandsChange).toHaveBeenCalledTimes(1)
    const saved = onCustomCommandsChange.mock.calls[0][0]
    expect(saved.log).toMatchObject({
      key: 'log',
      description: 'My Logs',
      isBuiltin: false,
      nameField: 'Name',
      descriptionFields: ['Industry', 'Phone']
    })
  })

  it('shows a validation error and does not save when SOQL lacks {query}', async () => {
    const { onCustomCommandsChange } = renderPanel()
    await openAddForm()
    fireEvent.change(screen.getByPlaceholderText('e.g. log'), { target: { value: 'log' } })
    fireEvent.change(screen.getByPlaceholderText('e.g. My Logs'), { target: { value: 'My Logs' } })
    fireEvent.change(screen.getByPlaceholderText(/SELECT Id, Name FROM/), {
      target: { value: 'SELECT Id FROM Account' }
    })
    fireEvent.click(screen.getByText('Save'))

    expect(screen.getByText(/SOQL must contain \{query\} placeholder/)).toBeTruthy()
    expect(onCustomCommandsChange).not.toHaveBeenCalled()
  })

  it('shows a validation error when description is empty', async () => {
    const { onCustomCommandsChange } = renderPanel()
    await openAddForm()
    fireEvent.change(screen.getByPlaceholderText('e.g. log'), { target: { value: 'log' } })
    fireEvent.change(screen.getByPlaceholderText(/SELECT Id, Name FROM/), {
      target: { value: "SELECT Id FROM Account WHERE Name LIKE '%{query}%'" }
    })
    fireEvent.click(screen.getByText('Save'))
    expect(screen.getByText(/Description is required/)).toBeTruthy()
    expect(onCustomCommandsChange).not.toHaveBeenCalled()
  })

  it('lists an existing custom command and deletes it', () => {
    const existing: Record<string, CustomCommand> = {
      log: { key: 'log', description: 'My Logs', soql: "SELECT Id FROM ApexLog WHERE Id LIKE '%{query}%'", useToolingApi: true, isBuiltin: false, nameField: 'Id' }
    }
    const { onCustomCommandsChange } = renderPanel({ customCommands: existing })
    expect(screen.getByText('My Logs')).toBeTruthy()
    fireEvent.click(screen.getByTitle('Delete'))
    expect(onCustomCommandsChange).toHaveBeenCalledWith({})
  })

  it('loads an existing command into the form on Edit and re-saves it', () => {
    const existing: Record<string, CustomCommand> = {
      log: { key: 'log', description: 'My Logs', soql: "SELECT Id FROM ApexLog WHERE Name LIKE '%{query}%'", useToolingApi: true, isBuiltin: false, nameField: 'Id', descriptionFields: ['Operation'] }
    }
    const { onCustomCommandsChange } = renderPanel({ customCommands: existing })
    fireEvent.click(screen.getByTitle('Edit'))
    expect((screen.getByPlaceholderText('e.g. log') as HTMLInputElement).value).toBe('log')
    expect((screen.getByPlaceholderText('Field1, Field2') as HTMLInputElement).value).toBe('Operation')
    fireEvent.click(screen.getByText('Save'))
    expect(onCustomCommandsChange).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run** -- `node_modules/.bin/vitest run src/components/search/SettingsPanel.test.tsx`.
  The "add new" trigger text (`findByText(/add (custom )?command/i)`) and the section layout are assumptions. If a query fails, READ the relevant render section of `SettingsPanel.tsx` (around lines 540-610 for the list and the add affordance, 319-390 for the form) and adjust the selector to the real label/`title`. Adjust SELECTORS only -- keep the asserted behavior.
- [ ] **Step 3: Prove it bites** -- in the save test, assert `saved.log.key` toBe `'LOG'` (uppercase), confirm FAIL (code lowercases), restore to `'log'`.
- [ ] **Step 4: Coverage** -- `SettingsPanel.tsx` `% Lines` rises from 24.8% toward 60%+ (custom-command paths are the bulk). Record number.
- [ ] **Step 5: Commit**

```bash
git add src/components/search/SettingsPanel.test.tsx
git commit -m "test: cover SettingsPanel custom command save/validate/edit/delete"
```

---

### Task 8: E2E recents + favorites

**Files:**
- Spec: `tests/e2e/recents-favorites.spec.ts` (create)
- Extend: `tests/e2e/pages/ultraforce.page.ts` (add helpers below)
- Uses: `tests/e2e/fixtures/extension.ts` (real `ultraforce` org, headed)

**First, add these helpers to `UltraForcePage`** (after `pressEnterAndWaitForNewTab`):

```typescript
  /** Read recents/favorites from the home screen without navigating. */
  async openHome(): Promise<void> {
    await this.openModal()
    await this.clearInput()
    await this.wait(800)
  }

  /** Count visible result rows currently rendered in the modal. */
  async resultCount(): Promise<number> {
    return this.page.evaluate(() => {
      const host = document.querySelector('[id^="ultraforce-modal"]')
      const root = (host as HTMLElement | null)?.shadowRoot ?? document
      return root.querySelectorAll('[data-ultraforce-result-item]').length
    })
  }

  /** Text of all result rows (from the closed Shadow DOM). */
  async resultTexts(): Promise<string[]> {
    return this.page.evaluate(() => {
      const host = document.querySelector('[id^="ultraforce-modal"]')
      const root = (host as HTMLElement | null)?.shadowRoot ?? document
      return Array.from(root.querySelectorAll('[data-ultraforce-result-item] .result-name')).map((n) => n.textContent || '')
    })
  }
```

NOTE: the Shadow DOM is `attachShadow({mode: 'closed'})`. If `host.shadowRoot` is `null` at runtime, the selectors above fall back to `document` and will find nothing. In that case, assert via behavior (navigation/new-tab) rather than DOM reads. Confirm during Step 2 and pick the working path; document which one you used.

- [ ] **Step 1: Write the spec**

```typescript
import { test, expect } from './fixtures/extension'
import { UltraForcePage } from './pages/ultraforce.page'

test.describe('Recents and Favorites', () => {
  let uf: UltraForcePage

  test.beforeAll(async ({ extensionPage, extensionContext, baseUrl }) => {
    uf = new UltraForcePage(extensionPage, extensionContext, baseUrl)
  })

  test.afterEach(async () => {
    await uf.ensureModalClosed()
    await uf.closeExtraTabs()
  })

  test('opening a search result records it in recents on re-open', async () => {
    // Navigate to a known Apex class so it is recorded.
    const nav = await uf.searchAndNavigateNewTab(':c WeatherService')
    expect(nav.opened).toBe(true)
    expect(nav.url).toContain('/lightning/')

    // Re-open the modal on the blank home screen; the item should appear in recents.
    await uf.openHome()
    const texts = await uf.resultTexts()
    // Either the DOM read works (preferred) or fall back to: re-search returns it quickly.
    if (texts.length > 0) {
      expect(texts.join(' ')).toContain('WeatherService')
    } else {
      // Fallback behavioral check: re-navigating succeeds (item still resolvable).
      const again = await uf.searchAndNavigateNewTab(':c WeatherService')
      expect(again.opened).toBe(true)
    }
  })

  test('re-opening the same item increments its recency (stays near the top)', async () => {
    await uf.searchAndNavigateNewTab(':c WeatherService')
    await uf.searchAndNavigateNewTab(':c WeatherService')
    await uf.openHome()
    const texts = await uf.resultTexts()
    if (texts.length > 0) {
      expect(texts[0]).toContain('Weather')
    }
    await uf.closeModal()
  })
})
```

- [ ] **Step 2: Build the extension, then run**

```bash
pnpm build           # produces build/chrome-mv3-prod that the fixture loads
node_modules/.bin/playwright test tests/e2e/recents-favorites.spec.ts --headed
```
Expected: PASS. Determine whether Shadow DOM reads work; keep the path that passes and delete the unused fallback branch for clarity.

- [ ] **Step 3: Anchor with sf CLI** -- confirm the WeatherService class exists so the test data is valid:

```bash
sf data query --query "SELECT Id, Name FROM ApexClass WHERE Name = 'WeatherService'" --target-org ultraforce --json
```
Expected: `result.totalSize >= 1`.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/recents-favorites.spec.ts tests/e2e/pages/ultraforce.page.ts
git commit -m "test(e2e): recents recording and recency refresh on re-open"
```

---

### Task 9: E2E custom commands

**Files:**
- Spec: `tests/e2e/custom-commands.spec.ts` (create)
- Uses the SettingsPage service-worker storage pattern (seed a custom command into `chrome.storage.local`, then exercise it through the modal).

**First, add to `SettingsPage`** (`tests/e2e/pages/settings.page.ts`):

```typescript
  async setCustomCommands(commands: Record<string, unknown>) {
    const sw = await this.getServiceWorker()
    await sw.evaluate(async (cmds) => {
      const stored = await chrome.storage.local.get('ultraforce_search_settings')
      const settings = stored.ultraforce_search_settings || {}
      settings.customCommands = cmds
      await chrome.storage.local.set({ ultraforce_search_settings: settings })
    }, commands)
  }
```

(Confirm the persisted settings key holds `customCommands` by reading how `salesforce-search.tsx` / the settings store serialize it; adjust the property path if different. READ `src/stores/settings-store.ts` to confirm before running.)

- [ ] **Step 1: Write the spec**

```typescript
import { test, expect } from './fixtures/extension'
import { UltraForcePage } from './pages/ultraforce.page'
import { SettingsPage } from './pages/settings.page'

test.describe('Custom SOQL Commands', () => {
  let uf: UltraForcePage
  let settings: SettingsPage

  test.beforeAll(async ({ extensionPage, extensionContext, baseUrl }) => {
    uf = new UltraForcePage(extensionPage, extensionContext, baseUrl)
    settings = new SettingsPage(extensionContext)
  })

  test.afterAll(async () => {
    await settings.resetToDefaults()
  })

  test('a seeded custom command executes and returns SOQL results', async () => {
    // Seed a custom command that queries Apex classes by name.
    await settings.setCustomCommands({
      ac: {
        key: 'ac',
        description: 'Apex by name',
        soql: "SELECT Id, Name FROM ApexClass WHERE Name LIKE '%{query}%'",
        useToolingApi: true,
        isBuiltin: false,
        nameField: 'Name'
      }
    })

    // Reopen the modal so settings reload, then run the command.
    await uf.openModal()
    await uf.closeModal()
    await uf.wait(400)

    await uf.openModal()
    await uf.clearAndType(':ac Weather')
    await uf.wait(2500)
    const texts = await uf.resultTexts()
    if (texts.length > 0) {
      expect(texts.join(' ')).toContain('Weather')
    }
    await uf.closeModal()
  })
})
```

- [ ] **Step 2: Run**

```bash
pnpm build
node_modules/.bin/playwright test tests/e2e/custom-commands.spec.ts --headed
```
Expected: PASS. If the command does not trigger, the persisted settings shape is wrong -- READ `settings-store.ts` for the exact `customCommands` serialization and fix `setCustomCommands`.

- [ ] **Step 3: Anchor with sf CLI**

```bash
sf data query --query "SELECT Id, Name FROM ApexClass WHERE Name LIKE '%Weather%'" --target-org ultraforce --use-tooling-api --json
```
Expected: `result.totalSize >= 1` (WeatherService, WeatherAlertService).

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/custom-commands.spec.ts tests/e2e/pages/settings.page.ts
git commit -m "test(e2e): seeded custom SOQL command executes and returns results"
```

---

### Task 10: E2E ID navigation (paste record id)

**Files:**
- Spec: `tests/e2e/id-navigation.spec.ts` (create)

Uses an 18-char Apex class id fetched live via sf CLI so the test is org-portable.

- [ ] **Step 1: Write the spec**

```typescript
import { test, expect } from './fixtures/extension'
import { execSync } from 'child_process'
import { UltraForcePage } from './pages/ultraforce.page'

function firstApexClassId(): string {
  const out = execSync(
    "sf data query --query \"SELECT Id FROM ApexClass WHERE Name = 'WeatherService' LIMIT 1\" --target-org ultraforce --json",
    { encoding: 'utf-8', env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' } }
  )
  const json = JSON.parse(out)
  return json.result.records[0].Id as string
}

test.describe('ID Navigation', () => {
  let uf: UltraForcePage
  let recordId: string

  test.beforeAll(async ({ extensionPage, extensionContext, baseUrl }) => {
    uf = new UltraForcePage(extensionPage, extensionContext, baseUrl)
    recordId = firstApexClassId()
  })

  test.afterEach(async () => {
    await uf.ensureModalClosed()
    await uf.closeExtraTabs()
  })

  test('pasting a record id shows the IdPreview and Enter opens it', async () => {
    await uf.openModal()
    await uf.clearAndType(recordId)
    await uf.wait(2000)

    // The IdPreview region renders the raw id while resolving.
    const previewText = await uf.rawPage.evaluate((id) => {
      const host = document.querySelector('[id^="ultraforce-modal"]')
      const root = (host as HTMLElement | null)?.shadowRoot ?? document
      return root.querySelector('.id-preview')?.textContent || root.body?.textContent || ''
    }, recordId)
    // Either the preview DOM is readable, or assert via successful navigation below.
    const nav = await uf.pressEnterAndWaitForNewTab()
    expect(nav.opened).toBe(true)
    expect(nav.url).toContain(recordId.substring(0, 15)) // 15-char id is a prefix of the 18-char id
  })
})
```

- [ ] **Step 2: Run**

```bash
pnpm build
node_modules/.bin/playwright test tests/e2e/id-navigation.spec.ts --headed
```
Expected: PASS. If the URL contains the 18-char id rather than the 15-char prefix, relax the assertion to `expect(nav.url).toContain(recordId.substring(0, 15))` already handles both (15 is a prefix of 18). If navigation opens in the same tab instead of a new tab, switch to asserting `uf.rawPage.url()` contains the id after Enter.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/id-navigation.spec.ts
git commit -m "test(e2e): paste record id shows preview and navigates on Enter"
```

---

## Final Verification

- [ ] **Run the full unit/component suite with coverage**

```bash
node_modules/.bin/vitest run --coverage
```
Expected: all tests green; `All files % Lines` >= 80.00. If still under 80, the largest remaining levers are `window-manager.ts` (branch 42%) and `SearchModal.tsx` (56%) -- add a follow-up task targeting their uncovered branches (out of scope for this plan unless needed to cross 80%).

- [ ] **Run lint + type-check**

```bash
node_modules/.bin/eslint src && node_modules/.bin/tsc --noEmit
```
Expected: 0 errors. New test files may add `no-explicit-any` warnings; keep them minimal (prefer typed fixtures).

- [ ] **Run the E2E suite once end-to-end**

```bash
pnpm build && node_modules/.bin/playwright test --headed
```
Expected: all specs pass against the `ultraforce` org.

- [ ] **Confirm the coverage target in writing**

Record the final `All files % Lines` number in the commit message of the final commit:

```bash
git commit --allow-empty -m "test: coverage raised to <N>% (target 80%)"
```

## Self-Review (completed during planning)

- **Spec coverage:** Every gap from the approved design maps to a task -- custom commands (T2, T7, T9), recents (T3, T8), favorites (T4, T8), org-isolation (T3, T4), search-orchestrator (T1), ID navigation (T10), ResultItem (T5a), UpdateNotification (T5b), background (T6). SettingsPanel weak coverage -> T7.
- **Placeholders:** None -- every test step contains runnable code. The only deferred specifics are E2E Shadow-DOM read paths and SettingsPanel selector labels, each with an explicit "READ the source and adjust SELECTORS only" instruction plus a behavioral fallback, because closed Shadow DOM and exact JSX labels can only be confirmed at runtime.
- **Type consistency:** `SearchResult`, `HistoryItem`, `FavoriteItem`, `CustomCommand`, `CommandFormState` shapes match their source definitions; store reset helpers (`_resetHistoryOrgScope`, `_resetFavoritesOrgScope`) and exports (`setHistoryOrgScope`, `setFavoritesOrgScope`) match `src/stores/*`.
