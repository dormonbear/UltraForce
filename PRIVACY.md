# Privacy

UltraForce for Salesforce does not collect analytics, usage events, API request
statistics, or automatic error reports. It has no vendor telemetry service and
does not upload diagnostic data. Search and navigation run in your browser using
your existing Salesforce session. Functional workspace data stays in this
extension's `chrome.storage.local` in your browser profile.

## Network and session access

The extension's four `fetch` call sites (`src/lib/auth.ts` and
`src/lib/salesforce-api.ts`) call Salesforce APIs for session validation,
permission checks, metadata search, record previews, and user-configured SOQL
commands. These requests go to the Salesforce host resolved from your session.
Your queries and the requested record or metadata identifiers are sent to
Salesforce to perform these functions; they are not sent to UltraForce.

The background worker reads the Salesforce `sid` cookie and supplies it to
content scripts through extension messaging. The session value is held in
memory and attached to Salesforce requests as `Authorization: Bearer` or
`X-SFDC-Session`. UltraForce does not persist the session value. The accessibility
cache stores a short, non-cryptographic session fingerprint to invalidate stale
permission results after login changes; it is not an authentication credential.

There is no analytics SDK, beacon, WebSocket, EventSource, or XMLHttpRequest in
the application source. Fonts are bundled with the extension and loaded from
`chrome-extension://` URLs. Version notifications compare packaged and locally
stored version numbers without contacting an update server. Chrome's own
extension update service and the host Salesforce page operate independently of
UltraForce's application requests.

Documentation, release notes, and the privacy policy are links opened when you
click them. The destination website receives a normal browser navigation and
is governed by its own hosting policy. The extension does not automatically
open these links or append organization, session, query, or record data.

## Functional data on your device

These are local features for your work, not telemetry or data collected by the
developer. They can still contain organization information and personal content.

| Storage | Contents and purpose |
| --- | --- |
| `settings`, `ultraforce_search_settings` | Preferences and user-configured commands, including SOQL templates |
| `ultraforce_history__<host>` | Up to 200 recent items per organization, including names, URLs, descriptions, visit counts, and timestamps |
| `ultraforce_favorites__<host>` | Items you pin, including names, URLs, and descriptions, scoped to an organization |
| `metadata_<orgId>_<type>` | Metadata names, labels, namespaces and related catalog information, with a 24-hour TTL and a 5 MiB cache cap |
| `ultraforce_unsupported_types` | Inaccessible metadata types, check timestamps and a session-change fingerprint |
| `ultraforce_version_check` | The locally seen extension version and notification status |

The extension uses neither `chrome.storage.sync` nor `chrome.storage.session`.
Search result lists are held in memory. Record previews use an in-memory cache
of up to 50 entries for five minutes. History and favorites may retain displayed
names or descriptions from items you visit or pin; this means record-related
content can be present locally in those features even though query result
lists are not automatically persisted.

Use the clear controls for history and favorites to clear the current
organization's items. Rebuilding metadata cache replaces the current
organization's metadata catalog. Uninstalling the extension removes its local
extension storage. Browser profiles, backups, and device access are managed by
you or your organization.

## Errors and deprecated diagnostics

Render errors display a local recovery screen and retry controls. Error
messages and technical details may appear in that screen while it is open;
they are not saved or uploaded by the error boundary. Application
logging in both development and production emits only a static generic failure
message and never forwards caller arguments, queries, response bodies, URLs, or
session values. Debug, info and warning logger calls are silent in all builds.
React root caught, uncaught, and recoverable error reporters also discard raw
errors and component stacks and use the same fixed message.
Browser-generated exception messages are outside the application's control.

Older releases saved render diagnostics (`ultraforce_error_logs`) and API
request counts/timestamps (`ultraforce_api_stats`) locally. The current worker
removes exactly these two legacy keys on activation, browser startup, and
install/update. It removes them by name without reading their contents and
preserves functional settings, history, favorites, and metadata caches.
The former API Statistics UI and request tracking have been removed.

## Permissions and verification limits

The extension requests `storage`, `activeTab`, `tabs`, `cookies`, and host
permissions for Salesforce-family domains. Cookies support existing-session
authentication; tabs and activeTab support navigation and the search shortcut.
See the manifest configuration in `package.json` for the exact domain list.

Regression tests cover error handling without storage writes, request handling
without statistics, static production logging, and key-only migration. A
controlled Chromium test loads the built extension with synthetic Salesforce
responses, checks startup migration preserves workspace data, runs successful
and failed searches, and checks storage and outgoing request destinations.
This is a scoped verification, not proof of behavior in every live organization
or of the privacy practices of Salesforce, Chrome, linked websites, or browser
extensions installed alongside UltraForce.
