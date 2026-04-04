# Coding Conventions

**Analysis Date:** 2026-04-04

## Naming Patterns

**Files:**
- `kebab-case` for lib files: `keyboard-interceptor.ts`, `command-parser.ts`, `domain-utils.ts`
- `PascalCase` for React components: `SearchModal.tsx`, `ResultItem.tsx`, `ErrorBoundary.tsx`
- `camelCase` for utility/style files: `styles.ts` (exception: lives in components dir)
- Test files co-located and suffixed `.test.ts` / `.test.tsx`

**Functions:**
- `camelCase` for all functions: `parseCommand`, `buildProfileSubMenu`, `normalizeHost`
- Factory functions prefixed with `create`: `createKeyboardInterceptor`, `createLogger`
- Boolean-returning functions prefixed with `is`/`has`/`needs`: `isSalesforceDomain`, `hasSearchIndex`, `needsPermissionCheck`
- Async functions use plain camelCase (no `Async` suffix)

**Variables:**
- `camelCase` for local variables and function parameters
- `SCREAMING_SNAKE_CASE` for module-level constants: `BUILTIN_COMMANDS`, `METADATA_TYPES`, `API_VERSION`, `IS_PRODUCTION`
- Unused parameters prefixed with `_` to satisfy lint: `_unused`

**Types:**
- `interface` for object shapes (not `type` alias): `SearchResult`, `ParsedCommand`, `ErrorBoundaryProps`
- `type` alias for unions and primitives: `NavigationMode = 'auto' | 'lightning' | 'classic'`, `LogLevel`
- Type names are `PascalCase`
- Generic type guards as standalone exported functions: `isCustomCommand`, `isBuiltinCommand`

## Code Style

**Formatting (Prettier):**
- No semicolons (`"semi": false`)
- Single quotes (`"singleQuote": true`)
- No trailing commas (`"trailingComma": "none"`)
- Print width: 120 characters
- Tab width: 2 spaces
- Arrow function parens: always — `(x) => x`

**Linting (ESLint flat config at `eslint.config.js`):**
- TypeScript plugin with recommended rules; `@typescript-eslint/no-explicit-any` is OFF
- React plugin with recommended; `react/react-in-jsx-scope` OFF (React 17+ JSX transform)
- `prefer-const` is WARN
- `no-console` is OFF (but use `logger` module in production code — see Logging section)
- Unused vars pattern: `argsIgnorePattern: '^_'`

## Import Organization

**Order (conventional, not enforced by linter):**
1. External library imports (`react`, `@playwright/test`)
2. Internal path-aliased imports (`~types`, `~lib/...`, `~components/...`)
3. Relative imports (`./SearchInput`, `../types`)

**Path Aliases (defined in `vitest.config.ts`):**
- `~lib` → `src/lib`
- `~types` → `src/types`
- `~components` → `src/components`
- `~contents` → `src/contents`

**Type-only imports use `import type`:**
```typescript
import type { SearchResult, CustomCommand } from '~types'
import type { ObjectAction } from './ResultItem'
```

## Error Handling

**Patterns:**
- `try/catch` blocks around all async API calls
- On failure: log via `logger.error(...)` and return safe default (empty array `[]`, empty object `{}`, or `null`)
- Never throw from async utility functions; return `null` or empty to signal failure
- `ErrorBoundary` class component (`src/components/ErrorBoundary.tsx`) wraps component trees to catch render errors

**Example pattern:**
```typescript
try {
  await ensureCMDTRecordIndex(objectName, apiHost, session.key)
  results['CustomMetadataType'] = searchIndex(...)
} catch (error) {
  logger.error('search:cmdt-record failed', { cmdt: objectName, error })
  results['CustomMetadataType'] = []
}
```

## Logging

**Module:** `src/lib/logger.ts` — export `logger` (default and named)

**Rules:**
- Use `logger.debug/info/warn/error` everywhere; **never `console.*` directly in production code**
- `debug`/`info`/`warn` are suppressed in production (`NODE_ENV === 'production'`)
- `error` is always logged regardless of environment
- Log context as second argument object: `logger.error('search failed', { host, error })`

**Usage:**
```typescript
import { logger } from '~lib/logger'
import { logger } from './logger'  // within lib/
```

## Comments

**When to Comment:**
- Complex business logic and non-obvious algorithms
- JSDoc-style block comments for classes only (seen on `ErrorBoundary`)
- Inline comments for section headers in large files
- No author attribution

**Avoid:** Commenting obvious code, implementation notes, or TODO leftovers in committed code.

## Function Design

**Size:** Keep functions small and focused; large files (`window-manager.ts`, `salesforce-api.ts`) are acknowledged tech debt

**Parameters:**
- Use options objects for optional configs: `options: SearchOptions = {}`
- Destructure options inline: `const { useFuzzy = true, hideManagedPackage = true } = options`

**Return Values:**
- Prefer returning `null` over throwing for "not found" / "unavailable" states
- Async functions return `Promise<T>` with documented failure returns in JSDoc when relevant

## Module Design

**Exports:**
- Named exports for all utilities and constants
- Default export for React components only (e.g., `export default SearchModal`)
- Re-export from `src/types/index.ts` as single types barrel

**Barrel Files:**
- `src/types/index.ts` is the only barrel — all types exported from here
- No barrel in `src/lib/` — import individual files directly
- No barrel in `src/components/` — import components by path

## React Component Patterns

**Functional components with TypeScript:**
```typescript
const SearchModal: React.FC<Props> = ({ onClose }) => {
  // hooks at top
  // handlers as useCallback
  // render
}
export default SearchModal
```

**Exception:** `ErrorBoundary` is a class component (required by React API) at `src/components/ErrorBoundary.tsx`

**Hooks order:** `useState` → `useRef` → `useEffect` → `useMemo` → `useCallback`

**Event handler naming:** `handle` prefix — `handleKeyDown`, `handleSelect`, `handleClose`

---

*Convention analysis: 2026-04-04*
