# Technology Stack: Refactoring & Quality Milestone

**Project:** UltraForce for Salesforce
**Researched:** 2026-04-04
**Overall Confidence:** HIGH

## Current Stack (Keep As-Is)

These are already in place and correct for this project. No changes needed.

| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| Plasmo | 0.90.5 | Extension framework | Build pipeline, manifest gen, Shadow DOM CSUI -- switching cost is prohibitive |
| React | 18.3.1 | UI rendering | Stable, well-supported by Plasmo; React 19 not yet supported by Plasmo |
| TypeScript | 5.9.2 | Type safety | Current; strict mode already enabled |
| MiniSearch | 7.2.0 | Fuzzy search | Working well, no reason to change |
| Vitest | 4.0.18 | Unit testing | Current major; update to 4.1.x for minor improvements |
| Playwright | 1.57.0 | E2E testing | Current; works with Chrome extension headed mode |
| @testing-library/react | 16.3.2 | Component testing | Standard React testing library |
| ESLint | 9.39.2 | Linting | Current; flat config already in use |
| pnpm | (system) | Package manager | Already in use, no reason to change |

## New Dependencies to Add

### State Management

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| zustand | ^5.0.12 | Centralized state management | Replace WindowManager singleton state pattern. Zustand is tiny (~1KB), works natively with React hooks, and is testable without DOM. The WindowManager's `this.state` + `renderComponent()` pattern bypasses React batching -- Zustand fixes this. Zustand 5.x is stable with no breaking changes expected. |

**Confidence:** HIGH -- Zustand is the de facto lightweight state library for React. The project already identified this need in PROJECT.md.

**Why NOT Redux/Jotai/Valtio:**
- Redux: Too much boilerplate for a Chrome extension with simple state
- Jotai: Atom-based model doesn't fit the current imperative WindowManager pattern; migration would be harder
- Valtio: Proxy-based mutations would be a poor mental model transition from the current mutable state

**Why NOT write custom Chrome storage middleware:**
- Write a thin custom `chromeStorage` middleware (~30 lines) using Zustand's `persist` API instead of pulling in `zustand-chrome-storage` (low-activity repo, 0.x version). The persist middleware is built into Zustand and well-documented. Pattern:

```typescript
import { persist } from 'zustand/middleware'
import { create } from 'zustand'

const useSomeStore = create(
  persist(storeDefinition, {
    name: 'ultraforce-settings',
    storage: {
      getItem: (name) => chrome.storage.local.get(name).then(r => r[name] ?? null),
      setItem: (name, value) => chrome.storage.local.set({ [name]: value }),
      removeItem: (name) => chrome.storage.local.remove(name),
    },
  })
)
```

### Testing Infrastructure

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| vitest-chrome | ^0.2.x | Chrome API mocking | Replace the hand-rolled `chromeMock` in `test-setup.ts`. Provides complete typed mocks for all Chrome APIs including `chrome.storage`, `chrome.cookies`, `chrome.tabs`, `chrome.runtime`. Each mocked Event has `callListeners()` and `clearListeners()` for simulating Chrome events in tests. Based on `@types/chrome` for type safety. |
| @vitest/coverage-v8 | ^4.0.18 | Coverage reporting | V8-based coverage (fast, no instrumentation overhead). Required for enforcing the 80% coverage target. Already compatible with Vitest 4.x. |

**Confidence:** HIGH for @vitest/coverage-v8 (official Vitest package). MEDIUM for vitest-chrome (smaller community package, but well-maintained and specific to this use case).

**Why NOT jest-chrome:** Project uses Vitest, not Jest. vitest-chrome is the Vitest-native equivalent.

**Why NOT Vitest Browser Mode for unit tests:** Browser Mode is for testing in real browsers. For unit testing Chrome extension logic (which mocks Chrome APIs anyway), jsdom + vitest-chrome is faster and simpler. Reserve real-browser testing for E2E via Playwright.

### CSS Migration

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| (plain CSS files) | N/A | Replace styles.ts CSS-in-JS | Plasmo natively supports importing CSS files into Shadow DOM via `getStyle` + `data-text` import scheme. No additional dependency needed. Plain CSS is simpler than Tailwind for this project: the existing styles are already written as CSS strings, so extraction is mechanical. No build config changes needed. |

**Confidence:** HIGH -- Plasmo's docs explicitly describe this pattern.

**Why NOT Tailwind CSS:**
- The project has 1374 lines of existing CSS that would need rewriting into utility classes
- Tailwind in Shadow DOM requires `:root` to `:host` CSS variable replacement (extra complexity)
- The project scope is refactoring, not redesigning -- plain CSS extraction is lower risk
- If Tailwind is desired later, it can be added incrementally

### Code Quality

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @typescript-eslint/eslint-plugin | ^8.50.0 (already installed) | Stricter lint rules | Enable `@typescript-eslint/no-explicit-any` as `warn` initially, escalate to `error` after cleanup. Currently disabled (`off`). |

**No new dependency needed** -- just configuration changes:

```javascript
// eslint.config.js changes
rules: {
  '@typescript-eslint/no-explicit-any': 'warn',  // Phase 1: warn
  // Later: '@typescript-eslint/no-explicit-any': 'error'  // Phase 2: error
}
```

## Alternatives Considered and Rejected

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| State mgmt | Zustand 5 | Redux Toolkit | Overkill for extension; 10x more boilerplate |
| State mgmt | Zustand 5 | Jotai | Atom model poor fit for migrating imperative singleton |
| State mgmt | Zustand 5 | No library (React useState) | WindowManager orchestrates across components; need shared store |
| Chrome storage | Custom persist middleware | zustand-chrome-storage | Low-activity 0.x package; custom middleware is ~30 lines |
| CSS | Plain CSS + Plasmo getStyle | Tailwind CSS | High migration cost for zero visual change; Shadow DOM caveats |
| CSS | Plain CSS + Plasmo getStyle | CSS Modules | Plasmo CSUI uses Shadow DOM for scoping already; modules add complexity |
| Chrome mocking | vitest-chrome | Manual mocks | Current manual mock covers ~20% of Chrome API; vitest-chrome covers 100% |
| Coverage | @vitest/coverage-v8 | @vitest/coverage-istanbul | V8 is faster (no instrumentation), default for Vitest |
| Testing | Vitest jsdom | Vitest Browser Mode | Browser Mode is for real-browser testing; overkill for unit tests mocking Chrome APIs |

## Version Pinning Strategy

Use caret ranges (`^`) for all dependencies (already the project convention). Lock via `pnpm-lock.yaml`.

**Update Vitest to latest 4.1.x** for:
- Vite 8 support
- Improved VSCode extension (no background process unless continuous run)
- GitHub Actions reporter (auto job summary)

## Installation

```bash
# New production dependency
pnpm add zustand

# New dev dependencies
pnpm add -D vitest-chrome @vitest/coverage-v8

# Update existing
pnpm update vitest
```

## Configuration Changes

### vitest.config.ts

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test-setup.ts',
        'src/**/*.d.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
  // ... existing resolve config
})
```

### test-setup.ts (replace manual mocks with vitest-chrome)

```typescript
/// <reference types="vitest/globals" />
import '@testing-library/jest-dom/vitest'
import chrome from 'vitest-chrome'

vi.stubGlobal('chrome', chrome)
```

### eslint.config.js (enable strict any checking)

```javascript
// Change from:
'@typescript-eslint/no-explicit-any': 'off'
// To:
'@typescript-eslint/no-explicit-any': 'warn'
```

## Sources

- [Zustand GitHub](https://github.com/pmndrs/zustand) -- v5.0.12, last published March 2026
- [vitest-chrome GitHub](https://github.com/probil/vitest-chrome) -- Chrome API mocking for Vitest
- [Vitest 4.1 announcement](https://main.vitest.dev/blog/vitest-4-1) -- March 2026
- [Vitest Coverage docs](https://vitest.dev/guide/coverage) -- V8 provider
- [Plasmo CSUI Styling docs](https://docs.plasmo.com/framework/content-scripts-ui/styling) -- CSS in Shadow DOM
- [Plasmo Tailwind quickstart](https://docs.plasmo.com/quickstarts/with-tailwindcss) -- Shadow DOM caveats
- [typescript-eslint no-explicit-any](https://typescript-eslint.io/rules/no-explicit-any/) -- Rule docs
- [Zustand + Chrome Storage pattern](https://www.drewalth.com/lab/zustand-chrome-storage/) -- Custom middleware approach
