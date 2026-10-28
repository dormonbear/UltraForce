# Release Notes

## v0.5.1

Release Date: 2026-10-29 / 发布日期：2026-10-29

### Maintenance and reliability / 维护及可靠性

- Update React and React DOM together to 19.3.1, and Zustand to 5.0.16, with packaged search and settings verified in English and Simplified Chinese.
  React 与 React DOM 配套更新至 19.3.1，Zustand 更新至 5.0.16，并验证正式产物的中英文搜索及设置。
- Patch focused build-tool dependency paths for cache serialization, manifest policy, YAML configuration, archive/glob inputs and PostCSS source maps. Synthetic regressions cover the reproduced failures and normal compatibility cases.
  定向修复缓存序列化、清单策略、YAML 配置、归档／glob 输入及 PostCSS 源码映射的构建工具依赖路径；合成回归覆盖已复现失败及正常兼容用例。
- Continuous and release checks now exercise the actual production ZIP in both languages, including closed Shadow DOM isolation, alongside authentication, privacy and search-race regressions.
  持续及发布检查现会验证真实正式 ZIP 的两种语言及封闭 Shadow DOM 隔离，并运行认证、隐私及搜索竞态回归。
- Direct routine dependency updates to the development branch and retain existing security overrides and the CSP compatibility patch.
  将常规依赖更新指向开发分支，并保留既有安全覆盖及 CSP 兼容补丁。

### Privacy and verification scope / 隐私及验证范围

- Clarify the already-packaged scripting permission without expanding permissions. No new collection, application endpoints or persisted data are introduced.
  说明既有打包 scripting 权限，不扩大权限；不新增收集、应用端点或持久化数据。
- The matched full dependency audit still reports 38 advisory records / 40 instances, including 19 high, 16 moderate and five low. These maintenance changes do not establish browser-runtime exploitation or resolve every dependency advisory; [the remaining audit](https://github.com/dormonbear/UltraForce/issues/48) stays open.
  完整同窗口依赖审计仍报告 38 条公告／40 个实例，包括 19 项高危、16 项中危及五项低危。这些维护改动不证明浏览器运行时可利用，也未解决全部依赖公告；[剩余审计](https://github.com/dormonbear/UltraForce/issues/48)继续开放。

## v0.5.0

Release Date: 2026-10-21 / 发布日期：2026-10-21

### Interface languages / 界面语言

- Search, settings, recovery screens and accessibility messages now follow the browser's preferred supported language: English or Simplified Chinese, with English fallback.
  搜索、设置、错误恢复及无障碍消息现可跟随浏览器首选的受支持语言：英文或简体中文，不支持的语言回退为英文。
- Built-in commands can be found through either English or Chinese descriptions. Salesforce names, API identifiers and custom command descriptions keep their original text.
  内置命令可通过英文或中文描述查找。Salesforce 名称、API 标识符及自定义命令描述保留原文。
- Localization uses bundled dictionaries, stores no language preference and contacts no translation service.
  本地化使用随扩展打包的词典，不存储语言偏好，也不联系翻译服务。

### Reliability / 可靠性

- Added an accessible label to the settings back button and bilingual administrator-facing policy descriptions.
  为设置返回按钮补充无障碍标签，并为管理员策略说明提供中英双语。
- Continuous checks now run packaged browser regressions for both languages, authentication, privacy boundaries and search races against synthetic organizations.
  持续检查现可在合成组织上执行打包浏览器回归，覆盖两种语言、认证、隐私边界及搜索竞态。
- Manual release builds resolve and verify the requested existing tag, source commit and packaged version before publication.
  手动发布构建会在发布前解析并核验指定的已有标签、源码提交及打包版本。

## v0.4.1

Release Date: 2026-10-21

### Privacy

- Removed automatic render-error diagnostics and API usage statistics. Application and React error reporters discard private details in both production and development builds.
- Updates remove old diagnostic records while preserving functional settings, history, favorites and metadata caches. See the [privacy policy](https://github.com/dormonbear/UltraForce/blob/main/PRIVACY.md) for local storage and network behavior.
- Session requests are bound to the requesting Salesforce document and its organization. Supported Setup, Lightning, Visualforce, sandbox and China domain mappings remain available. Unverifiable legacy mappings stay on the current host; open the organization's MyDomain or Lightning page if an older Visualforce page cannot authenticate.

### Bug Fixes

- Switching between Setup shortcuts and metadata searches no longer lets a delayed response replace newer results or clear the current loading state.

### Improvements

- Updated the UI runtime and verified search, keyboard navigation, focus return and settings against the built extension.

## v0.4.0

Release Date: 2026-09-10

### New Features

- **Enterprise Managed Policy**: Administrators can force-install UltraForce and push settings through Chrome's managed storage (`managed_schema.json`). Policy-controlled settings (`navigationMode`, `hideManagedPackage`, `maxResultsPerType`) override user values, show as disabled with a "Managed by your organization" note in the settings panel, and apply live without a browser restart. Removing a policy restores the user's own values.
- **Screen-Reader Combobox**: The search input and result list now follow the WAI-ARIA combobox/listbox pattern, so assistive technology announces the highlighted result as you navigate.

### Improvements

- **No External Font Requests**: The Inter font is bundled with the extension instead of loaded from Google Fonts; no request leaves the Salesforce page for styling.
- **Privacy Audit**: A source-verified [PRIVACY.md](https://github.com/dormonbear/UltraForce/blob/main/PRIVACY.md) documents every network call and stored value.
- **Storage Warning**: If the browser rejects a favorites, history, or settings write (storage quota exceeded), the modal shows a warning instead of silently dropping the change.

### Bug Fixes

- **Focus Lost on Open**: Opening the modal right after navigating to a page (especially Setup pages) could leave the keyboard focus on the host page, requiring a click before typing. The modal now reclaims focus when the page steals it, and typing always lands in the search box. When the browser UI itself holds focus, the placeholder tells you to click first.
- **Metadata Cache Starving User Data**: The metadata cache could fill the entire `chrome.storage.local` budget on large orgs, so pins and recents were lost after reload. The cache is now capped at half the quota.
- **Metadata Types Hidden After Session Expiry**: A permission probe made while the session had expired marked Tooling API types as unsupported for 24 hours. Probes now abort on 401, and the session fingerprint is a digest of the full session token rather than the org-ID prefix.
- **Duplicate Recents/Favorites Buckets**: Reaching the same org through its Setup domain (`*.my.salesforce-setup.com`) and its My Domain produced separate recents and favorites lists. All host forms of one org now share one bucket; existing data under the My Domain key is untouched.

## v0.3.2

Release Date: 2026-06-17

### Bug Fixes

- **Field search broken for underscore-named objects**: Typing `ObjectName.` (e.g. `IC_Royalty_Center__c.` or `ASR_Hotel__c.`) returned no fields for any custom object whose API name contains underscores. The field lookup over-escaped underscores in an exact-match query, so it matched zero rows. Fields now load correctly for all objects.

## v0.3.1

Release Date: 2026-06-11

### Bug Fixes

- **CRITICAL -- Extension Broken in v0.3.0**: v0.3.0 shipped with a broken build -- the content script crashed on load (`Cannot find module 'react/jsx-runtime'`), so the keyboard shortcut could not open the search modal at all. Root cause: a newly added `engines` field in package.json made the bundler target Node and stop bundling dependencies. The field is removed and the build is verified working. Please update immediately if you are on v0.3.0.

### Technical

- Added a release smoke test that loads the packed extension in a real browser and verifies the shortcut opens the modal; the release pipeline now hard-fails if the built extension does not actually work.

## v0.3.0

Release Date: 2026-06-10

### New Features

- **Accessibility Overhaul**: The search modal is now fully screen-reader and keyboard friendly -- ARIA roles and labels on the dialog, result list, and all action buttons; live-region announcements for loading and error states; focus is restored to the host page element when the modal closes.

### Improvements

- **Keyboard Focus Rings**: All interactive elements inside the modal show a visible focus indicator when navigating with Tab, and hover-only row actions (pin, remove, edit) now also appear on keyboard focus.
- **Text Contrast**: Secondary text (descriptions, timestamps, namespaces, hints) is brighter to meet WCAG AA contrast on the dark panel.
- **Reduced Motion**: With `prefers-reduced-motion` enabled, the modal entrance animation and the production org-badge pulse are disabled.
- **Cleaner Icons**: Empty-state emoji icons replaced with crisp SVG icons matching the rest of the UI.
- **Faster Result Rendering**: Result rows are memoized, so long result lists no longer re-render on every keystroke.

### Bug Fixes

- **Recent List Ordering**: The Recent list on the home screen now sorts strictly by last opened time -- the item you just opened always appears at the top, regardless of how often other items were visited.
- **SOQL Wildcard Escaping**: Search text containing `%` or `_` is now escaped correctly in LIKE queries instead of acting as a wildcard.
- **Hardened Messaging**: Background message handlers now validate the sender origin, ignoring requests from non-Salesforce pages.

## v0.2.5

Release Date: 2026-05-22

### Improvements

- **Recent History Navigation**: Opening an existing Recent or Favorite item now refreshes its visit count and recency score.

### Bug Fixes

- **Command Result Recents**: Fixed `:u`, `:p`, and other command search results not always appearing in the Recent list after opening them.

## v0.2.4

Release Date: 2026-05-22

### Bug Fixes

- **Custom Setting Search Grouping**: Fixed custom settings appearing twice in search results by excluding `IsCustomSetting` entities from the Custom Objects index. Existing stale Custom Object metadata cache is refreshed automatically.

## v0.2.3

Release Date: 2026-05-14

### Bug Fixes

- **Cross-Org Recent / Favorites Leak**: Fixed a bug where opening two Salesforce org tabs (e.g. Sandbox + Production) caused the Recent list and Favorites to leak across orgs -- clicking an item from one org could navigate to the other. History and favorites are now isolated per host. Existing single-org data is automatically migrated on first launch.

## v0.2.2

Release Date: 2026-04-07

### Bug Fixes

- **Settings Panel Input**: Fixed custom command form inputs being unresponsive -- the keyboard interceptor was hijacking all keystrokes and routing them to the search input

## v0.2.1

Release Date: 2026-04-07

### Bug Fixes

- **Classic Object Navigation**: Fixed Custom Object search results opening the setup/definition page instead of the record list view in Classic mode

## v0.2.0

Release Date: 2026-04-06

### New Features

- **Recent History + Frecency**: Modal home screen shows recently visited records and setup pages, ranked by frequency and recency. Remove items or pin them to favorites.
- **Setup Page Favorites**: Pin frequently-used items to the top of the modal home screen. Star icon toggle available on search results and home screen. Persisted across sessions.
- **Smart ID Navigator**: Paste Salesforce record IDs (15/18-char) or URLs into the search input to see record previews with object type and name. Supports pasting multiple IDs at once.
- **Contextual Suggestions**: On record pages, quick actions for Clone and Object Setup. On setup pages, related setup pages in the same category are suggested.

### Improvements

- Modal empty state replaced with rich home screen showing favorites and recent history
- Record action buttons no longer highlight by default
- Favorite star icon consistent across all views (14x14, gold fill when pinned)

## v0.1.3

Release Date: 2026-04-05

### Bug Fixes

- **Search Modal Visual Effect**: Fixed missing frosted glass background effect on the search modal
- **Search Functionality**: Fixed issue where typing in the search input did not trigger search results

## v0.1.2

Release Date: 2026-04-05

### Improvements

- **Performance & Stability**: Internal architecture improvements for faster and more reliable search
- **Font Rendering**: Bundled Inter font locally for consistent UI appearance without external requests

## v0.1.1

Release Date: 2026-02-07

### Bug Fixes

- **Keyboard Input on Lightning Pages**: Fixed issue where Salesforce Lightning shortcuts (e.g. 'e' for edit, 'd' for details) would intercept keystrokes, preventing character input in the search modal

### Improvements

- **Code Quality**: Extracted shared utilities (domain-utils), unified code style, removed dead code, consolidated duplicate type definitions
- **Test Coverage**: Added 62 unit tests covering domain utilities and keyboard interceptor

### Technical

- Added Vitest test infrastructure with jsdom environment
- Extracted `keyboard-interceptor` module with full keyboard event handling (printable chars, Backspace/Delete, Ctrl/Cmd shortcuts, navigation keys, IME composition)
- Extracted `domain-utils` module (normalizeHost, isSalesforceDomain, escapeSoql)
- Cleaned ~280 lines of dead code from auth.ts, types/index.ts, salesforce-api.ts

## v0.1.0

Release Date: 2026-01-01

### New Features

- **Reports & Dashboards Search**: Added support for searching Reports and Dashboards with `:r` command. Results display folder name and last modified user
- **Record Context Actions**: When viewing a record, quickly navigate to Page Layout, Record Type, or Fields configuration
- **Queue & Public Group Search**: Added `:q` command to search Queues and Public Groups
- **Version Update Notification**: Users are now notified when a new version is installed
- **API Statistics**: Track and view API call statistics in Settings
- **Custom Command Import/Export**: Import and export custom commands as JSON files
- **Documentation Site**: Added comprehensive documentation at ultraforce.dormon.net

### Improvements

- **Fuzzy Search Enhancement**: Improved typo-tolerant matching with better scoring
- **Metadata Cache Warmup**: Background pre-fetching of common metadata types for faster initial search
- **User Navigation Mode Detection**: Automatically detect user's Lightning/Classic preference
- **Unsupported Types Handling**: Gracefully handle metadata types that user doesn't have permission to access
- **Keyboard Shortcut Compatibility**: Fixed conflict with Salesforce's `/` shortcut key
- **Cache Rebuild**: Added ability to rebuild metadata cache from Settings

### Technical

- Added E2E test suite with Playwright
- Added ESLint configuration
- Improved error handling and logging
