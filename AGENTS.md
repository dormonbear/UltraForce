# AGENTS.md

Guidance for AI coding agents (Codex, Cursor, Copilot, Gemini CLI, Aider, Zed, and others)
working in this repository. Claude Code users: see `CLAUDE.md` for the full, richer guide.
This file is the cross-tool summary; `CLAUDE.md` is the source of truth where the two overlap.

## What this is

UltraForce for Salesforce - a Manifest V3 Chrome extension that injects a Spotlight/Raycast-style
fuzzy search modal into Salesforce pages (via Shadow DOM) for fast metadata search and navigation.
Built with React 18 + TypeScript on the Plasmo framework.

## Setup and commands

```bash
pnpm install           # install dependencies (pnpm is required; lockfile: pnpm-lock.yaml)
pnpm dev               # dev build with hot reload
pnpm build             # production build
pnpm lint              # ESLint
pnpm type-check        # tsc --noEmit
pnpm test:run          # Vitest unit tests (one-shot; `pnpm test` is watch mode)
pnpm test:e2e          # E2E (builds with E2E flag, then Playwright; headed)
```

Always run `pnpm lint` and `pnpm type-check` before committing.

## Project layout

- `src/contents/` - content scripts injected into Salesforce pages
- `src/background/` - service worker (cookie/session reads)
- `src/lib/` - core logic: search, cache, command parsing, window manager (no barrel; import files directly)
- `src/components/search/` - React UI (presentation only; state flows down as props)
- `src/types/index.ts` - the single types barrel
- `docs/` - VitePress site. Every `.md` under `docs/` is published; keep internal notes out of it.

## Code style (Prettier-enforced, do not deviate)

- No semicolons, single quotes, no trailing commas, print width 120, 2-space indent
- `interface` for object shapes, `type` for unions/primitives
- Named exports for utilities; default export only for React components
- Async utilities never throw: log via the `logger` module and return `null`/`[]`/`{}`
- Never use `console.*` in production code - use `src/lib/logger.ts`
- No emoji anywhere (code, logs, UI, docs); keep text ASCII-friendly

## Conventions

- Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`); never commit to `main` directly
- After a feature or fix, add and pass both unit (Vitest) and E2E (Playwright) tests
- When adding a Salesforce domain, update both `package.json` manifest config and the relevant service files
- Keep files 200-400 lines (800 max); organize by feature, not by type

See `CONTRIBUTING.md` for the contribution workflow and `CLAUDE.md` for full architecture detail.
