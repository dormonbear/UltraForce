# Technology Stack

**Analysis Date:** 2026-04-04

## Languages

**Primary:**
- TypeScript 5.9 - All source files in `src/`
- TSX - React components in `src/components/`, `src/contents/`

**Secondary:**
- CSS - Extension popup/options styles in `src/styles/options.css`, `src/styles/popup.css`

## Runtime

**Environment:**
- Chrome Extension (Manifest V3) - runs in service worker (background), content scripts, and extension pages
- Browser-native APIs: `chrome.storage`, `chrome.cookies`, `chrome.tabs`, `chrome.runtime`

**Package Manager:**
- pnpm (lockfile: `pnpm-lock.yaml` present)

## Frameworks

**Core:**
- Plasmo 0.90.5 - Chrome extension framework; handles manifest generation, build pipeline, hot reload
  - Config: `package.json` `manifest` field (no separate plasmo.config.ts)
- React 18.3.1 - UI rendering in content scripts and extension pages

**Search/Indexing:**
- MiniSearch 7.2.0 - In-memory full-text search with fuzzy matching and BM25 scoring
  - Implementation: `src/lib/fuzzy-search.ts`

**Testing:**
- Vitest 4.0.18 - Unit test runner; config `vitest.config.ts`; environment: jsdom
- @testing-library/react 16.3.2 - React component testing
- @playwright/test 1.57.0 - E2E testing; config `playwright.config.ts`

**Build/Dev:**
- Plasmo CLI wraps Parcel under the hood (invoked via `plasmo dev` / `plasmo build`)
- TypeScript compiler (tsc) for type checking only (`noEmit: true`)

## Key Dependencies

**Critical:**
- `plasmo` 0.90.5 - Framework for building and packaging the Chrome extension
- `minisearch` 7.2.0 - Powers all fuzzy search; defined indexes in `src/lib/fuzzy-search.ts`
- `react` / `react-dom` 18.3.1 - UI layer for search modal and content script overlay

**Infrastructure:**
- `@types/chrome` 0.1.4 - TypeScript types for Chrome Extension API
- `jsdom` 28.0.0 - DOM emulation for unit tests

## Configuration

**TypeScript (`tsconfig.json`):**
- Target: ES2022, Module: ESNext
- Strict mode enabled
- Path aliases: `~*` → `./src/*`, `~lib/*` → `./src/lib/*`, `~components/*` → `./src/components/*`, `~contents/*` → `./src/contents/*`
- JSX: `react-jsx`
- Test files excluded from compilation

**Linting (`eslint.config.js`):**
- Flat config format (ESLint 9)
- Plugins: `@typescript-eslint`, `eslint-plugin-react`, `eslint-plugin-react-hooks`
- `no-console` is **off** (custom `logger` module is preferred but not enforced by lint)
- `@typescript-eslint/no-explicit-any` is **off**

**Formatting (`.prettierrc`):**
- No semicolons (`semi: false`)
- Single quotes (`singleQuote: true`)
- No trailing commas (`trailingComma: "none"`)
- Print width: 120, tab width: 2, arrow parens: always

**Vitest (`vitest.config.ts`):**
- Environment: jsdom
- Setup file: `src/test-setup.ts`
- Includes: `src/**/*.test.{ts,tsx}`
- Aliases mirror tsconfig paths

**Playwright (`playwright.config.ts`):**
- Test directory: `tests/e2e/`
- Headless: false (required for Chrome extensions)
- Workers: 1, no parallelism
- Browser: Chromium only
- Timeout: 180s

## Platform Requirements

**Development:**
- Node.js (ESM project, `"type": "module"`)
- pnpm package manager
- Chrome/Chromium browser for E2E tests

**Production:**
- Chrome Extension (Manifest V3)
- Host permissions for all Salesforce domains including Enhanced Domains, Visualforce, Lightning, and China regions (sfcrmapps.cn, sfcrmproducts.cn)
- Required extension permissions: `storage`, `activeTab`, `tabs`, `cookies`
- Keyboard shortcut: Cmd+B (Mac) / Ctrl+B (default) to toggle search

---

*Stack analysis: 2026-04-04*
