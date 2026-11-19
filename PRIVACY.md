# Privacy

**隐私政策**

UltraForce for Salesforce does not collect analytics, usage events, API request
statistics, or automatic error reports. It has no vendor telemetry service and
does not upload diagnostic data. Search and navigation run in your browser using
your existing Salesforce session. Functional workspace data stays in this
extension's `chrome.storage.local` in your browser profile.

UltraForce for Salesforce 不收集分析数据、使用事件、API 请求统计信息或自动错误报告。
扩展没有供应商遥测服务，也不会上传诊断数据。搜索和导航在浏览器中使用您现有的
Salesforce 会话执行。用于提供功能的工作区数据保存在浏览器配置文件中本扩展的 `chrome.storage.local`。

## Network and session access

**网络与会话访问**

The extension's four `fetch` call sites (`src/lib/auth.ts` and
`src/lib/salesforce-api.ts`) call Salesforce APIs for session validation,
permission checks, metadata search, record previews, and user-configured SOQL
commands. These requests go to the Salesforce host resolved from your session.
Your queries and the requested record or metadata identifiers are sent to
Salesforce to perform these functions; they are not sent to UltraForce.

扩展中的四处 `fetch` 调用（位于 `src/lib/auth.ts` 和 `src/lib/salesforce-api.ts`）使用
Salesforce API 验证会话、检查权限、搜索元数据、预览记录以及执行用户配置的 SOQL 命令。
请求发往根据您的会话确定的 Salesforce 主机。为执行这些功能，查询内容及所请求的记录或
元数据标识符会发送给 Salesforce，不会发送给 UltraForce。

The background worker reads the Salesforce `sid` cookie and supplies it to
content scripts through extension messaging. The session value is held in
memory and attached to Salesforce requests as `Authorization: Bearer` or
`X-SFDC-Session`. UltraForce does not persist the session value. The accessibility
cache stores a short, non-cryptographic session fingerprint to invalidate stale
permission results after login changes; it is not an authentication credential.

后台工作线程读取 Salesforce 的 `sid` Cookie，并通过扩展消息将其传给内容脚本。
会话值保存在内存中，并通过 `Authorization: Bearer` 或 `X-SFDC-Session` 请求标头随
Salesforce 请求发送。UltraForce 不会持久保存会话值。可访问性缓存保存简短的非加密
会话指纹，用于在登录发生变化后使旧的权限检查结果失效。该指纹不是认证凭据。

The cookie bridge accepts only this extension's content-script messages from
supported HTTPS Salesforce document origins. Host resolution and session
requests are bound to that document, including supported Setup, Lightning,
Visualforce and China domain mappings. Discovery for unknown legacy instance
domains requires an exact match with the document's own session cookie, rather
than just an organization ID prefix. If this cannot be established, the bridge
keeps the current host; open the organization's MyDomain or Lightning page if
an older Visualforce page cannot authenticate. An unrelated hostname in a
message cannot choose another organization's session.

Cookie 桥接仅接受本扩展内容脚本从受支持的 HTTPS Salesforce 文档源发来的消息。
主机解析和会话请求均绑定到该文档，包括受支持的设置、Lightning、Visualforce 和中国区域名映射。
对于未知的旧版实例域名，必须与文档自身的会话 Cookie 完全匹配，不能仅凭组织 ID 前缀确定。
若无法确认匹配，桥接会保留当前主机。如果旧版 Visualforce 页面无法通过身份验证，
请打开该组织的 MyDomain 或 Lightning 页面。消息中无关的主机名无法选用其他组织的会话。

There is no analytics SDK, beacon, WebSocket, EventSource, or XMLHttpRequest in
the application source. Fonts are bundled with the extension and loaded from
`chrome-extension://` URLs. Version notifications compare packaged and locally
stored version numbers without contacting an update server. Chrome's own
extension update service and the host Salesforce page operate independently of
UltraForce's application requests.

应用源码中没有分析 SDK、信标、WebSocket、EventSource 或 XMLHttpRequest。
字体随扩展打包，并通过 `chrome-extension://` URL 加载。版本通知比较打包版本号和本地存储的
版本号，无需联系更新服务器。Chrome 自身的扩展更新服务和当前 Salesforce 页面独立于
UltraForce 的应用请求运行。

Documentation, release notes, and the privacy policy are links opened when you
click them. The destination website receives a normal browser navigation and
is governed by its own hosting policy. The extension does not automatically
open these links or append organization, session, query, or record data.

文档、发行说明和隐私政策链接会在您点击时打开。目标网站接收普通的浏览器导航请求，
并适用其自身的托管政策。扩展不会自动打开这些链接，也不会附加组织、会话、查询或记录数据。

## Functional data on your device

**设备上的功能数据**

These are local features for your work, not telemetry or data collected by the
developer. They can still contain organization information and personal content.

以下数据用于在本地提供工作所需的功能，不属于遥测数据，也不会由开发者收集。
其中仍可能包含组织信息和个人内容。

| Storage | Contents and purpose |
| --- | --- |
| `settings`, `ultraforce_search_settings` | Preferences and user-configured commands, including SOQL templates |
| `ultraforce_history__<host>` | Up to 200 recent items per organization, including names, URLs, descriptions, visit counts, and timestamps |
| `ultraforce_favorites__<host>` | Items you pin, including names, URLs, and descriptions, scoped to an organization |
| `metadata_<orgId>_<type>` | Metadata names, labels, namespaces and related catalog information, with a 24-hour TTL and a 5 MiB cache cap |
| `ultraforce_unsupported_types` | Inaccessible metadata types, check timestamps and a session-change fingerprint |
| `ultraforce_version_check` | The locally seen extension version and notification status |

| 存储键 | 内容和用途 |
| --- | --- |
| `settings`、`ultraforce_search_settings` | 偏好设置和用户配置的命令，包括 SOQL 模板 |
| `ultraforce_history__<host>` | 每个组织最多 200 条最近访问记录，包括名称、URL、描述、访问次数和时间戳 |
| `ultraforce_favorites__<host>` | 按组织保存您收藏的项目，包括名称、URL 和描述 |
| `metadata_<orgId>_<type>` | 元数据名称、标签、命名空间及相关目录信息，缓存有效期为 24 小时，上限为 5 MiB |
| `ultraforce_unsupported_types` | 无法访问的元数据类型、检查时间戳和用于识别会话变更的指纹 |
| `ultraforce_version_check` | 本地已见过的扩展版本及通知状态 |

The extension uses neither `chrome.storage.sync` nor `chrome.storage.session`.
Search result lists are held in memory. Record previews use an in-memory cache
of up to 50 entries for five minutes. History and favorites may retain displayed
names or descriptions from items you visit or pin; this means record-related
content can be present locally in those features even though query result
lists are not automatically persisted.

扩展不使用 `chrome.storage.sync` 或 `chrome.storage.session`。搜索结果列表保存在内存中。
记录预览使用内存缓存，最多保留 50 个条目，有效期为五分钟。历史记录和收藏可能保留
您访问或收藏的项目所显示的名称或描述，因此相关记录内容可能存在于这些本地功能中，
但查询结果列表不会自动持久化。

Use the clear controls for history and favorites to clear the current
organization's items. Rebuilding metadata cache replaces the current
organization's metadata catalog. Uninstalling the extension removes its local
extension storage. Browser profiles, backups, and device access are managed by
you or your organization.

使用历史记录和收藏的清除按钮可清除当前组织的条目。重建元数据缓存会替换当前组织的
元数据目录。卸载扩展会删除其本地扩展存储。浏览器配置文件、备份以及设备访问权限由您
或您的组织管理。

## Errors and deprecated diagnostics

**错误与已弃用的诊断功能**

Render errors display a local recovery screen and retry controls. Error
messages and technical details may appear in that screen while it is open;
they are not saved or uploaded by the error boundary. Application
logging in both development and production emits only a static generic failure
message and never forwards caller arguments, queries, response bodies, URLs, or
session values. Debug, info and warning logger calls are silent in all builds.
React root caught, uncaught, and recoverable error reporters also discard raw
errors and component stacks and use the same fixed message.
Browser-generated exception messages are outside the application's control.

发生渲染错误时，扩展会在本地显示恢复界面及重试控件。界面打开时可能显示错误消息和
技术细节，错误边界不会保存或上传这些内容。开发版和生产版的应用日志均只输出固定的
通用失败消息，从不转发调用方参数、查询、响应正文、URL 或会话值。调试、信息和警告级别
的日志调用在所有构建中均无输出。React 根节点的已捕获、未捕获和可恢复错误报告器也会
丢弃原始错误及组件堆栈，并使用同一条固定消息。浏览器自行生成的异常消息不受应用控制。

Older releases saved render diagnostics (`ultraforce_error_logs`) and API
request counts/timestamps (`ultraforce_api_stats`) locally. The current worker
removes exactly these two legacy keys on activation, browser startup, and
install/update. It removes them by name without reading their contents and
preserves functional settings, history, favorites, and metadata caches.
The former API Statistics UI and request tracking have been removed.

旧版本曾在本地保存渲染诊断信息（`ultraforce_error_logs`）和 API 请求次数及时间戳
（`ultraforce_api_stats`）。当前后台工作线程会在激活、浏览器启动以及安装或更新时
删除且仅删除这两个旧存储键。删除操作只按键名执行，不读取其中的内容，并保留功能设置、历史记录、
收藏和元数据缓存。旧版 API 统计界面及请求跟踪功能已移除。

## Permissions and verification limits

**权限与验证范围**

The packaged extension requests `scripting`, `storage`, `activeTab`, `tabs`,
`cookies`, and host permissions for Salesforce-family domains. The
[`scripting` permission](https://developer.chrome.com/docs/extensions/reference/api/scripting)
lets UltraForce restore search in open Salesforce tabs after an extension update. Chrome
allows JavaScript/CSS injection with host permissions or temporary active-tab
access. Cookies support existing-session authentication; tabs and activeTab
support navigation and the search shortcut. See the manifest configuration in
`package.json` for the exact domain list and the generated production manifest
for the packaged permission list.

打包后的扩展请求 `scripting`、`storage`、`activeTab`、`tabs`、`cookies`，以及
Salesforce 系列域名的主机权限。[`scripting` 权限](https://developer.chrome.com/docs/extensions/reference/api/scripting)
让 UltraForce 在扩展更新后恢复已打开的 Salesforce 标签页中的搜索功能。
Chrome 允许在具有主机权限或临时活动标签页访问权限的页面中注入 JavaScript／CSS。
Cookie 用于现有会话认证；tabs 和 activeTab 支持导航及搜索快捷键。
准确域名列表见 `package.json` 中的清单配置，打包权限列表见生成的生产清单。

Regression tests cover error handling without storage writes, request handling
without statistics, static production logging, and key-only migration. A
controlled Chromium test loads the built extension with synthetic Salesforce
responses, checks startup migration preserves workspace data, runs successful
and failed searches, and checks storage and outgoing request destinations.
This is a scoped verification, not proof of behavior in every live organization
or of the privacy practices of Salesforce, Chrome, linked websites, or browser
extensions installed alongside UltraForce.

回归测试覆盖错误处理不写入存储、请求处理不记录统计信息、生产版日志只输出固定消息，
以及迁移时仅按键名清理数据。受控的 Chromium 测试使用模拟 Salesforce 响应加载已构建的
扩展，确认启动迁移会保留工作区数据，运行成功和失败的搜索，并检查存储内容及出站请求
的目标位置。验证仅涵盖这些场景，无法证明扩展在每个真实组织中的行为，也无法验证
Salesforce、Chrome、链接目标网站或与 UltraForce 一同安装的其他浏览器扩展的隐私做法。
