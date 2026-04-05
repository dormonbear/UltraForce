# Phase 04: Cleanup & Coverage - Context

## Current State (pre-phase)

### CSS / Styles
- `src/components/search/styles.ts` is 1374 lines of CSS-in-JS (one giant template literal)
- Contains `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap')`
- Injected via `<style>{SEARCH_MODAL_STYLES}</style>` in SearchModal.tsx, inside WM's closed Shadow DOM
- Other CSS files: `src/styles/options.css`, `src/styles/popup.css` (already plain CSS, no Google Fonts)

### Font Loading
- Inter font loaded at runtime from Google Fonts CDN (external network request)
- No local font files bundled with the extension
- Font declaration is inside Shadow DOM `<style>` tag

### Legacy Code
- **Already removed**: `js/`, `view/`, `reference/` directories no longer exist
- No `manifest.json` committed (Plasmo generates from `package.json`)
- No references to legacy dirs in `package.json` manifest config

### E2E Tests
- **Already comprehensive**: 6 spec files covering search, navigation, keyboard, settings, features, edge-cases
- Tests use Page Object pattern (`ultraforce.page.ts`, `settings.page.ts`)

### Unit Test Coverage
- **Current: 48.63% statements** (target: 80%)
- 0% files (lib): api-stats.ts, auth.ts, fuzzy-search.ts, unsupported-types.ts, version-check.ts
- 0% files (content scripts): keyboard-shield.ts, salesforce-search.tsx, setup-enhancer.ts
- Low coverage components: SettingsPanel (27%), CommandHints (20%), ResultItem (38%)
- Content scripts are integration code, best covered by E2E tests

### Build System
- Plasmo 0.90.5 (uses Parcel bundler) for extension build
- Vitest (uses Vite) for unit tests
- `data-text:` import scheme supported by Plasmo for importing files as strings

## What Needs to Change

1. CSS-in-JS to CSS file + `data-text:` import
2. External Google Fonts to local woff2 files
3. Coverage from 48% to 80% (excluding untestable content scripts)

## Decisions

- Legacy removal (criterion 3) is already satisfied
- E2E test coverage (criterion 4) is already satisfied
- Content scripts (0% unit coverage) will be excluded from coverage config; they are covered by E2E tests
