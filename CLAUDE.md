# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UltraForce for Salesforce - Chrome extension for managing Salesforce credentials and metadata operations. The codebase is in transition from legacy AngularJS (root directory) to modern React/TypeScript (`/ultraforce-modern` and `/src`).

## Development Commands

### Build and Development
```bash
npm run dev        # Start development server with hot reload
npm run build      # Production build
npm run preview    # Preview production build
```

### Code Quality
```bash
npm run lint       # Check ESLint errors
npm run lint:fix   # Auto-fix ESLint issues
npm run format     # Format code with Prettier
npm run type-check # TypeScript type checking
```

### Testing
```bash
npm run test       # Run Vitest tests
npm run test:ui    # Run tests with UI
```

### E2E Testing (Playwright)
```bash
pnpm exec playwright test --headed    # Run E2E tests (must be headed for extensions)
pnpm exec playwright test -g "name"   # Run specific test
pnpm exec playwright test --debug     # Debug mode
```

## Architecture Overview

### Modern Architecture (React/TypeScript)
- **`/src/components`**: React components (AdvancedSearch, Credentials, DeployManager, MetadataList)
- **`/src/stores`**: State management using Zustand (authStore, credentialStore, metadataStore, deploymentStore)
- **`/src/types`**: TypeScript type definitions
- **`/src/utils`**: Utility functions and helpers
- **`/src/services`**: API and service layer

### Legacy Architecture (AngularJS)
- **`/js`**: Minified JavaScript files for current extension functionality
- **`/view`**: HTML pages for OAuth and deployment features
- **`/reference`**: Third-party libraries (jQuery, Angular, Bootstrap)

### Key Technologies
- **Build**: Vite
- **UI**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **State**: Zustand
- **Icons**: Lucide React
- **Testing**: Vitest + React Testing Library

## Important Patterns

### Chrome Extension Structure
- `manifest.json`: Extension configuration (Manifest V3)
- Service worker pattern for background operations
- Content scripts for Salesforce domain interaction
- OAuth2 flow for authentication

### State Management
- Zustand stores with persistence to Chrome storage
- TypeScript interfaces for all state shapes
- Async actions for API operations

### Component Patterns
- Functional components with TypeScript
- Custom hooks for shared logic
- Tailwind CSS for styling (no semicolons, single quotes)

### UI/UX Design
- **Primary Reference**: `/docs/ui-design-guide.md` - Complete UI design specification following Raycast-style interface
- Transparent glassmorphism design with dark theme
- Minimalist approach with focus on content and usability
- All UI development should strictly follow the design guide for consistency

## Salesforce Integration
- Supports all modern Salesforce domains including Enhanced Domains
- Cookie-based session authentication (reads Salesforce session from browser)
- Tooling API for metadata queries
- Support for Apex, Visualforce, Lightning components

## Search System

### Search Modes
- **Fuzzy Search** (default): Uses MiniSearch with Levenshtein distance, prefix matching, and BM25 scoring
- **Exact Search**: Disable fuzzy via `useFuzzy: false` option

### Dot-Notation Field Search
Type `ObjectName.FieldName` (e.g., `Account.Name` or `account.`) to search fields:
- Case-insensitive object matching
- Tab key autocompletes selected result into input
- Other metadata types use the object name portion as search query

### Cache and Index Lifecycle
- **MetadataCache**: 24h TTL, background refresh after 2h, stored in chrome.storage.local
- **SearchIndex**: In-memory MiniSearch indexes, rebuilt when cache misses or fresh data fetched
- Index and cache are always in sync: cache invalidation triggers index rebuild
- `warmupMetadataCache()` pre-fetches common types and builds indexes

### Key Files
- `src/lib/salesforce-api.ts`: Main search API, cache management, Salesforce API calls
- `src/lib/fuzzy-search.ts`: MiniSearch wrapper, index management, result formatting
- `src/lib/metadata-cache.ts`: Chrome storage cache with TTL and background refresh

## Development Notes
- Always run `npm run lint` and `npm run type-check` before committing
- The project uses Prettier with specific rules (no semicolons, single quotes)
- Git hooks via Husky run linting on pre-commit
- When adding new Salesforce domains, update both the manifest.json and relevant service files
- **Testing requirement**: After completing a feature or bug fix, ensure both **unit tests** (Vitest) and **E2E tests** (Playwright) are written and passing before committing. Unit tests verify isolated logic; E2E tests verify the feature works end-to-end in the browser with a real Salesforce org.
- Do not add emoji characters to code, logs, UI text, or documentation; keep text ASCII-friendly

## E2E Testing

### Test Environment
- **Target Org**: `ultraforce` (sf CLI alias)
- **Instance**: orgfarm-d300fcfc0f-dev-ed.develop.my.salesforce.com
- **Test Data**: [trailheadapps/agent-script-recipes](https://github.com/trailheadapps/agent-script-recipes)
- **Guide**: See `tests/E2E_TEST_GUIDE.md` for detailed test data and patterns

### Available Test Metadata
| Type | Examples | Count |
|------|----------|-------|
| Apex Classes | WeatherService, PaymentGatewayController, ExperienceController | 24 |
| Custom Objects | ASR_Hotel__c, ASR_Order__c, ASR_Flight_Booking__c | 14 |
| Flows | CreateCase, CreateBooking, AddToCart, FetchAccountData | 20+ |
| Users | Dormon Zhou, Integration User | 8 |
| Permission Sets | AgentPlatformBuilder, CopilotSalesforceUser | 10+ |

### SF CLI Verification
Use sf CLI to verify test results:
```bash
# Query Apex classes
sf data query --query "SELECT Id, Name FROM ApexClass WHERE Name = 'WeatherService'" --target-org ultraforce --json

# Query custom objects
sf data query --query "SELECT QualifiedApiName FROM EntityDefinition WHERE QualifiedApiName LIKE 'ASR_%'" --target-org ultraforce --json

# Query flows (Tooling API)
sf data query --query "SELECT Id, DeveloperName FROM FlowDefinition WHERE DeveloperName = 'CreateCase'" --target-org ultraforce --use-tooling-api --json
```

### Test Patterns
1. **Search Tests**: Type command, verify results appear
2. **Navigation Tests**: Search, select, verify new tab opens with correct URL
3. **Verification**: Compare against sf CLI query results

## Publishing New Version

### Automated Release (Recommended)

Releases are automated via GitHub Actions. Pushing a `v*` tag triggers the release workflow which builds, packages, creates a GitHub Release, and optionally publishes to the Chrome Web Store.

```bash
# Bump version, update release notes, commit, and tag (pick one)
pnpm release:patch   # 0.1.1 -> 0.1.2
pnpm release:minor   # 0.1.1 -> 0.2.0
pnpm release:major   # 0.1.1 -> 1.0.0

# Edit the generated release notes placeholder in docs/guide/release-notes.md
# Then amend the commit and push with tags
git commit --amend
git push origin develop --tags
```

The release workflow (`.github/workflows/release.yml`) will:
1. Run lint, type-check, and unit tests
2. Build and package the extension
3. Create a GitHub Release with the `.zip` artifact
4. Upload to Chrome Web Store via service account (if `CWS_PUBLISH_ENABLED` is set; see `document/auto-publish-setup.md`)

### CI Pipeline

Every push to `develop`/`main` and every PR triggers the CI workflow (`.github/workflows/ci.yml`):
- Lint + Type Check
- Unit Tests with coverage
- Build verification

### Manual Release (Fallback)

1. **Update version number** in `package.json`
2. **Update release notes** at `docs/guide/release-notes.md`
3. **Build the extension**: `pnpm build:package`
4. **Upload** the `.zip` from `build/` to Chrome Web Store manually
5. The version update notification will automatically show to users when they update

<!-- GSD:project-start source:PROJECT.md -->
## Project

**UltraForce for Salesforce - Architecture & Quality Milestone**

UltraForce is a Chrome extension that provides fast metadata search and navigation for Salesforce orgs. Users press a keyboard shortcut to open a search modal overlay (injected via Shadow DOM), type queries with fuzzy matching, and navigate directly to Salesforce Setup pages, Apex classes, custom objects, flows, and more. Built with React 18 + TypeScript on the Plasmo framework.

**Core Value:** Fast, reliable metadata search and navigation that works across all Salesforce domains -- the extension must never break the host Salesforce page or lose the user's session context.

### Constraints

- **Chrome Extension**: Must remain Manifest V3 compatible; Shadow DOM isolation is required
- **No breaking changes**: All existing features must continue working after refactoring
- **Plasmo framework**: Build system is Plasmo; any CSS migration must work within Plasmo's build pipeline
- **Test infrastructure**: Unit tests via Vitest, E2E via Playwright (headed mode, single worker)
- **Code style**: No semicolons, single quotes, no trailing commas (Prettier enforced)
- **File size**: 200-400 lines typical, 800 max per file
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5.9 - All source files in `src/`
- TSX - React components in `src/components/`, `src/contents/`
- CSS - Extension popup/options styles in `src/styles/options.css`, `src/styles/popup.css`
## Runtime
- Chrome Extension (Manifest V3) - runs in service worker (background), content scripts, and extension pages
- Browser-native APIs: `chrome.storage`, `chrome.cookies`, `chrome.tabs`, `chrome.runtime`
- pnpm (lockfile: `pnpm-lock.yaml` present)
## Frameworks
- Plasmo 0.90.5 - Chrome extension framework; handles manifest generation, build pipeline, hot reload
- React 18.3.1 - UI rendering in content scripts and extension pages
- MiniSearch 7.2.0 - In-memory full-text search with fuzzy matching and BM25 scoring
- Vitest 4.0.18 - Unit test runner; config `vitest.config.ts`; environment: jsdom
- @testing-library/react 16.3.2 - React component testing
- @playwright/test 1.57.0 - E2E testing; config `playwright.config.ts`
- Plasmo CLI wraps Parcel under the hood (invoked via `plasmo dev` / `plasmo build`)
- TypeScript compiler (tsc) for type checking only (`noEmit: true`)
## Key Dependencies
- `plasmo` 0.90.5 - Framework for building and packaging the Chrome extension
- `minisearch` 7.2.0 - Powers all fuzzy search; defined indexes in `src/lib/fuzzy-search.ts`
- `react` / `react-dom` 18.3.1 - UI layer for search modal and content script overlay
- `@types/chrome` 0.1.4 - TypeScript types for Chrome Extension API
- `jsdom` 28.0.0 - DOM emulation for unit tests
## Configuration
- Target: ES2022, Module: ESNext
- Strict mode enabled
- Path aliases: `~*` → `./src/*`, `~lib/*` → `./src/lib/*`, `~components/*` → `./src/components/*`, `~contents/*` → `./src/contents/*`
- JSX: `react-jsx`
- Test files excluded from compilation
- Flat config format (ESLint 9)
- Plugins: `@typescript-eslint`, `eslint-plugin-react`, `eslint-plugin-react-hooks`
- `no-console` is **off** (custom `logger` module is preferred but not enforced by lint)
- `@typescript-eslint/no-explicit-any` is **off**
- No semicolons (`semi: false`)
- Single quotes (`singleQuote: true`)
- No trailing commas (`trailingComma: "none"`)
- Print width: 120, tab width: 2, arrow parens: always
- Environment: jsdom
- Setup file: `src/test-setup.ts`
- Includes: `src/**/*.test.{ts,tsx}`
- Aliases mirror tsconfig paths
- Test directory: `tests/e2e/`
- Headless: false (required for Chrome extensions)
- Workers: 1, no parallelism
- Browser: Chromium only
- Timeout: 180s
## Platform Requirements
- Node.js (ESM project, `"type": "module"`)
- pnpm package manager
- Chrome/Chromium browser for E2E tests
- Chrome Extension (Manifest V3)
- Host permissions for all Salesforce domains including Enhanced Domains, Visualforce, Lightning, and China regions (sfcrmapps.cn, sfcrmproducts.cn)
- Required extension permissions: `storage`, `activeTab`, `tabs`, `cookies`
- Keyboard shortcut: Cmd+B (Mac) / Ctrl+B (default) to toggle search
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- `kebab-case` for lib files: `keyboard-interceptor.ts`, `command-parser.ts`, `domain-utils.ts`
- `PascalCase` for React components: `SearchModal.tsx`, `ResultItem.tsx`, `ErrorBoundary.tsx`
- `camelCase` for utility/style files: `styles.ts` (exception: lives in components dir)
- Test files co-located and suffixed `.test.ts` / `.test.tsx`
- `camelCase` for all functions: `parseCommand`, `buildProfileSubMenu`, `normalizeHost`
- Factory functions prefixed with `create`: `createKeyboardInterceptor`, `createLogger`
- Boolean-returning functions prefixed with `is`/`has`/`needs`: `isSalesforceDomain`, `hasSearchIndex`, `needsPermissionCheck`
- Async functions use plain camelCase (no `Async` suffix)
- `camelCase` for local variables and function parameters
- `SCREAMING_SNAKE_CASE` for module-level constants: `BUILTIN_COMMANDS`, `METADATA_TYPES`, `API_VERSION`, `IS_PRODUCTION`
- Unused parameters prefixed with `_` to satisfy lint: `_unused`
- `interface` for object shapes (not `type` alias): `SearchResult`, `ParsedCommand`, `ErrorBoundaryProps`
- `type` alias for unions and primitives: `NavigationMode = 'auto' | 'lightning' | 'classic'`, `LogLevel`
- Type names are `PascalCase`
- Generic type guards as standalone exported functions: `isCustomCommand`, `isBuiltinCommand`
## Code Style
- No semicolons (`"semi": false`)
- Single quotes (`"singleQuote": true`)
- No trailing commas (`"trailingComma": "none"`)
- Print width: 120 characters
- Tab width: 2 spaces
- Arrow function parens: always — `(x) => x`
- TypeScript plugin with recommended rules; `@typescript-eslint/no-explicit-any` is OFF
- React plugin with recommended; `react/react-in-jsx-scope` OFF (React 17+ JSX transform)
- `prefer-const` is WARN
- `no-console` is OFF (but use `logger` module in production code — see Logging section)
- Unused vars pattern: `argsIgnorePattern: '^_'`
## Import Organization
- `~lib` → `src/lib`
- `~types` → `src/types`
- `~components` → `src/components`
- `~contents` → `src/contents`
## Error Handling
- `try/catch` blocks around all async API calls
- On failure: log via `logger.error(...)` and return safe default (empty array `[]`, empty object `{}`, or `null`)
- Never throw from async utility functions; return `null` or empty to signal failure
- `ErrorBoundary` class component (`src/components/ErrorBoundary.tsx`) wraps component trees to catch render errors
## Logging
- Use `logger.debug/info/warn/error` everywhere; **never `console.*` directly in production code**
- `debug`/`info`/`warn` are suppressed in production (`NODE_ENV === 'production'`)
- `error` is always logged regardless of environment
- Log context as second argument object: `logger.error('search failed', { host, error })`
## Comments
- Complex business logic and non-obvious algorithms
- JSDoc-style block comments for classes only (seen on `ErrorBoundary`)
- Inline comments for section headers in large files
- No author attribution
## Function Design
- Use options objects for optional configs: `options: SearchOptions = {}`
- Destructure options inline: `const { useFuzzy = true, hideManagedPackage = true } = options`
- Prefer returning `null` over throwing for "not found" / "unavailable" states
- Async functions return `Promise<T>` with documented failure returns in JSDoc when relevant
## Module Design
- Named exports for all utilities and constants
- Default export for React components only (e.g., `export default SearchModal`)
- Re-export from `src/types/index.ts` as single types barrel
- `src/types/index.ts` is the only barrel — all types exported from here
- No barrel in `src/lib/` — import individual files directly
- No barrel in `src/components/` — import components by path
## React Component Patterns
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Content script injects a Shadow DOM container into Salesforce pages; React renders inside it for style isolation
- Background service worker handles cookie access (cross-origin cookie reads are restricted to the background context)
- All state lives in `UltraForceWindowManager` (singleton class) — no Zustand or Redux
- Communication between content script and background via `chrome.runtime.sendMessage`
- Persistent settings stored in `chrome.storage.local`; metadata cache also stored there with 24h TTL
## Layers
- Purpose: Cookie-based session retrieval; cannot be done from content script context
- Location: `src/background/index.ts`
- Contains: Message handlers for `getSfHost` and `getSession`, extension install initialization
- Depends on: Chrome cookies API, Chrome storage API
- Used by: All content scripts via `chrome.runtime.sendMessage`
- Purpose: Inject UI into Salesforce pages, handle keyboard shortcuts, enhance Setup pages
- Locations:
- Depends on: `UltraForceWindowManager`, `salesforce-api`, `auth`
- Used by: Injected by Plasmo framework into all matched Salesforce domains
- Purpose: Singleton controller that owns all extension state, mounts React UI into Shadow DOM, orchestrates search calls, handles navigation
- Location: `src/lib/window-manager.ts` (1636 lines — largest file)
- Contains: `WindowManagerState`, Shadow DOM container creation, React root lifecycle, search dispatch, URL building for Lightning/Classic navigation, record context detection, setup shortcuts
- Depends on: `salesforce-api`, `auth`, `keyboard-interceptor`, React, all UI components
- Used by: `salesforce-search.tsx` content script
- Purpose: Metadata fetching from Salesforce APIs, fuzzy indexing, caching, command parsing
- Locations:
- Depends on: `auth`, `metadata-cache`, `fuzzy-search`, Chrome storage
- Used by: `window-manager.ts`, `SearchModal.tsx`
- Purpose: React presentation layer; receives all state as props, emits callbacks upward to WindowManager
- Location: `src/components/search/`
- Contains:
- Depends on: `command-parser`, `salesforce-api` (for unsupported type list), `version-check`, types
- Used by: `window-manager.ts` (React root render)
- `src/lib/logger.ts` — thin wrapper; silences logs in production
- `src/lib/api-stats.ts` — counts API requests for debug display
- `src/lib/version-check.ts` — compares installed version against latest release
- `src/lib/keyboard-interceptor.ts` — reusable keyboard event filter used inside Shadow DOM context
- `src/components/ErrorBoundary.tsx` — class component wrapping React tree in Shadow DOM
## Data Flow
## Key Abstractions
- Purpose: Central controller and state container; single source of truth for extension runtime state
- File: `src/lib/window-manager.ts`
- Pattern: Singleton with async factory (`getInstance()`), Promise-guarded initialization, cleanup on re-init
- Purpose: Persistent cache for Salesforce metadata with versioning and background refresh
- File: `src/lib/metadata-cache.ts`
- Pattern: Singleton class, keyed by `orgId + metadataType`, stored in `chrome.storage.local`
- Purpose: Extensible typed dispatch — builtin shortcuts (`:o`, `:c`, etc.) and user-defined SOQL commands
- Files: `src/lib/command-parser.ts`, `src/types/index.ts`
- Pattern: Union type `BuiltinCommand | CustomCommand`; type guards `isBuiltinCommand()` / `isCustomCommand()`
- Purpose: Style isolation from Salesforce host page CSS
- Created in: `UltraForceWindowManager.createContainer()` with `attachShadow({mode: 'closed'})`
- Styles injected: `src/components/search/styles.ts` (CSS-in-JS string appended as `<style>` tag)
## Entry Points
- Location: `src/contents/salesforce-search.tsx`
- Triggers: Injected by Plasmo on all matched `https://*.salesforce.com/*` (and variants) URLs
- Responsibilities: Instantiates `UltraForceWindowManager`, binds keyboard shortcut, listens for storage changes, handles Chrome runtime messages
- Location: `src/contents/keyboard-shield.ts`
- Triggers: `run_at: document_start` in MAIN world (same JS context as the page)
- Responsibilities: Monkey-patches `addEventListener` to suppress Salesforce keyboard shortcuts while modal is open
- Location: `src/contents/setup-enhancer.ts`
- Triggers: `run_at: document_idle`, matches Setup page URLs only
- Responsibilities: Scrolls Setup lists to trigger lazy loads; watches for SPA navigation via URL polling
- Location: `src/background/index.ts`
- Triggers: Persistent service worker registered in Plasmo manifest
- Responsibilities: Cookie reads for session auth, initial settings install, ping handler
## Error Handling
- `WindowManager.initialize()` catches init errors, calls `setupMinimalFallback()` (keyboard shortcut only)
- `salesforce-api.ts` marks metadata types as unsupported on 4xx errors (persisted in `unsupported-types.ts`)
- `ErrorBoundary` in `src/components/ErrorBoundary.tsx` wraps entire React tree; renders fallback UI on uncaught errors
- Session expiry (401) throws a user-facing message: "Session expired. Please refresh the page."
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
