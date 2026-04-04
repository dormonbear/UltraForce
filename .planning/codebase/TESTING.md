# Testing Patterns

**Analysis Date:** 2026-04-04

## Test Framework

**Unit Test Runner:**
- Vitest (globals: true)
- Config: `vitest.config.ts`
- Environment: `jsdom`
- Setup file: `src/test-setup.ts`

**Assertion Library:**
- Vitest built-in `expect` (Jest-compatible)
- `@testing-library/jest-dom/vitest` matchers available via setup file

**E2E Test Runner:**
- Playwright
- Config: `playwright.config.ts`
- Browser: Chromium only, headed (headless: false — required for Chrome extensions)
- Workers: 1 (sequential, no parallelism)
- Test timeout: 180s, expect timeout: 10s

**Run Commands:**
```bash
npm run test                              # Run all unit tests (Vitest)
npm run test:ui                           # Run tests with Vitest UI
npx vitest run --run                      # Run once, no watch
pnpm exec playwright test --headed        # Run E2E tests
pnpm exec playwright test -g "name"       # Run specific E2E test
pnpm exec playwright test --debug         # Debug mode
```

## Test File Organization

**Unit Tests:**
- Co-located with source files in `src/lib/`
- Naming: `<module-name>.test.ts`
- Examples:
  - `src/lib/keyboard-interceptor.test.ts`
  - `src/lib/domain-utils.test.ts`
  - `src/lib/command-parser.test.ts`
  - `src/lib/profile-search.test.ts`

**E2E Tests:**
- Located in `tests/e2e/`
- Naming: `<feature>.spec.ts`
- Page objects in `tests/e2e/pages/`
- Fixtures in `tests/e2e/fixtures/`
- Files: `search.spec.ts`, `navigation.spec.ts`, `features.spec.ts`, `keyboard.spec.ts`, `settings.spec.ts`, `edge-cases.spec.ts`

**Structure:**
```
tests/
  e2e/
    fixtures/
      extension.ts       # Browser context + Salesforce auth setup
    pages/
      ultraforce.page.ts # Page Object Model for the extension UI
      settings.page.ts
    search.spec.ts
    navigation.spec.ts
    features.spec.ts
    keyboard.spec.ts
    settings.spec.ts
    edge-cases.spec.ts
  E2E_TEST_GUIDE.md
src/
  lib/
    *.test.ts            # Unit tests co-located with source
  test-setup.ts          # Global Vitest setup
```

## Test Structure

**Unit Suite Organization:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { functionUnderTest } from './module'

describe('functionUnderTest', () => {
  beforeEach(() => {
    // reset state
  })

  describe('sub-behavior group', () => {
    it('should do X when Y', () => {
      // arrange
      // act
      // assert
    })
  })
})
```

**Patterns:**
- `describe` blocks group by function or behavior domain
- Nested `describe` for sub-behaviors within the same function
- `it` descriptions use "should" pattern: `it('should delete character before cursor', ...)`
- `beforeEach` for test isolation and state reset
- `it.each` for parameterized tests over similar inputs

**it.each example:**
```typescript
it.each(['Escape', 'ArrowDown', 'ArrowUp', 'Enter'])(
  'should stop propagation for %s but NOT preventDefault',
  (key) => {
    const event = createKeyEvent('keydown', key)
    handler(event)
    expect(event.stopPropagation).toHaveBeenCalled()
    expect(event.preventDefault).not.toHaveBeenCalled()
  }
)
```

## Mocking

**Framework:** Vitest's `vi` (vi.fn(), vi.spyOn(), vi.stubGlobal())

**Global Chrome API Mock (in `src/test-setup.ts`):**
```typescript
const chromeMock = {
  storage: { local: { get: vi.fn().mockResolvedValue({}), set: vi.fn().mockResolvedValue(undefined), remove: vi.fn().mockResolvedValue(undefined) } },
  cookies: { get: vi.fn().mockResolvedValue(null) },
  runtime: { sendMessage: vi.fn(), onMessage: { addListener: vi.fn() }, getManifest: vi.fn().mockReturnValue({ version: '0.1.0' }) },
  tabs: { query: vi.fn().mockResolvedValue([]), create: vi.fn(), sendMessage: vi.fn() }
}
vi.stubGlobal('chrome', chromeMock)
```

**Spy on DOM event methods:**
```typescript
const event = new KeyboardEvent('keydown', { key: 'e', bubbles: true, cancelable: true })
vi.spyOn(event, 'stopPropagation')
vi.spyOn(event, 'stopImmediatePropagation')
vi.spyOn(event, 'preventDefault')
```

**Spy on element methods:**
```typescript
const modalEl = document.createElement('div')
const dispatchSpy = vi.spyOn(modalEl, 'dispatchEvent')
```

**What to Mock:**
- Chrome Extension APIs (always — no real `chrome` in jsdom)
- DOM event methods when asserting they were/were not called
- External API calls in unit tests

**What NOT to Mock:**
- DOM construction/manipulation (use real `document.createElement`)
- Pure logic (parse functions, utility transforms)

## Fixtures and Factories

**Unit Test Factories:**
Helper functions created inline in test files for constructing test inputs:
```typescript
function createMockInput(value = '', selectionStart = 0, selectionEnd = 0): HTMLInputElement {
  const input = document.createElement('input')
  input.value = value
  input.selectionStart = selectionStart
  input.selectionEnd = selectionEnd
  return input
}

function createKeyEvent(type: string, key: string, opts: Partial<KeyboardEventInit> = {}): KeyboardEvent {
  return new KeyboardEvent(type, { key, bubbles: true, cancelable: true, ...opts })
}
```

**E2E Fixtures (Playwright):**
- Located at `tests/e2e/fixtures/extension.ts`
- Uses `test.extend<TestFixtures>()` to provide:
  - `extensionPage: Page` — Salesforce page with extension loaded
  - `extensionContext: BrowserContext` — shared browser context
  - `baseUrl: string` — Salesforce Lightning instance URL
  - `orgInfo: OrgInfo` — access token and instance URL from `sf org display`
- Shared context pattern: single browser context reused across all tests in a worker via module-level `sharedContext` variable
- Auth via Salesforce frontdoor URL: `${instanceUrl}/secur/frontdoor.jsp?sid=${encodedToken}`

**E2E Test Data:**
- Static test data from Salesforce org aliased `ultraforce`
- Reference data documented in `tests/E2E_TEST_GUIDE.md`
- No database seeding — relies on pre-existing org data

## Coverage

**Requirements:** 80% minimum coverage target (from CLAUDE.md)

**View Coverage:**
```bash
npx vitest run --coverage
```

## Test Types

**Unit Tests (`src/lib/*.test.ts`):**
- Scope: individual functions and modules in isolation
- Focus: pure functions (parsers, transformers, validators), DOM manipulation logic
- No real network calls; Chrome APIs fully mocked via `test-setup.ts`

**Integration Tests:**
- Not formally separated; heavier unit tests (e.g., `profile-search.test.ts`) test multiple collaborating functions together with mocked Chrome/network boundaries

**E2E Tests (`tests/e2e/*.spec.ts`):**
- Scope: full extension loaded in real Chromium against a live Salesforce org
- Uses Page Object Model pattern: `UltraForcePage` class in `tests/e2e/pages/ultraforce.page.ts`
- Tests verify navigation (new tab opened with correct URL) and search result presence
- No headless mode — Chrome extension loading requires headed browser

## Common Patterns

**Async Testing:**
```typescript
it('should resolve with empty array when no session', async () => {
  const result = await searchSalesforceMetadata('query', [], 'host.salesforce.com')
  expect(result).toEqual({})
})
```

**Error Testing:**
```typescript
it('should not crash when input is null', () => {
  const handler = createKeyboardInterceptor(() => null)
  expect(() => {
    handler(createKeyEvent('keydown', 'Backspace'))
  }).not.toThrow()
})
```

**E2E Navigation assertion:**
```typescript
const result = await uf.searchAndNavigateNewTab(':c WeatherService', 3000)
expect(result.opened).toBe(true)
expect(result.url).toContain('/apex/WeatherService')
```

**Cleanup:**
- `beforeEach` for per-test isolation
- `test.afterAll` in E2E fixtures to close browser context and remove temp dir

---

*Testing analysis: 2026-04-04*
