# External Integrations

**Analysis Date:** 2026-04-04

## APIs & External Services

**Salesforce REST API:**
- Purpose: Query metadata (Apex classes, triggers, flows, custom objects, fields, users, permission sets, profiles, reports, dashboards, queues, groups, custom labels, CMDT, custom settings)
- Base URL: `https://{sfHost}/services/data/v{API_VERSION}/` (currently `62.0`)
- Endpoint pattern: `/services/data/v62.0/query?q=...` for SOQL queries
- Auth: Bearer token via `Authorization` header (`Bearer {sid}`)
- Implementation: `src/lib/salesforce-api.ts`, `src/lib/auth.ts`
- API version constant: `API_VERSION = '62.0'` in `src/lib/auth.ts`

**Salesforce Tooling API:**
- Purpose: Query `FlowDefinition`, `LightningComponentBundle`, `AuraDefinitionBundle` and other Tooling-only objects
- Endpoint pattern: `/services/data/v62.0/tooling/query?q=...`
- Auth: Same Bearer token as REST API
- Implementation: `src/lib/salesforce-api.ts`

**Salesforce Bulk API:**
- Purpose: Alternative auth for bulk operations
- Auth: `X-SFDC-Session` header instead of `Authorization: Bearer`
- Implementation: `src/lib/auth.ts` (`sfRest` function with `api: 'bulk'` option)

## Authentication & Identity

**Auth Provider:** Salesforce (cookie-based, no OAuth flow in extension)
- Mechanism: Reads the `sid` session cookie from the active Salesforce browser session
- Cookie name: `sid`
- Background script (`src/background/index.ts`) handles `getSfHost` and `getSession` messages
- Content scripts send `chrome.runtime.sendMessage` to retrieve session from background
- Supported domain families:
  - `*.salesforce.com`, `*.my.salesforce.com`
  - `*.salesforce-setup.com` → mapped to `my.salesforce.com`
  - `*.lightning.force.com`, `*.visual.force.com`, `*.visualforce.com`, `*.force.com`
  - China regions: `*.sfcrmproducts.cn`, `*.sfcrmapps.cn`, `*.setup.sfcrmproducts.cn`, `*.setup.sfcrmapps.cn`
  - Salesforce government: `salesforce.mil`, `cloudforce.mil`
- No token refresh needed; relies on existing browser session

## Data Storage

**Databases:** None

**Browser Storage (chrome.storage.local):**
- Metadata cache: keyed as `metadata_{orgId}_{metadataType}`, 24h TTL, 2h background refresh threshold
  - Implementation: `src/lib/metadata-cache.ts`
  - Max cache size: 10MB
  - Cache version: `1.2` (bumping invalidates all cached entries)
- Extension settings: stored under key `settings` on install
  - Defaults: `{ searchLimit: 1000, autoSearch: true, showDebug: false }`
  - Managed in: `src/background/index.ts`
- Version check state: stored under key `ultraforce_version_check`
  - Tracks last seen version and whether update notification was shown
  - Implementation: `src/lib/version-check.ts`

**File Storage:** None

**Caching:**
- In-memory MiniSearch indexes (rebuilt on cache miss or fresh API fetch)
- chrome.storage.local for persistent metadata cache across sessions

## Monitoring & Observability

**Error Tracking:** None (no Sentry or similar)

**Logs:**
- Custom `logger` module at `src/lib/logger.ts`
- Debug/info/warn only in non-production; errors always logged to console
- Format: `[UltraForce][HH:MM:SS] message`

**API Stats:**
- `src/lib/api-stats.ts` - Tracks API request counts via `trackApiRequest()`
- Used in `src/lib/auth.ts` and `src/lib/salesforce-api.ts`

## CI/CD & Deployment

**Hosting:**
- Extension distributed via Chrome Web Store (implied by `plasmo package` command)
- Documentation site: `https://ultraforce.dormon.net` (referenced in `src/lib/version-check.ts`)

**CI Pipeline:** Not detected (no `.github/workflows/` files inspected; `.github/` directory exists)

## Environment Configuration

**Required env vars:** None at runtime (extension reads from browser cookies)

**Build-time:**
- `process.env.NODE_ENV` - Used in `src/lib/logger.ts` to suppress debug logs in production
- Plasmo framework handles NODE_ENV injection during build

**Secrets location:** None - no secrets stored in codebase; auth relies entirely on browser session cookies

## Webhooks & Callbacks

**Incoming:** None

**Outgoing:** None

## Chrome Extension Messaging

**Internal message bus (chrome.runtime.sendMessage):**
- `getSfHost` - Content scripts → Background: resolve SF host from current URL
- `getSession` - Content scripts → Background: retrieve `sid` cookie value
- `toggleModal` - Background action click / keyboard command → Content scripts: show/hide search UI
- `ping` - Health check: returns `{ success: true, message: 'Background script is running' }`

**Keyboard command:**
- `toggle-search`: Cmd+B (Mac) / Ctrl+B registered in `package.json` manifest section; triggers `toggleModal` message

---

*Integration audit: 2026-04-04*
