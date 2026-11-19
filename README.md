# UltraForce for Salesforce

A Chrome extension for lightning-fast Salesforce metadata search.

用于快速搜索 Salesforce 元数据的 Chrome 扩展。

[![CI](https://github.com/dormonbear/UltraForce/actions/workflows/ci.yml/badge.svg)](https://github.com/dormonbear/UltraForce/actions/workflows/ci.yml)
[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/maemkmihjmlfilhpfeeindecjnagelkh)](https://chromewebstore.google.com/detail/ultraforce-for-salesforce/maemkmihjmlfilhpfeeindecjnagelkh)
[![Chrome Web Store users](https://img.shields.io/chrome-web-store/users/maemkmihjmlfilhpfeeindecjnagelkh)](https://chromewebstore.google.com/detail/ultraforce-for-salesforce/maemkmihjmlfilhpfeeindecjnagelkh)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Security Policy](https://img.shields.io/badge/security-policy-blue.svg)](SECURITY.md)
[![Docs](https://img.shields.io/badge/docs-ultraforce.dormon.net-brightgreen.svg)](https://ultraforce.dormon.net)

Documentation: [ultraforce.dormon.net](https://ultraforce.dormon.net)

文档：[ultraforce.dormon.net](https://ultraforce.dormon.net)

## Install

**安装**

[Get it on Chrome Web Store](https://chromewebstore.google.com/detail/ultraforce-for-salesforce/maemkmihjmlfilhpfeeindecjnagelkh)

[在 Chrome 网上应用店安装](https://chromewebstore.google.com/detail/ultraforce-for-salesforce/maemkmihjmlfilhpfeeindecjnagelkh)

## Demo

**演示**

Press `Cmd+B` or `Ctrl+B` on a Salesforce page, type a metadata name, and open the result directly.

在 Salesforce 页面上按 `Cmd+B` 或 `Ctrl+B`，输入元数据名称后即可直接打开结果。

Demo media should be added at `docs/assets/ultraforce-demo.gif` before a public launch.

公开发布前应将演示动图添加到 `docs/assets/ultraforce-demo.gif`。

## Usage

**使用方法**

1. Log in to any Salesforce org in your browser
2. Press `Cmd+B` (Mac) or `Ctrl+B` (Windows) to open UltraForce
3. Start typing to search

1. 在浏览器中登录 Salesforce 组织。
2. 按 `Cmd+B`（Mac）或 `Ctrl+B`（Windows）打开 UltraForce。
3. 输入内容开始搜索。

The interface follows the browser's preferred supported language (English or Simplified Chinese), with English as the fallback. Language selection uses browser preferences directly; it stores no language preference and contacts no translation service. User-defined commands and Salesforce names retain their original text.

界面跟随浏览器首选的受支持语言（英文或简体中文），不支持的语言回退为英文。语言选择直接采用浏览器偏好，不存储语言偏好，也不联系翻译服务。用户自定义命令及 Salesforce 名称保留原文。

## Search Types

**搜索类型**

- **Apex Classes / Triggers** - Search by name
- **Visualforce / LWC / Aura** - Search by component name
- **Custom Objects** - Search by object API name or label
- **Fields** - Use dot-notation: `Account.Name` or `Account.`
- **Flows** - Search by flow name
- **Users** - Search by name, username, email, or federation ID
- **Profiles & Permission Sets** - Profiles, permission sets, permission set groups, custom permissions
- **Custom Labels** - Search by label name or value content
- **Custom Metadata Types** - Search types, use dot-notation for records: `My_Setting__mdt.`
- **Custom Settings** - Search settings, use dot-notation for records: `My_Setting__c.`
- **Queues & Public Groups** - Search by name
- **Reports & Dashboards** - Search by name and folder

- **Apex 类／触发器**：按名称搜索。
- **Visualforce／LWC／Aura**：按组件名称搜索。
- **自定义对象**：按对象 API 名称或标签搜索。
- **字段**：使用点号语法，例如 `Account.Name` 或 `Account.`。
- **流程**：按流程名称搜索。
- **用户**：按姓名、用户名、电子邮件或联合身份 ID 搜索。
- **简档与权限集**：搜索简档、权限集、权限集组和自定义权限。
- **自定义标签**：按标签名称或值搜索。
- **自定义元数据类型**：可搜索类型，使用点号语法搜索记录，例如 `My_Setting__mdt.`。
- **自定义设置**：可搜索设置，使用点号语法搜索记录，例如 `My_Setting__c.`。
- **队列与公共组**：按名称搜索。
- **报表与仪表板**：按名称和文件夹搜索。

## Accessibility

**无障碍支持**

UltraForce is built to be keyboard- and screen-reader friendly: the modal is an ARIA dialog with labelled controls and live-region announcements, every interactive element shows a visible focus ring during keyboard navigation, secondary text meets WCAG AA contrast, and animations are disabled when `prefers-reduced-motion` is set.

UltraForce 支持键盘和屏幕阅读器。搜索窗口是 ARIA 对话框，包含带标签的控件和实时区域播报。通过键盘导航时，每个交互元素都有可见的焦点环。辅助文本对比度符合 WCAG AA，设置 `prefers-reduced-motion` 后会禁用动画。

## Commands

**命令**

Type `:` to see available commands for quick filtering:

输入 `:` 即可查看用于快速筛选的命令。

| Command | Description | Example |
|---------|-------------|---------|
| `:o` | Objects & Fields | `:o account` |
| `:c` | Custom Code (Apex, Triggers, VF, LWC, Aura) | `:c mycontroller` |
| `:f` | Flows | `:f approval` |
| `:u` | Users | `:u john` |
| `:p` | Profiles & Permissions (Profile, Perm Set, Perm Set Group, Custom Permission) | `:p admin` |
| `:l` | Custom Labels | `:l error_message` |
| `:m` | Custom Metadata & Settings | `:m my_setting` |
| `:q` | Queues & Public Groups | `:q support` |
| `:r` | Reports & Dashboards | `:r pipeline` |
| `:g` | Setup Shortcuts | `:g deploy` |

| 命令 | 说明 | 示例 |
| --- | --- | --- |
| `:o` | 对象与字段 | `:o account` |
| `:c` | 自定义代码（Apex、触发器、Visualforce、LWC、Aura） | `:c mycontroller` |
| `:f` | 流程 | `:f approval` |
| `:u` | 用户 | `:u john` |
| `:p` | 简档与权限（简档、权限集、权限集组、自定义权限） | `:p admin` |
| `:l` | 自定义标签 | `:l error_message` |
| `:m` | 自定义元数据与设置 | `:m my_setting` |
| `:q` | 队列与公共组 | `:q support` |
| `:r` | 报表与仪表板 | `:r pipeline` |
| `:g` | 设置快捷入口 | `:g deploy` |

## Home Screen: Recent & Favorites

**首页：最近访问和收藏**

Open UltraForce with an empty query to see your home screen:

打开 UltraForce 并清空搜索框即可查看首页。

- **Recent** - Items you have opened, ordered by most recently used (the item you just opened is always on top). Isolated per org.
- **Favorites** - Pin frequently-used items with the star icon to keep them at the top. Persisted across sessions.

- **最近访问**：按最近使用顺序显示您打开过的项目，刚打开的项目始终位于顶部。按组织区分。
- **收藏**：点击星标即可将常用项目固定在顶部。收藏会跨会话保存。

## Direct Record Navigation

**直接打开记录**

Paste one or more Salesforce record IDs (15 or 18 characters) or record URLs into the search box. UltraForce previews the resolved record (object type and name); press Enter to open it. Multiple IDs can be pasted at once.

在搜索框中粘贴一个或多个 Salesforce 记录 ID（15 或 18 位字符）或记录 URL。UltraForce 会预览识别出的记录（对象类型和名称）。按 Enter 打开记录。

## Keyboard Shortcuts

**键盘快捷键**

| Key | Action |
|-----|--------|
| `Cmd/Ctrl + B` | Open/Close UltraForce |
| `Up/Down` | Navigate results |
| `Enter` | Open selected result (or navigate to record ID) |
| `Tab` | Autocomplete (Object → `.` for fields, CMDT/Custom Setting → `.` for records) |
| `Esc` | Close |

| 按键 | 操作 |
| --- | --- |
| `Cmd/Ctrl + B` | 打开或关闭 UltraForce |
| 上／下方向键 | 浏览结果 |
| `Enter` | 打开选中的结果或跳转到记录 ID |
| `Tab` | 自动补全（在对象名称后添加 `.` 搜索字段，在自定义元数据类型或自定义设置名称后添加 `.` 搜索记录） |
| `Esc` | 关闭 |

## Settings

**设置**

Click the gear icon to configure:

点击齿轮图标可配置以下选项。

- **Search Types** - Choose which metadata types to search
- **Keyboard Shortcut** - Customize the activation key
- **Close modal after opening result** - Auto-close after opening a result
- **Fuzzy search (typo-tolerant matching)** - Enable typo-tolerant matching
- **Hide managed package items** - Filter out managed package components
- **Max results per type** - Limit the number of results shown per metadata type
- **Navigation Mode** - Auto / Lightning / Classic
- **Custom Commands** - Configure your own command shortcuts

- **搜索类型**：选择要搜索的元数据类型。
- **键盘快捷键**：自定义打开扩展的快捷键。
- **打开结果后关闭搜索窗口**：打开结果后自动关闭窗口。
- **模糊搜索（容忍输入错误）**：启用容错匹配。
- **隐藏托管软件包项目**：筛除托管软件包中的组件。
- **每种类型的结果上限**：限制每种元数据类型的显示结果数。
- **导航模式**：自动／Lightning／Classic。
- **自定义命令**：配置您自己的命令快捷方式。

## Security and Privacy

**安全与隐私**

UltraForce uses your existing browser session to send requests directly to your Salesforce org. UltraForce does not collect analytics or automatically upload error reports. Links you open are subject to the destination website’s privacy policy.

UltraForce 使用您现有的浏览器会话，将请求直接发送到您的 Salesforce 组织。UltraForce 不收集分析数据，也不会自动上传错误报告。您打开的链接适用目标网站的隐私政策。

See [PRIVACY.md](PRIVACY.md) for details about outbound requests, local storage, session cookies, and the scope of verification.

有关出站请求、本地存储、会话 Cookie 和验证范围的详情，请参阅[隐私政策](PRIVACY.md)。

### Data Storage

**数据存储**

We store minimal data in the browser's extension storage (`chrome.storage.local`) to save your preferences (search settings, keyboard shortcut, custom commands) along with a locally cached metadata index, recent history, and favorites. Recent history and favorites are isolated per Salesforce org. When you run a custom SOQL command, the resulting query is sent to your Salesforce org to perform the search.

扩展在浏览器的扩展存储（`chrome.storage.local`）中保存搜索设置、键盘快捷键、自定义命令、本地元数据索引、最近访问记录和收藏。最近访问记录和收藏按 Salesforce 组织隔离。运行自定义 SOQL 命令时，生成的查询会发送到您的 Salesforce 组织以执行搜索。

### API Access

**API 访问**

The extension communicates via official Salesforce APIs on behalf of the currently logged-in user. This means UltraForce can only access data and features that you already have permission to access in Salesforce.

扩展代表当前登录用户调用 Salesforce 官方 API，只能访问您在 Salesforce 中已有权限访问的数据和功能。

### Session Handling

**会话处理**

All Salesforce API calls reuse the access token/session from your browser's existing Salesforce session. To acquire this access token, UltraForce requires permission to read browser cookie information for Salesforce domains.

所有 Salesforce API 请求都复用浏览器中现有 Salesforce 会话的访问令牌。为获取此令牌，UltraForce 需要读取 Salesforce 域名的浏览器 Cookie。

## Inspired by

**灵感来源**

- [EasyMeta](https://chromewebstore.google.com/detail/easymeta/jmlnbdjigfmgodkdaaikakhfabfjohcd) - Chrome extension for Salesforce metadata
- [Salesforce Inspector Reloaded](https://github.com/tprouvot/Salesforce-Inspector-reloaded) - Chrome extension for Salesforce admins and developers
- [Raycast](https://www.raycast.com/) - Productivity tool with beautiful UI/UX

- [EasyMeta](https://chromewebstore.google.com/detail/easymeta/jmlnbdjigfmgodkdaaikakhfabfjohcd)：用于 Salesforce 元数据的 Chrome 扩展。
- [Salesforce Inspector Reloaded](https://github.com/tprouvot/Salesforce-Inspector-reloaded)：面向 Salesforce 管理员和开发人员的 Chrome 扩展。
- [Raycast](https://www.raycast.com/)：界面设计出色的效率工具。

## Contributing

**参与贡献**

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, development workflow, and testing expectations. See
[SECURITY.md](SECURITY.md) to report vulnerabilities privately.

有关环境配置、开发流程和测试要求，请参阅[贡献指南](CONTRIBUTING.md)。请按[安全政策](SECURITY.md)中的说明私下报告漏洞。

## Changelog

**更新日志**

See [CHANGELOG.md](CHANGELOG.md) for release history.

发行历史见[更新日志](CHANGELOG.md)。

## License

**许可证**

MIT License

MIT 许可证
