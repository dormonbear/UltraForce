# Privacy

UltraForce for Salesforce is a Manifest V3 Chrome extension that provides fuzzy metadata
search and navigation inside Salesforce pages. It authenticates to your Salesforce org
with your existing browser session cookie and makes no other network requests.

This document describes what leaves your machine, what stays, and what is cached where.
Every claim is verified against source at the cited `file:line`. Anything that could not
be verified is flagged explicitly.

## Outbound network requests (complete list)

Every `fetch()` in the extension targets your own Salesforce org:
`https://<your-org-host>/services/data/v62.0/...` (`API_VERSION` is `62.0`,
`src/lib/auth.ts:9`). There are exactly four fetch call sites in the entire source tree:

| Request | Where | When |
| --- | --- | --- |
| `GET /services/data/v62.0/sobjects/` (session validation) | `src/lib/salesforce-api.ts:53` | Modal open / warmup |
| `GET .../tooling/query?q=SELECT Id FROM ApexClass LIMIT 1` (permission probe) | `src/lib/salesforce-api.ts:113` | First search per org/session |
| `GET .../{query,tooling/query}?q=SELECT Id FROM <object> LIMIT 1` (per-type probes) | `src/lib/salesforce-api.ts:160` | First search per org/session |
| `GET/POST <path>` (search, record preview, custom commands, record context) | `src/lib/auth.ts:94` (`sfRest`) | On user search, navigation, warmup |

Metadata search issues SOQL against org metadata tables (`EntityDefinition`,
`FieldDefinition`, custom settings/metadata; `src/lib/metadata-fetcher.ts:138-266`).
Record preview fetches `GET /sobjects/<type>/<id>?fields=Name` (`src/lib/record-preview.ts:96-98`).
Custom commands run user-configured SOQL against the org (`src/lib/custom-command.ts`).

No other hosts are ever contacted. Specifically:

- **No telemetry, analytics, or beaconing.** The only network primitives in `src/` are the
  four `fetch` sites above. There is no `XMLHttpRequest`, `sendBeacon`, `WebSocket`, or
  `EventSource` anywhere in the extension.
- **No remote fonts and no remote assets.** `src/lib/font-loader.ts` generates
  `@font-face` rules whose URLs are built with `chrome.runtime.getURL` pointing at
  bundled files (`assets/fonts/inter-latin.woff2`,
  `assets/fonts/inter-latin-ext.woff2`; `src/lib/font-loader.ts:5-26`). These resolve to
  `chrome-extension://<id>/assets/fonts/...` — the extension's own origin, never a
  network host. `src/components/search/styles.css:2` contains no `@import` of any remote
  origin. The extension does not fetch from jsdelivr, Google Fonts, or any CDN.
- **No remote update check.** `checkForUpdate()` compares the packaged manifest version
  with a value stored locally and performs no network request
  (`src/lib/version-check.ts:14-29`).
- **The only non-org URLs in the source are user-clicked links**: release notes
  (`src/lib/version-check.ts:3`, opened as an `<a href target="_blank">` at
  `src/components/search/UpdateNotification.tsx:54`), project docs and a privacy gist
  (`src/components/search/SettingsPanel.tsx:65-66`, opened as anchors at
  `src/components/search/SettingsPanel.tsx:722,725`). Opening them is a user action, not
  an automatic request.

## The session cookie (sid)

- The background service worker reads the `sid` cookie from the browser cookie jar with
  `chrome.cookies.get` (`src/background/index.ts:243`) and hands its value to the content
  script over `chrome.runtime` messaging (`src/background/index.ts:246`).
- The value is held in memory in the content script and attached as
  `Authorization: Bearer <sid>` (or `X-SFDC-Session` for Bulk API) on requests to your
  org (`src/lib/auth.ts:85-87`).
- It is **never** written to `chrome.storage`, never logged (the logger only emits error
  objects; `src/lib/logger.ts:21-36`), and never sent to any host other than your org.
- The first 8 characters of the sid value are stored in `chrome.storage.local` as a
  session-change fingerprint (`src/lib/unsupported-types.ts:10-13`, persisted at
  `src/lib/unsupported-types.ts:43-49`). A sid typically begins with the org ID, so treat
  this as org-identifying; it is not enough to impersonate a session.

## What is stored locally (chrome.storage.local)

All keys are defined in `src/lib/storage-service.ts:7-16`. Storage is device-local to
your browser profile and never leaves the browser.

| Key | Contents | Notes |
| --- | --- | --- |
| `settings`, `ultraforce_search_settings` | User preferences (search limit, types, behavior) | — |
| `ultraforce_history__<host>` | Up to 200 recently visited items: name, type, URL, description, visit counts and timestamps (`src/stores/history-store.ts:15-25`) | Keyed per org host |
| `ultraforce_favorites__<host>` | Same shape, items you pinned | Keyed per org host |
| `metadata_<orgId>_<type>` | Cached org metadata catalog: API names, labels, namespaces, custom-setting and custom-metadata names (`src/lib/metadata-fetcher.ts:138-266`) | 24 h TTL, 10 MB cap (`src/lib/metadata-cache.ts:8-16`) |
| `ultraforce_unsupported_types` | Per-org list of inaccessible metadata types, checked timestamp, sid fingerprint | — |
| `ultraforce_api_stats` | API request count and timestamps, 30-day window only (`src/lib/api-stats.ts`) | No URLs, no payloads |
| `ultraforce_version_check` | Last seen extension version | — |
| `ultraforce_error_logs` | Last 10 render errors: message, stack, page URL, user-agent (`src/components/ErrorBoundary.tsx:74-86`) | Never uploaded |

What is **not** stored: record field values. Record previews (one record's `Name`) live
only in memory with a 50-entry, 5-minute cache (`src/lib/record-preview.ts:17,25,33-35`).
Search results are never persisted (`src/stores/search-store.ts:2`). The sid is never
persisted. The extension does not use `chrome.storage.session` or `chrome.storage.sync`.

## How to clear stored data

- **History and favorites**: use the clear controls in the modal's settings panel, or
  remove the matching `ultraforce_history__<host>` / `ultraforce_favorites__<host>` keys.
  Clearing in settings affects the org you are currently logged into.
- **Everything**: uninstalling the extension removes its `chrome.storage.local` data.
  While installed, the data lives in your browser profile; nothing is uploaded anywhere.

## Permissions

`storage`, `activeTab`, `tabs`, `cookies`, plus host permissions limited to
Salesforce-family domains (`.salesforce.com`, `.force.com`, `.visualforce.com`,
`.sfcrmapps.cn`, `.sfcrmproducts.cn`, and related) plus `login.salesforce.com` and
`test.salesforce.com` (`package.json`, `manifest` section). The `cookies` permission
exists solely to read the `sid` cookie described above.

## Claims not verified at runtime

- The packaged build's font behavior is inferred from the built manifest and build
  output, not observed in a running browser: the build output does not include the
  `assets/fonts/*.woff2` files and `web_accessible_resources` does not list them, so the
  local `chrome-extension://` font fetch is expected to fail and fall back to system
  fonts. This is a functional gap, not a data leak.
- The docs/privacy links in the settings panel are plain anchors and were not clicked
  during this audit.
