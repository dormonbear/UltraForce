# Phase 03 Context: State Migration

## Phase Goal
Application state is managed through React-friendly Zustand stores and a centralized storage service, making state testable and predictable.

## Key Findings from Research

### Current Problems
1. Settings duplicated in 3 places (WM state, SearchModal state, chrome.storage)
2. Raw `chrome.storage.local` scattered across 10 files with 6 distinct keys + dynamic metadata keys
3. Full re-render on every state change (`renderComponent()` pattern)
4. WindowManager singleton owns both orchestration logic AND UI state

### Architecture Decisions
- Zustand stores work in Shadow DOM content scripts (no compatibility issues)
- MetadataCache keeps its own singleton; storage calls routed through service
- Session key stays in auth module (not exposed in store)
- STAT-03 (sfRest generic) already complete from Phase 02

### Storage Keys
- `ultraforce_search_settings` - user preferences (most accessed, 4 consumers)
- `metadata_${orgId}_${type}` - dynamic cache keys (MetadataCache only)
- `ultraforce_unsupported_types` - per-host metadata type support
- `ultraforce_api_stats` - request tracking
- `ultraforce_version_check` - version notification state
- `ultraforce_error_logs` - error boundary logs
- `settings` - legacy install-only key (background)

## Dependencies
- Phase 02 modules are the foundation (url-builder, navigation, record-context, search-orchestrator, etc.)
- 392 unit tests provide safety net
- TypedEventEmitter may be gradually replaced by Zustand subscriptions
