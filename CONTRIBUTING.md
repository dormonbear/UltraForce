# Contributing to UltraForce for Salesforce

Thank you for your interest in contributing! This guide will help you get started.

## Prerequisites

- [Node.js](https://nodejs.org/) (ESM project)
- [pnpm](https://pnpm.io/) package manager
- Chrome or Chromium browser
- (Optional) A Salesforce org for E2E testing

## Getting Started

```bash
# Clone the repo
git clone https://github.com/dormonbear/UltraForce-for-Salesforce.git
cd UltraForce-for-Salesforce

# Install dependencies
pnpm install

# Start development server with hot reload
pnpm dev
```

### Load the Extension in Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `build/chrome-mv3-dev` directory (created by `pnpm dev`)

## Development Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server with hot reload |
| `pnpm build` | Production build |
| `pnpm test:run` | Run unit tests |
| `pnpm lint` | Check ESLint errors |
| `pnpm lint:fix` | Auto-fix ESLint issues |
| `pnpm type-check` | TypeScript type checking |

## Code Style

This project uses Prettier and ESLint with specific rules:

- **No semicolons**
- **Single quotes**
- **No trailing commas**
- Print width: 120 characters

These are enforced by pre-commit hooks via Husky. Run `pnpm lint` before committing.

## Project Structure

```
src/
  background/       # Service worker (cookie access, session auth)
  components/       # React components (search modal, settings)
  contents/         # Content scripts (injected into Salesforce pages)
  lib/              # Core logic (search, API, caching, parsing)
  types/            # TypeScript type definitions
tests/
  e2e/              # Playwright E2E tests
```

Key files:
- `src/lib/window-manager.ts` - Main controller, mounts React UI into Shadow DOM
- `src/lib/salesforce-api.ts` - Salesforce API calls and metadata fetching
- `src/lib/fuzzy-search.ts` - MiniSearch-based fuzzy search engine
- `src/lib/command-parser.ts` - Command parsing (`:o`, `:c`, `:w`, etc.)
- `src/contents/salesforce-search.tsx` - Primary content script entry point

## Testing

### Unit Tests

```bash
pnpm test:run
```

Unit tests use Vitest + jsdom + @testing-library/react. Test files are co-located with source files as `*.test.ts` / `*.test.tsx`.

### E2E Tests

E2E tests require a Salesforce org with test data from [trailheadapps/agent-script-recipes](https://github.com/trailheadapps/agent-script-recipes).

```bash
# Configure your test org
sf org login web --alias ultraforce

# Run E2E tests (must be headed for Chrome extensions)
pnpm exec playwright test --headed
```

See `tests/E2E_TEST_GUIDE.md` for detailed test data and patterns.

## Making Changes

### Branch Strategy

- `main` - Stable releases
- `develop` - Active development
- Feature branches from `develop`

### Workflow

1. Fork the repo and create a branch from `develop`
2. Make your changes
3. Ensure all checks pass:
   ```bash
   pnpm lint
   pnpm type-check
   pnpm test:run
   ```
4. Commit using [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` new feature
   - `fix:` bug fix
   - `refactor:` code refactoring
   - `docs:` documentation
   - `test:` tests
5. Open a PR against `develop`

### Logging

Use the `logger` module instead of `console.*`:

```typescript
import { logger } from '~lib/logger'

logger.info('search completed', { count: results.length })
logger.error('API call failed', { error })
```

## Reporting Issues

Open an issue on GitHub with:
- Steps to reproduce
- Expected vs actual behavior
- Salesforce edition/domain type (if relevant)
- Browser version

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
