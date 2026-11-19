# Features Overview

UltraForce provides a comprehensive set of features for Salesforce metadata search and navigation.

## Core Features

### [Metadata Search](./metadata-search)

Search across all Salesforce metadata types with fuzzy matching and intelligent caching.

### [Field Search](./field-search)

Use dot notation to search object fields directly (e.g., `Account.Name`).

### [Record Navigation](./record-navigation)

Navigate to record detail pages and detect objects from record IDs.

### [Setup Navigation](./setup-navigation)

Jump directly to Setup pages using the `:g` command.

### History & Favorites / 历史记录和收藏

Open UltraForce with an empty query to see your **Recent** items (ordered by most recently opened) and pinned **Favorites**. Use the round **History** or **Favorites** button beside the floating search bar to show just that list. Both lists are scoped to the current Salesforce org.

在搜索框为空时打开 UltraForce，可看到 **最近访问**（按最近打开的时间排序）和已固定的 **收藏**。点击悬浮搜索栏旁的圆形 **历史记录** 或 **收藏** 按钮，即可单独查看对应列表。两个列表均按当前 Salesforce 组织区分。

### Accessibility

The search interface is an ARIA dialog with labelled controls, live-region announcements, visible keyboard focus rings, and WCAG AA text contrast. Spring animations start from the controls or panels they belong to. UltraForce respects the system's `prefers-reduced-motion` setting.

搜索界面是一个 ARIA 对话框，提供控件标签、实时区域播报、可见的键盘焦点轮廓，以及符合 WCAG AA 的文本对比度。弹簧动画从对应的控件或面板开始。UltraForce 遵循系统的 `prefers-reduced-motion` 设置。

## Search Capabilities

- **Fuzzy matching** - Find results even with typos
- **Prefix matching** - Match from the beginning of names
- **Case-insensitive** - Search without worrying about case
- **Multi-type search** - Search across all metadata simultaneously

## Performance

- **24-hour cache** - Metadata cached locally for instant searches
- **Background refresh** - Cache updates automatically after 2 hours
- **Incremental search** - Results update as you type
- **API efficiency** - Minimized API calls with smart caching

## Supported Metadata Types

| Category | Types |
|----------|-------|
| Objects | CustomObject, CustomField |
| Code | ApexClass, ApexTrigger, ApexPage, ApexComponent |
| Lightning | AuraDefinitionBundle, LightningComponentBundle |
| Automation | Flow, ValidationRule, WorkflowRule |
| Security | Profile, PermissionSet, PermissionSetGroup, CustomPermission |
| Configuration | CustomLabel, CustomMetadata, CustomSetting |
| Users | User, Queue, Group |
| Analytics | Report, Dashboard |
