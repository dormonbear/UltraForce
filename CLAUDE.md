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

When the user requests to publish a new version, follow these steps:

1. **Update version number** in `package.json`
2. **Update release notes** at `docs/guide/release-notes.md`:
   - Add a new version section at the top (below the title)
   - Include release date
   - List new features, improvements, and bug fixes
   - Format example:
     ```markdown
     ## vX.X.X

     Release Date: YYYY-MM-DD

     ### New Features
     - Feature description

     ### Improvements
     - Improvement description

     ### Bug Fixes
     - Fix description
     ```
3. **Build the extension**: `npm run build`
4. **Deploy documentation** (if applicable): `cd docs && pnpm run build`
5. The version update notification will automatically show to users when they update to the new version
